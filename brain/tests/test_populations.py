import hashlib,json,struct,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'preprocess'))
from populations import audit,serialize,FIELDS
class PopulationTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name);self.arrays={}
  self.write_array('neuron_ids','Q',[2**53+1,2**53+2,2**53+3,2**53+4])
  self.write_array('visual_indices','I',[3])
  dictionaries={f:[None,'L','R'] for f in FIELDS}
  dictionaries['superclass']=[None,'cb_sensory','cb_sensory_tbc','vnc_motor']
  for f in FIELDS:self.write_array('annotation_'+f,'I',[1,1,2,3] if f=='superclass' else [0,1,2,0])
  raw=json.dumps(dictionaries).encode();(self.root/'annotations.json').write_bytes(raw)
  self.manifest={'format':'MALECNS_CSR_V2','release':'male-cns:v1.0','retained_neurons':4,'positioned_neurons':1,
   'arrays':self.arrays,'annotations':{'file':'annotations.json','sha256':hashlib.sha256(raw).hexdigest()}}
  self.save()
 def write_array(self,name,kind,values):
  raw=struct.pack('<'+kind*len(values),*values);(self.root/(name+'.bin')).write_bytes(raw)
  self.arrays[name]={'file':name+'.bin','dtype':'<u8' if kind=='Q' else '<u4','length':len(values),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
 def save(self):(self.root/'manifest.json').write_text(json.dumps(self.manifest))
 def test_exact_membership_missing_positions_tbc_and_reproducibility(self):
  result=audit(self.root);g=result['populations'][0]
  self.assertEqual(g['members'],[{'index':0,'neuron_id':str(2**53+1)},{'index':1,'neuron_id':str(2**53+2)}])
  self.assertEqual((g['count'],g['unpositioned'],g['related_tbc_count']),(2,2,1))
  self.assertEqual(g['distributions']['somaSide'],[{'label':None,'count':1},{'label':'L','count':1}])
  self.assertEqual(result['populations'][1]['count'],0)
  self.assertIsNone(result['game_mapping']);self.assertIsNone(result['sign_mapping'])
  self.assertEqual(serialize(result),serialize(audit(self.root)))
 def test_source_corruption_is_rejected(self):
  (self.root/'annotation_rootSide.bin').write_bytes(b'bad')
  with self.assertRaisesRegex(ValueError,'checksum'):audit(self.root)
 def test_invalid_codes_and_visual_mapping_are_rejected(self):
  self.write_array('annotation_class','I',[99,0,0,0]);self.save()
  with self.assertRaisesRegex(ValueError,'annotation code'):audit(self.root)
  self.write_array('annotation_class','I',[0,0,0,0]);self.write_array('visual_indices','I',[4]);self.save()
  with self.assertRaisesRegex(ValueError,'visual mapping'):audit(self.root)
