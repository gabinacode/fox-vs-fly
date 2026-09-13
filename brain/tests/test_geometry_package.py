import unittest,tempfile,json,hashlib,struct,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'preprocess'))
from package_geometry import package
class PackagingTests(unittest.TestCase):
 def test_packages_only_geometry_and_rejects_corrupt_source(self):
  with tempfile.TemporaryDirectory() as t:
   root=Path(t);source=root/'source';source.mkdir();dest=root/'public'
   arrays={}
   for name,dtype,data in [('positions','<f4',struct.pack('<ffffff',0,0,0,1,1,1)),('visual_indices','<u4',struct.pack('<II',0,2))]:
    (source/(name+'.bin')).write_bytes(data);arrays[name]={'file':name+'.bin','dtype':dtype,'length':len(data)//4,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
   (source/'weights.bin').write_bytes(b'do not publish')
   m={'format':'MALECNS_CSR_V2','provenance':'MALECNS','release':'male-cns:v1.0','retained_neurons':3,'positioned_neurons':2,'missing_soma_positions':1,'edges':4,'spatial':{},'license':'CC-BY-4.0','attribution':'fixture','arrays':{**arrays,'neuron_ids':{'sha256':'a'*64}}}
   (source/'manifest.json').write_text(json.dumps(m));package(source,dest)
   public=json.loads((dest/'manifest.json').read_text());self.assertEqual(public['activity_model'],'SYNTHETIC_DEMO');self.assertEqual(len(list(dest.iterdir())),3);self.assertFalse((dest/'weights.bin').exists())
   (source/'positions.bin').write_bytes(b'bad')
   with self.assertRaises(ValueError):package(source,dest)
if __name__=='__main__':unittest.main()
