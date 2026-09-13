"""Loss-accounted MaleCNS importer. Graph never depends on coordinate availability.

Inputs are streamed in Arrow batches; only retained edges are sorted in memory.
All authored code; inspected DoomFly for provenance practices, not copied logic.
"""
import argparse,json,shutil,tempfile,time
from collections import Counter
from pathlib import Path
import numpy as np
import pyarrow as pa
import pyarrow.feather as feather
import pyarrow.ipc as ipc
from sources import ROOT,FILES,check_sources,digest

FIELDS=('superclass','class','subclass','type','status','statusLabel','somaSide','rootSide','somaNeuromere')
def ids(values):
 a=np.asarray(values)
 if a.ndim!=1 or a.dtype.kind not in 'iu' or (a.dtype.kind=='i' and np.any(a<0)):raise ValueError('IDs must be exact unsigned-compatible integers')
 return a.astype(np.uint64)

def nodes(table,nt):
 d=table.to_pydict();source=ids(d['bodyId'])
 if len(np.unique(source))!=len(source):raise ValueError('Duplicate annotation ID')
 reasons=['explicit_glia' if d['status'][i]=='Glia' else 'missing_superclass' if not d['superclass'][i] else 'retained' for i in range(len(source))]
 selected=np.flatnonzero(np.array(reasons)=='retained');selected=selected[np.argsort(source[selected])];kept=source[selected]
 if not len(kept):raise ValueError('No retained neurons')
 labels={field:[d[field][i] for i in selected] for field in FIELDS}
 ntids=ids(nt['body'].to_numpy());order=np.argsort(ntids);ntids=ntids[order]
 if len(np.unique(ntids))!=len(ntids):raise ValueError('Duplicate neurotransmitter ID')
 lookup=np.searchsorted(ntids,kept);found=lookup<len(ntids)
 if len(ntids):found&=ntids[np.minimum(lookup,len(ntids)-1)]==kept
 else:found[:]=False
 ntlabels=nt['consensus_nt'].to_pylist();labels['consensus_nt']=[ntlabels[order[lookup[i]]] if found[i] else None for i in range(len(kept))]
 # Preserve source prediction/ground-truth distinctions; no signed weights inferred.
 for field in ('predicted_nt','ground_truth'):
  values=nt[field].to_pylist();labels[field]=[values[order[lookup[i]]] if found[i] else None for i in range(len(kept))]
 visual=[];coords=[]
 for i,original in enumerate(selected):
  pos=d['somaLocation'][original]
  if pos is None:continue
  if len(pos)!=3 or not np.isfinite(pos).all():raise ValueError('Invalid measured soma coordinate')
  visual.append(i);coords.append(pos)
 if not coords:raise ValueError('No measured soma positions')
 xyz=np.asarray(coords,dtype=np.float64);low=xyz.min(axis=0);high=xyz.max(axis=0);center=(low+high)/2;scale=float((high-low).max()/1.7)
 if scale<=0:raise ValueError('Degenerate soma coordinates')
 # Anatomical display: X horizontal, negative source Z vertical, source Y depth.
 norm=(xyz-center)/scale;norm=norm[:,[0,2,1]];norm[:,1]*=-1
 stats={'source_annotation_rows':len(source),'retained_neurons':len(kept),'excluded_nodes':dict(Counter(r for r in reasons if r!='retained')),'positioned_neurons':len(visual),'missing_soma_positions':len(kept)-len(visual),'unmatched_nt_rows':int((~found).sum()),'neurotransmitters':dict(Counter(x or 'unknown' for x in labels['consensus_nt'])),'superclasses':dict(Counter(labels['superclass']))}
 spatial={'field':'somaLocation','missing_policy':'omit from geometry, retain in graph; tosomaLocation not substituted','source_units':'native annotation coordinates; physical units not independently verified','source_min':low.tolist(),'source_max':high.tolist(),'center':center.tolist(),'scale':scale,'axis_order':[0,2,1],'axis_sign':[1,-1,1],'description':'One point per annotated soma, not a neurite/synapse reconstruction'}
 return kept,labels,np.asarray(visual,dtype='<u4'),xyz.astype('<f4'),norm.astype('<f4'),stats,spatial

def retain_edges(neuron_ids,pre,post,weight):
 pre,post=ids(pre),ids(post);weight=np.asarray(weight)
 if len(pre)!=len(post) or len(pre)!=len(weight):raise ValueError('Edge column length mismatch')
 if weight.dtype.kind not in 'iu' or np.any(weight<=0) or np.any(weight>np.iinfo(np.uint32).max):raise ValueError('Invalid positive integer synapse count')
 a=np.searchsorted(neuron_ids,pre);b=np.searchsorted(neuron_ids,post);n=len(neuron_ids)
 keep=(a<n)&(b<n);keep&=(neuron_ids[np.minimum(a,n-1)]==pre)&(neuron_ids[np.minimum(b,n-1)]==post)
 return a[keep].astype('<u4'),b[keep].astype('<u4'),weight[keep].astype('<u4'),keep

