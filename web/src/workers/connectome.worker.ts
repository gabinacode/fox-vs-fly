import {NeuralDiagnostic,type DiagnosticFrame} from '../brain/diagnostic';
let diagnostic:NeuralDiagnostic|null=null,diagnosticId=0;
const sendDiagnostic=(frame:DiagnosticFrame)=>self.postMessage({type:'diagnostic-frame',id:diagnosticId,frame},{transfer:[frame.activity.buffer as ArrayBuffer]});
import {loadGraph,type LoadedGraph,type GraphCatalog} from '../brain/connectome';
import {runExperiment,type ExperimentSuite} from '../brain/experiment';
let experiment:AbortController|null=null;
// This worker owns graph and temporary model storage.
let graph:LoadedGraph|null=null;
let loading=false;
self.onmessage=async(event:MessageEvent<{type:'load';catalog:GraphCatalog;base:string;identity:string}|{type:'inspect'}|{type:'experiment';suite?:ExperimentSuite}|{type:'cancel-experiment'}|{type:'diagnostic-start'|'diagnostic-step'|'diagnostic-stop';id:number}>)=>{
 const message=event.data;
 if(message.type==='diagnostic-stop'){diagnostic=null;diagnosticId=message.id;return;}
 if(message.type==='diagnostic-start'||message.type==='diagnostic-step'){
  try{
   if(!graph||experiment||loading)throw Error('Graph not ready for diagnostic');
   if(message.type==='diagnostic-start'){diagnosticId=message.id;diagnostic=new NeuralDiagnostic(graph);sendDiagnostic(diagnostic.initial());}
   else if(message.id===diagnosticId&&diagnostic){const frame=diagnostic.step();sendDiagnostic(frame);if(frame.tick===120)diagnostic=null;}
  }catch(e){diagnostic=null;self.postMessage({type:'diagnostic-error',id:message.id,message:String(e)});}
  return;
 }
 if(message.type==='cancel-experiment'){experiment?.abort();return;}
 if(message.type==='experiment'){
  if(!graph||experiment||loading||diagnostic)return;
  const controller=new AbortController();experiment=controller;
  try{const result=await runExperiment(graph,controller.signal,(phase,completed,total)=>self.postMessage({type:'experiment-progress',phase,completed,total}),message.suite,graph);
   self.postMessage({type:'experiment-done',result});
  }catch(e){self.postMessage({type:controller.signal.aborted?'experiment-cancelled':'experiment-error',message:String(e)});}
  finally{experiment=null;}
  return;
 }
 if(message.type==='inspect'){
  self.postMessage({type:'inspection',nodes:graph?.ids.length??0,firstNeuronId:graph?.ids[0]?.toString()??null});return;
 }
 if(message.type!=='load'||loading||graph)return;
 loading=true;
 try{
  if(message.identity!==message.catalog.graph_identity)throw Error('Graph does not match loaded anatomy');
  const result=await loadGraph(message.catalog,new URL(message.base),p=>self.postMessage({type:'progress',...p}),new AbortController().signal);
  graph=result.graph;self.postMessage({type:'ready',metrics:result.metrics});
 }catch(e){graph=null;self.postMessage({type:'error',message:String(e)});}finally{loading=false;}
};
