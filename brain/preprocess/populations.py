"""Annotation-exact candidate audit. No functional or game-control assignment."""
import argparse, hashlib, json
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
CANDIDATES=('cb_sensory','ol_sensory','vnc_sensory','visual_projection','descending_neuron','vnc_motor')
FIELDS=('superclass','class','subclass','type','somaSide','rootSide','consensus_nt')
def audit(source):
    m=json.loads((source/'manifest.json').read_text())
    if m['format']!='MALECNS_CSR_V2' or m['release']!='male-cns:v1.0':raise ValueError('Unexpected graph release')
    hashes={}
    def checked(info,key):
        path=source/info['file']
        if not path.resolve().is_relative_to(source.resolve()):raise ValueError('Invalid source path')
        with path.open('rb') as stream:digest=hashlib.file_digest(stream,'sha256').hexdigest()
        if digest!=info['sha256']:raise ValueError('Source checksum mismatch: '+key)
        hashes[key]=digest
        return path
    n=m['retained_neurons']
    def array(name,dtype,length):
        info=m['arrays'][name];path=checked(info,name)
        if info['dtype']!=dtype or info['length']!=length or info['bytes']!=np.dtype(dtype).itemsize*length or path.stat().st_size!=info['bytes']:raise ValueError('Invalid array layout')
        return np.fromfile(path,dtype=dtype)
    ids=array('neuron_ids','<u8',n)
    if np.any(ids[1:]<=ids[:-1]):raise ValueError('Invalid ID order')
    dictionaries=json.loads(checked(m['annotations'],'annotations').read_text())
    columns={}
    for field in FIELDS:
        d=dictionaries[field]
        if not d or d[0] is not None or len(set(d))!=len(d) or any(not isinstance(x,str) for x in d[1:]):raise ValueError('Invalid dictionary')
        columns[field]=array('annotation_'+field,'<u4',n)
        if np.any(columns[field]>=len(d)):raise ValueError('Invalid annotation code')
    visual=array('visual_indices','<u4',m['positioned_neurons'])
    if np.any(visual>=n) or np.any(visual[1:]<=visual[:-1]):raise ValueError('Invalid visual mapping')
    positioned=np.zeros(n,dtype=bool);positioned[visual]=True
    def histogram(field,indices):
        codes,counts=np.unique(columns[field][indices],return_counts=True)
        return [{'label':dictionaries[field][int(code)],'count':int(count)} for code,count in zip(codes,counts)]
    groups=[]
    for label in CANDIDATES:
        d=dictionaries['superclass'];code=d.index(label) if label in d else -1
        indices=np.flatnonzero(columns['superclass']==code)
        tbc=label+'_tbc';uncertain=np.flatnonzero(columns['superclass']==(d.index(tbc) if tbc in d else -1))
        groups.append({'label':label,'selector':{'field':'superclass','equals':label},'count':len(indices),
            'positioned':int(positioned[indices].sum()),'unpositioned':int((~positioned[indices]).sum()),
            'related_tbc_count':len(uncertain),'distributions':{f:histogram(f,indices) for f in FIELDS if f!='superclass'},
            'members':[{'index':int(i),'neuron_id':str(int(ids[i]))} for i in indices]})
    return {'format':'MALECNS_CANDIDATES_V1','release':m['release'],'graph_identity':m['arrays']['neuron_ids']['sha256'],
        'nodes':n,'source_hashes':hashes,'license':m.get('license'),'attribution':m.get('attribution'),
        'status':'ANNOTATION_CANDIDATES_ONLY','game_mapping':None,'sign_mapping':None,
        'selection_policy':'Exact superclass equality; tbc labels counted separately, never silently merged. No side, NT, type or position filtering.',
        'superclass_inventory':histogram('superclass',np.arange(n)),'populations':groups}
def serialize(value):return json.dumps(value,sort_keys=True,separators=(',',':'))+'\n'
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,default=ROOT/'data/generated')
    parser.add_argument('--output',type=Path,default=ROOT/'data/male-cns-v1.0.populations.json');parser.add_argument('--check',action='store_true');args=parser.parse_args()
    if not (args.source/'manifest.json').exists():
        if args.check:print('SKIP population regeneration: source graph absent');raise SystemExit(0)
        parser.error('Generate the source graph first')
    result=audit(args.source);raw=serialize(result)
    if args.check:
        if not args.output.exists() or args.output.read_text()!=raw:raise SystemExit('Population report differs; regenerate and review')
    else:
        temporary=args.output.with_suffix('.partial');temporary.write_text(raw);temporary.replace(args.output)
    print(json.dumps([{k:g[k] for k in ('label','count','positioned','unpositioned','related_tbc_count')} for g in result['populations']],indent=2))