def consolidate(pre,post,weights,n):
 order=np.lexsort((post,pre));pre,post,weights=pre[order],post[order],weights[order]
 starts=np.r_[0,np.flatnonzero((pre[1:]!=pre[:-1])|(post[1:]!=post[:-1]))+1] if len(pre) else np.array([],dtype=int)
 counts=np.add.reduceat(weights.astype(np.uint64),starts) if len(pre) else np.array([],dtype=np.uint64)
 if np.any(counts>np.iinfo(np.uint32).max):raise ValueError('Aggregated edge weight overflow')
 pre,post=pre[starts],post[starts];offset=np.r_[0,np.cumsum(np.bincount(pre,minlength=n),dtype=np.uint64)]
 if offset[-1]>np.iinfo(np.uint32).max:raise ValueError('Graph exceeds uint32 format capacity')
 return offset.astype('<u4'),post.astype('<u4'),counts.astype('<u4')

def build(raw,output,lock):
 if output.exists():raise ValueError('Output exists; select a new --output directory')
 start=time.perf_counter();registry=check_sources(raw,lock)
 neuron_ids,labels,visual,original,positions,stats,spatial=nodes(feather.read_table(raw/FILES['annotations']),feather.read_table(raw/FILES['neurotransmitters'],columns=['body','consensus_nt','predicted_nt','ground_truth']))
 output.parent.mkdir(parents=True,exist_ok=True)
 with tempfile.TemporaryDirectory(prefix='.generated-',dir=output.parent) as tmp:
  tmp=Path(tmp);arrays={}
  def write(name,data):
   data=np.ascontiguousarray(data);path=tmp/(name+'.bin');data.tofile(path);arrays[name]={'file':path.name,'dtype':data.dtype.str,'length':int(data.size),'bytes':path.stat().st_size,'sha256':digest(path)}
  write('neuron_ids',neuron_ids.astype('<u8'));write('visual_indices',visual);write('source_positions',original);write('positions',positions)
  dictionaries={}
  for field,values in labels.items():
   dictionary=[None]+sorted(set(v for v in values if v is not None));mapping={v:i for i,v in enumerate(dictionary)};dictionaries[field]=dictionary
   write('annotation_'+field,np.array([mapping[v] for v in values],dtype='<u4'))
  (tmp/'annotations.json').write_text(json.dumps(dictionaries,sort_keys=True,separators=(',',':'))+'\n')
  totals={'source_edge_rows':0,'source_synaptic_contacts':0,'retained_edge_rows':0,'retained_synaptic_contacts':0,'excluded_edge_rows':0,'excluded_synaptic_contacts':0}
  reader=ipc.open_file(pa.memory_map(str(raw/FILES['edges']),'r'))
  parts=[(tmp/('work-'+n)).open('wb') for n in ('pre','post','weight')]
  try:
   for i in range(reader.num_record_batches):
    batch=reader.get_batch(i);pre,post,weight=(batch.column(batch.schema.get_field_index(n)).to_numpy() for n in ('body_pre','body_post','weight'))
    a,b,w,keep=retain_edges(neuron_ids,pre,post,weight)
    for file,values in zip(parts,(a,b,w)):values.tofile(file)
    total=int(weight.sum(dtype=np.uint64));retained=int(w.sum(dtype=np.uint64));totals['source_edge_rows']+=len(weight);totals['source_synaptic_contacts']+=total;totals['retained_edge_rows']+=len(w);totals['retained_synaptic_contacts']+=retained;totals['excluded_edge_rows']+=int((~keep).sum());totals['excluded_synaptic_contacts']+=total-retained
    if i%500==0:print(f'Processed {i+1}/{reader.num_record_batches} batches',flush=True)
  finally:
   for f in parts:f.close()
  pre,post,weights=(np.fromfile(tmp/('work-'+n),dtype='<u4') for n in ('pre','post','weight'))
  offsets,targets,weights=consolidate(pre,post,weights,len(neuron_ids));del pre,post
  for n in ('pre','post','weight'):(tmp/('work-'+n)).unlink()
  write('row_offsets',offsets);write('target_indices',targets);write('weights',weights)
  totals['coalesced_duplicate_rows']=totals['retained_edge_rows']-len(targets)
  manifest={'format':'MALECNS_CSR_V2','release':'male-cns:v1.0','provenance':'MALECNS','activity_model':'NONE','license':'CC-BY-4.0','attribution':'MaleCNS: FlyEM (HHMI Janelia), University of Cambridge, MRC LMB, Google Research','source_registry':registry,'node_policy':'Assigned nonempty superclass, excluding explicit Glia; uncertain tbc classes retained; no quality/Traced-only filter','edge_policy':'All released positive edges with both endpoints retained; no extra weight threshold, autapses kept; duplicate directed pairs summed','upstream_confidence_threshold':0.5,'edges':len(targets),**stats,**totals,'spatial':spatial,'arrays':arrays,'annotations':{'file':'annotations.json','sha256':digest(tmp/'annotations.json')},'elapsed_seconds':round(time.perf_counter()-start,3)}
  (tmp/'manifest.json').write_text(json.dumps(manifest,indent=2,sort_keys=True)+'\n')
  from validate_artifact import validate
  validate(tmp)
  # Never clobber a previous artifact. Rebuild to a fresh output and compare hashes.
  if output.exists():raise ValueError('Output exists; select a new --output directory')
  shutil.copytree(tmp,output)
 print(json.dumps({k:manifest[k] for k in ('retained_neurons','positioned_neurons','edges','excluded_edge_rows','elapsed_seconds')},indent=2))
 return manifest

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--raw',type=Path,default=ROOT/'data/raw/male-cns-v1.0');p.add_argument('--output',type=Path,default=ROOT/'data/generated');p.add_argument('--lock',type=Path,default=ROOT/'data/male-cns-v1.0.sources.json');a=p.parse_args();build(a.raw,a.output,a.lock)
