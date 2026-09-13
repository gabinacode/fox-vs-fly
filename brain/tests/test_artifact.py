import hashlib,json,struct,tempfile,unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'preprocess'))
from validate_artifact import validate
class ArtifactTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
        self.manifest={'format':'MALECNS_CSR_V1','release':'male-cns:v1.0','retained_neurons':2,'edges':1,'arrays':{}}
        for name,kind,values in [('neuron_ids','Q',[1,2]),('positions','f',[0,1,0,1,0,1]),('row_offsets','I',[0,1,1]),('target_indices','I',[1]),('weights','I',[3])]: self.put(name,kind,values)
    def tearDown(self): self.tmp.cleanup()
    def put(self,name,kind,values):
        data=struct.pack('<'+kind*len(values),*values);(self.root/(name+'.bin')).write_bytes(data)
        self.manifest['arrays'][name]={'file':name+'.bin','sha256':hashlib.sha256(data).hexdigest()}
        (self.root/'manifest.json').write_text(json.dumps(self.manifest))
    def test_valid_sparse_graph(self): self.assertEqual(validate(self.root),(2,1))
    def test_checksum(self):
        (self.root/'weights.bin').write_bytes(b'bad')
        with self.assertRaisesRegex(ValueError,'Checksum'): validate(self.root)
    def test_csr(self):
        self.put('row_offsets','I',[0,2,1])
        with self.assertRaisesRegex(ValueError,'CSR'): validate(self.root)
    def test_targets(self):
        self.put('target_indices','I',[2])
        with self.assertRaisesRegex(ValueError,'edge'): validate(self.root)
    def test_exact_ids(self):
        self.put('neuron_ids','Q',[2**60,2**60+1]);self.assertEqual(validate(self.root),(2,1))
        self.put('neuron_ids','Q',[2,2])
        with self.assertRaisesRegex(ValueError,'IDs'): validate(self.root)
    def test_truncated(self):
        self.put('positions','f',[0,1])
        with self.assertRaisesRegex(ValueError,'length'): validate(self.root)
if __name__=='__main__': unittest.main()
