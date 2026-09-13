import gzip,hashlib,json,struct,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'preprocess'))
from package_graph import package_graph,ANNOTATIONS
class GraphPackagingTests(unittest.TestCase):
 def test_chunk_roundtrip_reproducible_and_corruption(self):
  with tempfile.TemporaryDirectory() as t:
   root=Path(t);src=root/'src';src.mkdir();arrays={}
   values={'neuron_ids':('Q',[2**53+1,2**53+2,2**53+3]),'row_offsets':('I',[0,2,3,4]),'target_indices':('I',[1,2,2,0]),'weights':('I',[1,2,3,4])}
   for name in ANNOTATIONS:values['annotation_'+name]=('I',[1,0,1])
   for name,(kind,v) in values.items():
    raw=struct.pack('<'+kind*len(v),*v);(src/(name+'.bin')).write_bytes(raw)
    arrays[name]={'file':name+'.bin','dtype':'<u8' if kind=='Q' else '<u4','length':len(v),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
   d=json.dumps({name:[None,'fixture'] for name in ANNOTATIONS}).encode();(src/'annotations.json').write_bytes(d)
   m={'format':'MALECNS_CSR_V2','release':'male-cns:v1.0','retained_neurons':3,'edges':4,'retained_synaptic_contacts':10,'license':'CC-BY-4.0','attribution':'fixture','arrays':arrays,'annotations':{'file':'annotations.json','sha256':hashlib.sha256(d).hexdigest()}}
   (src/'manifest.json').write_text(json.dumps(m))
   with patch('package_graph.CHUNK_BYTES',16):
    c=package_graph(src,root/'a');again=package_graph(src,root/'b')
   self.assertEqual(c,again)
   public=json.loads((root/'a'/c['manifest']['file']).read_text())
   for name,a in public['arrays'].items():
    chunks=[gzip.decompress((root/'a'/part['file']).read_bytes()) for part in a['chunks']]
    self.assertEqual(b''.join(chunks),(src/arrays[name]['file']).read_bytes())
   (src/'weights.bin').write_bytes(b'corrupt')
   with self.assertRaises(ValueError):package_graph(src,root/'a')
if __name__=='__main__':unittest.main()
