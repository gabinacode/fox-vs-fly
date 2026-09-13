"""Package only measured geometry and its graph mapping; never ship the full CSR."""
from pathlib import Path
import hashlib,json,shutil
ROOT=Path(__file__).resolve().parents[2]
def sha(path):
 with path.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def package(source,dest):
 m=json.loads((source/'manifest.json').read_text())
 if m['format']!='MALECNS_CSR_V2' or m['provenance']!='MALECNS':raise ValueError('Not measured MaleCNS geometry')
 assets={}
 for name,dtype,length in [('positions','<f4',m['positioned_neurons']*3),('visual_indices','<u4',m['positioned_neurons'])]:
  info=m['arrays'][name];path=source/info['file']
  if not path.resolve().is_relative_to(source.resolve()) or info['dtype']!=dtype or info['length']!=length or path.stat().st_size!=length*4 or sha(path)!=info['sha256']:raise ValueError('Invalid source geometry')
  assets[name]={**info,'file':name+'-'+info['sha256'][:16]+'.bin'}
 dest.mkdir(parents=True,exist_ok=True)
 for name,info in assets.items():shutil.copyfile(source/m['arrays'][name]['file'],dest/info['file'])
 public={k:m[k] for k in ['release','retained_neurons','positioned_neurons','missing_soma_positions','edges','spatial','license','attribution']}
 public['graph_identity']=m['arrays']['neuron_ids']['sha256']
 public.update(format='MALECNS_GEOMETRY_V1',activity_model='SYNTHETIC_DEMO',arrays=assets)
 tmp=dest/'manifest.json.partial';tmp.write_text(json.dumps(public,indent=2)+'\n');tmp.replace(dest/'manifest.json')
 print('Packaged measured geometry:',sum(a['bytes'] for a in assets.values()),'bytes; full graph excluded')
if __name__=='__main__':
 source=ROOT/'data/generated';dest=ROOT/'web/public/connectome'
 if (source/'manifest.json').exists():package(source,dest)
 else:
  m=json.loads((dest/'manifest.json').read_text())
  for info in m['arrays'].values():
   path=dest/info['file']
   if not path.resolve().is_relative_to(dest.resolve()) or path.stat().st_size!=info['bytes'] or sha(path)!=info['sha256']:raise ValueError('Invalid packaged geometry')
  print('Reusing verified browser geometry; full offline graph not required.')
