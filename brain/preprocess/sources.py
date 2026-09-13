"""Official MaleCNS v1.0 graph inputs only. No EM or synapse coordinate files."""
from pathlib import Path
import hashlib,json,urllib.request
ROOT=Path(__file__).resolve().parents[2]
BASE='https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/'
FILES={
 'annotations':'body-annotations-male-cns-v1.0-minconf-0.5.feather',
 'neurotransmitters':'body-neurotransmitters-male-cns-v1.0.feather',
 'edges':'connectome-weights-male-cns-v1.0-minconf-0.5.feather',
}
def digest(path):
 with Path(path).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def check_sources(raw,lock):
 registry=json.loads(Path(lock).read_text())
 if registry['release']!='male-cns:v1.0':raise ValueError('Incorrect source release')
 for role,name in FILES.items():
  entry=registry['files'][role];p=raw/name
  if entry['filename']!=name or entry['url']!=BASE+name:raise ValueError('Incorrect source URL')
  if p.stat().st_size!=entry['bytes'] or digest(p)!=entry['sha256']:raise ValueError('Source checksum mismatch: '+name)
 return registry

def download(raw,lock,record=False):
 raw.mkdir(parents=True,exist_ok=True)
 existing=json.loads(lock.read_text()) if lock.exists() else None
 if existing is None and not record:raise ValueError('No source lock. Use --record-lock for an explicit first acquisition.')
 for role,name in FILES.items():
  path=raw/name
  if not path.exists():
   part=raw/(name+'.partial')
   print('Downloading',name,flush=True)
   with urllib.request.urlopen(BASE+name,timeout=120) as response,part.open('wb') as out:
    expected=int(response.headers.get('Content-Length','0'))
    while chunk:=response.read(8*1024*1024):out.write(chunk)
   if expected and part.stat().st_size!=expected:raise ValueError('Incomplete download')
   part.replace(path)
 if existing is None:
  entries={role:{'filename':name,'url':BASE+name,'bytes':(raw/name).stat().st_size,'sha256':digest(raw/name)} for role,name in FILES.items()}
  lock.parent.mkdir(parents=True,exist_ok=True)
  lock.write_text(json.dumps({'release':'male-cns:v1.0','source':'https://male-cns.janelia.org/download/','checksum_origin':'SHA-256 computed from first HTTPS acquisition; not a publisher-provided digest','files':entries},indent=2)+'\n')
 check_sources(raw,lock)
 print('All three official files match the source lock.')
if __name__=='__main__':
 import argparse
 p=argparse.ArgumentParser();p.add_argument('--raw',type=Path,default=ROOT/'data/raw/male-cns-v1.0');p.add_argument('--lock',type=Path,default=ROOT/'data/male-cns-v1.0.sources.json');p.add_argument('--record-lock',action='store_true');a=p.parse_args();download(a.raw,a.lock,a.record_lock)
