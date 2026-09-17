/** MODEL_ASSUMPTION: discrete induced-prefix scaling assays, never biological size claims. */
import type {SparseGraph} from './lif';

export const SCALING_FRACTIONS=Object.freeze([1/64,1/16,1/4,1/2,1] as const);
export const SCALING_REPLICA_COUNTS=Object.freeze([1,2,4] as const);
export const SCALING_WORKLOADS=Object.freeze([
  {name:'silent',stride:0},
  {name:'sparse',stride:100},
  {name:'dense',stride:1},
] as const);

/** Keep the first `nodeCount` CSR rows and edges whose targets stay inside that prefix. */
export function inducedPrefix(graph:SparseGraph,nodeCount:number):SparseGraph{
  const n=graph.offsets.length-1;
  if(!Number.isInteger(nodeCount)||nodeCount<=0||nodeCount>n)throw Error('Invalid prefix node count');
  if(nodeCount===n)return graph;
  const offsets=new Uint32Array(nodeCount+1);
  let edges=0;
  for(let i=0;i<nodeCount;i++){
    for(let e=graph.offsets[i];e<graph.offsets[i+1];e++)if(graph.targets[e]<nodeCount)edges++;
    offsets[i+1]=edges;
  }
  const targets=new Uint32Array(edges),weights=new Uint32Array(edges);
  let w=0;
  for(let i=0;i<nodeCount;i++){
    for(let e=graph.offsets[i];e<graph.offsets[i+1];e++){
      const t=graph.targets[e];
      if(t<nodeCount){targets[w]=t;weights[w]=graph.weights[e];w++;}
    }
  }
  return {offsets,targets,weights};
}

export function scalingNodeCounts(totalNodes:number):number[]{
  if(!Number.isInteger(totalNodes)||totalNodes<=0)throw Error('Invalid total node count');
  const counts:number[]=[];
  for(const fraction of SCALING_FRACTIONS){
    const nodes=Math.max(1,Math.floor(totalNodes*fraction));
    if(!counts.length||counts[counts.length-1]!==nodes)counts.push(nodes);
  }
  if(counts[counts.length-1]!==totalNodes)counts.push(totalNodes);
  return counts;
}

export function driveInput(nodes:number,stride:number,amplitude:number):Int32Array{
  const input=new Int32Array(nodes);
  if(stride>0)for(let i=0;i<nodes;i+=stride)input[i]=amplitude;
  return input;
}

/** Bytes for one SparseLif instance excluding the shared CSR arrays. */
export function lifStateBytes(nodes:number):number{
  // voltage Int32 + refractory Uint16 + pending Float64 + spikes Uint32 + signs Int8
  return nodes*(4+2+8+4+1);
}

export function graphBytes(graph:SparseGraph):number{
  return graph.offsets.byteLength+graph.targets.byteLength+graph.weights.byteLength;
}

/**
 * Independent replicas each own their own state arrays while sharing one CSR.
 * Shared-graph batches would keep one CSR and N states; fully independent copies
 * would also multiply CSR bytes. This helper only models the shared-CSR case.
 */
export function sharedGraphReplicaBytes(graph:SparseGraph,replicas:number):{graphBytes:number;stateBytes:number;totalBytes:number}{
  if(!Number.isInteger(replicas)||replicas<=0)throw Error('Invalid replica count');
  const g=graphBytes(graph),state=lifStateBytes(graph.offsets.length-1)*replicas;
  return {graphBytes:g,stateBytes:state,totalBytes:g+state};
}

export function independentCopyBytes(graph:SparseGraph,replicas:number):{graphBytes:number;stateBytes:number;totalBytes:number}{
  if(!Number.isInteger(replicas)||replicas<=0)throw Error('Invalid replica count');
  const g=graphBytes(graph)*replicas,state=lifStateBytes(graph.offsets.length-1)*replicas;
  return {graphBytes:g,stateBytes:state,totalBytes:g+state};
}
