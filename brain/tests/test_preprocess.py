import json,tempfile,unittest,sys
from pathlib import Path
import numpy as np
import pyarrow as pa
import pyarrow.feather as feather
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'preprocess'))
from build_connectome import nodes,retain_edges,consolidate,build,FIELDS
from sources import FILES,BASE,digest,check_sources
from validate_artifact import validate

def fixture():
 d={k:[None]*5 for k in FIELDS}
 d.update(bodyId=[1,2,3,4,5],superclass=['descending_neuron',None,'vnc_sensory','cb_intrinsic','vnc_motor'],status=['Traced','Orphan','Anchor','Glia','Traced'],somaLocation=[[0,0,0],None,None,[2,3,4],[10,20,30]])
 return pa.table(d),pa.table({'body':pa.array([1,5],type=pa.int64()),'consensus_nt':['acetylcholine','gaba'],'predicted_nt':['acetylcholine','gaba'],'ground_truth':[None,'gaba']})

class PreprocessTests(unittest.TestCase):
 def test_nodes_preserve_missing_positions_and_nt(self):
  n,l,v,raw,pos,stats,spatial=nodes(*fixture())
  np.testing.assert_array_equal(n,[1,3,5]);np.testing.assert_array_equal(v,[0,2]);self.assertEqual(l['consensus_nt'],['acetylcholine',None,'gaba']);self.assertEqual(stats['missing_soma_positions'],1);self.assertEqual(stats['excluded_nodes'],{'missing_superclass':1,'explicit_glia':1});self.assertEqual(stats['unmatched_nt_rows'],1);self.assertLess(pos[1,1],pos[0,1])
 def test_edge_filtering_and_sparse_orientation(self):
  a,b,w,keep=retain_edges(np.array([1,3,5],dtype=np.uint64),[1,1,3,7],[3,3,5,1],[2,4,6,8])
  self.assertEqual(keep.tolist(),[True,True,True,False]);off,target,count=consolidate(a,b,w,3)
  np.testing.assert_array_equal(off,[0,1,2,2]);np.testing.assert_array_equal(target,[1,2]);np.testing.assert_array_equal(count,[6,6])
 def test_invalid_ids_and_weights(self):
  for pre,post,w in [([1.0],[3],[1]),([1],[3],[-1]),([1],[3],[1.5]),([1],[3],[2**32])]:
   with self.assertRaises(ValueError):retain_edges(np.array([1,3],dtype=np.uint64),pre,post,w)
  a,b=fixture();a=a.set_column(a.schema.get_field_index('bodyId'),'bodyId',pa.array([1,1,3,4,5]))
  with self.assertRaisesRegex(ValueError,'Duplicate'):nodes(a,b)
 def test_coalescing_overflow(self):
  with self.assertRaisesRegex(ValueError,'overflow'):consolidate(np.array([0,0]),np.array([1,1]),np.array([2**32-1,1],dtype=np.uint32),2)
 def test_empty_connectivity(self):
  off,targets,w=consolidate(np.array([],dtype=np.uint32),np.array([],dtype=np.uint32),np.array([],dtype=np.uint32),3)
  np.testing.assert_array_equal(off,[0,0,0,0]);self.assertEqual(len(targets),0)
 def test_end_to_end_reproducibility_and_corruption(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);raw=root/'raw';raw.mkdir();a,nt=fixture();feather.write_feather(a,raw/FILES['annotations']);feather.write_feather(nt,raw/FILES['neurotransmitters'])
   feather.write_feather(pa.table({'body_pre':[1,1,3,4,2,5],'body_post':[3,3,5,1,1,5],'weight':[2,4,6,8,10,1]}),raw/FILES['edges'])
   lock=root/'sources.json';lock.write_text(json.dumps({'release':'male-cns:v1.0','files':{r:{'filename':n,'url':BASE+n,'bytes':(raw/n).stat().st_size,'sha256':digest(raw/n)} for r,n in FILES.items()}}))
   first=build(raw,root/'first',lock);second=build(raw,root/'second',lock)
   self.assertEqual(first['arrays'],second['arrays']);self.assertEqual(validate(root/'first'),(3,3));self.assertEqual(first['retained_edge_rows'],4);self.assertEqual(first['excluded_edge_rows'],2);self.assertEqual(first['coalesced_duplicate_rows'],1);self.assertEqual(first['retained_synaptic_contacts'],13)
   with self.assertRaisesRegex(ValueError,'Output exists'):build(raw,root/'first',lock)
   manifest=root/'first/manifest.json';m=json.loads(manifest.read_text());m['retained_synaptic_contacts']+=1;manifest.write_text(json.dumps(m))
   with self.assertRaisesRegex(ValueError,'accounting'):validate(root/'first')
   (raw/FILES['edges']).write_bytes(b'corrupt')
   with self.assertRaisesRegex(ValueError,'checksum'):check_sources(raw,lock)
if __name__=='__main__':unittest.main()
