"""Validate compact graph artifacts. V1 fixtures remain supported; V2 is the real importer contract."""
import hashlib, json, struct
from pathlib import Path

def validate(root):
    m=json.loads((root/'manifest.json').read_text())
    if m['format']=='MALECNS_CSR_V2': return validate_v2(root,m)
    if m['format']!='MALECNS_CSR_V1' or m['release']!='male-cns:v1.0': raise ValueError('Unknown dataset format/release')
    n,e=m['retained_neurons'],m['edges']
    if not isinstance(n,int) or not isinstance(e,int) or n<=0 or e<0: raise ValueError('Invalid counts')
    arrays={}
    for name,kind,length in [('neuron_ids','Q',n),('positions','f',n*3),('row_offsets','I',n+1),('target_indices','I',e),('weights','I',e)]:
        info=m['arrays'][name]; path=root/info['file']
        if not path.resolve().is_relative_to(root.resolve()): raise ValueError('Invalid array path')
        raw=path.read_bytes()
        if hashlib.sha256(raw).hexdigest()!=info['sha256']: raise ValueError('Checksum mismatch')
        if len(raw)!=struct.calcsize('<'+kind)*length: raise ValueError('Array length mismatch')
        arrays[name]=[x[0] for x in struct.iter_unpack('<'+kind,raw)]
    import math
    ids,offsets=arrays['neuron_ids'],arrays['row_offsets']
    if any(a>=b for a,b in zip(ids,ids[1:])): raise ValueError('IDs not sorted/unique')
    if not all(math.isfinite(x) for x in arrays['positions']): raise ValueError('Invalid coordinates')
    if offsets[0]!=0 or offsets[-1]!=e or any(a>b for a,b in zip(offsets,offsets[1:])): raise ValueError('Invalid CSR offsets')
    if any(t>=n for t in arrays['target_indices']) or any(w<=0 for w in arrays['weights']): raise ValueError('Invalid edge')
    return n,e


def validate_v2(root,m):
    import numpy as np
    if m['release']!='male-cns:v1.0' or m['provenance']!='MALECNS' or m['activity_model']!='NONE': raise ValueError('Incorrect provenance')
    n,e,v=m['retained_neurons'],m['edges'],m['positioned_neurons']
    if any(type(x)!=int for x in (n,e,v)) or n<=0 or e<0 or v<=0 or v>n: raise ValueError('Invalid graph counts')
    def path_for(info):
        path=root/info['file']
        if not path.resolve().is_relative_to(root.resolve()): raise ValueError('Invalid array path')
        with path.open('rb') as stream: hash_=hashlib.file_digest(stream,'sha256').hexdigest()
        if hash_!=info['sha256']: raise ValueError('Checksum mismatch')
        return path
    arrays={}
    expected={'neuron_ids':('<u8',n),'positions':('<f4',v*3),'source_positions':('<f4',v*3),'visual_indices':('<u4',v),'row_offsets':('<u4',n+1),'target_indices':('<u4',e),'weights':('<u4',e)}
    dictionaries=json.loads(path_for(m['annotations']).read_text())
    for name in dictionaries: expected['annotation_'+name]=('<u4',n)
    if set(expected)!=set(m['arrays']): raise ValueError('Missing or unexpected arrays')
    for name,(dtype,length) in expected.items():
        info=m['arrays'][name];path=path_for(info);size=np.dtype(dtype).itemsize*length
        if info['dtype']!=dtype or info['length']!=length or info['bytes']!=size or path.stat().st_size!=size: raise ValueError('Array layout mismatch')
        arrays[name]=np.memmap(path,dtype=dtype,mode='r') if length else np.array([],dtype=dtype)
    ids,off,targets,weights= (arrays[k] for k in ('neuron_ids','row_offsets','target_indices','weights'))
    if np.any(ids[1:]<=ids[:-1]):raise ValueError('IDs not sorted/unique')
    if off[0]!=0 or off[-1]!=e or np.any(off[1:]<off[:-1]):raise ValueError('Invalid CSR offsets')
    if np.any(targets>=n) or np.any(weights==0):raise ValueError('Invalid edge')
    # Each row must have strictly increasing unique target indices.
    bad=np.flatnonzero(targets[1:]<=targets[:-1])+1
    if not np.isin(bad,off).all():raise ValueError('Unsorted or duplicate CSR targets')
    indices=arrays['visual_indices']
    if np.any(indices>=n) or np.any(indices[1:]<=indices[:-1]):raise ValueError('Invalid visual-to-graph mapping')
    positions=arrays['positions'].reshape(-1,3);original=arrays['source_positions'].reshape(-1,3)
    if not np.isfinite(positions).all() or not np.isfinite(original).all():raise ValueError('Invalid positions')
    spatial=m['spatial'];center=np.asarray(spatial['center']);scale=spatial['scale']
    if center.shape!=(3,) or not np.isfinite(center).all() or not np.isfinite(scale) or scale<=0:raise ValueError('Invalid spatial transform')
    order=spatial['axis_order'];sign=spatial['axis_sign']
    if order!=[0,2,1] or sign!=[1,-1,1]:raise ValueError('Unexpected spatial transform')
    transformed=((original.astype(np.float64)-center)/scale)[:,order]*sign
    if not np.allclose(positions,transformed,rtol=1e-6,atol=1e-7):raise ValueError('Spatial transform mismatch')
    for name,dictionary in dictionaries.items():
        if not dictionary or dictionary[0] is not None or len(set(dictionary))!=len(dictionary):raise ValueError('Invalid annotation dictionary')
        if np.any(arrays['annotation_'+name]>=len(dictionary)):raise ValueError('Invalid annotation index')
    if m['source_annotation_rows']!=n+sum(m['excluded_nodes'].values()) or m['missing_soma_positions']!=n-v:raise ValueError('Node loss accounting mismatch')
    if m['source_edge_rows']!=m['retained_edge_rows']+m['excluded_edge_rows'] or m['retained_edge_rows']!=e+m['coalesced_duplicate_rows']:raise ValueError('Edge loss accounting mismatch')
    if m['source_synaptic_contacts']!=m['retained_synaptic_contacts']+m['excluded_synaptic_contacts'] or int(weights.sum(dtype=np.uint64))!=m['retained_synaptic_contacts']:raise ValueError('Synapse loss accounting mismatch')
    return n,e

if __name__=='__main__':
    root=Path(__file__).resolve().parents[2]/'data/generated'
    if (root/'manifest.json').exists(): print('Validated MaleCNS artifact:',validate(root))
    else: print('MaleCNS artifact absent; run the documented preprocessing commands to generate it.')
