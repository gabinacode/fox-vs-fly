/** Discrete integer LIF v1. All parameters and source signs are MODEL_ASSUMPTION.
 * Borrowed CSR arrays must remain immutable for the model lifetime. */
export interface SparseGraph { offsets:Uint32Array; targets:Uint32Array; weights:Uint32Array; }
export interface LifParameters { threshold:number; reset:number; floor:number; leakNumerator:number;
  leakDenominator:number; refractorySteps:number; gain:number; }
export const LIF_V1:Readonly<LifParameters>=Object.freeze({threshold:1000,reset:0,floor:-1000,
  leakNumerator:19,leakDenominator:20,refractorySteps:2,gain:1});
function requireValue(ok:boolean,message:string){if(!ok)throw Error(message);}
export class SparseLif {
  readonly parameters:Readonly<LifParameters>;
  private readonly voltage:Int32Array;
  private readonly refractory:Uint16Array;
  private readonly pending:Float64Array;
  private readonly spikes:Uint32Array;
  private readonly signs:Int8Array;
  private spikeCount=0;
  private ticks=0;
  readonly nodes:number;
  constructor(private readonly graph:SparseGraph,sourceSigns:Int8Array,parameters:LifParameters){
    const p=this.parameters=Object.freeze({...parameters});
    requireValue(Object.values(p).every(Number.isSafeInteger),'Parameters must be safe integers');
    requireValue(p.threshold>0&&p.threshold<=1000000&&p.floor>=-1000000&&p.floor<=p.reset
      &&p.reset<p.threshold&&p.leakDenominator>0&&p.leakDenominator<=1000000
      &&p.leakNumerator>=0&&p.leakNumerator<=p.leakDenominator
      &&p.refractorySteps>=0&&p.refractorySteps<=65535&&p.gain>=0&&p.gain<=1024,'Invalid LIF parameters');
    this.nodes=graph.offsets.length-1;const n=this.nodes;
    requireValue(n>0&&sourceSigns.length===n,'Invalid node/sign count');
    requireValue(graph.targets.length===graph.weights.length&&graph.offsets[0]===0
      &&graph.offsets[n]===graph.targets.length,'Invalid CSR endpoints');
    let contacts=0;
    for(let i=0;i<n;i++){
      requireValue(sourceSigns[i]===-1||sourceSigns[i]===0||sourceSigns[i]===1,'Signs must be explicit -1, 0 or 1');
      requireValue(graph.offsets[i]<=graph.offsets[i+1]&&graph.offsets[i+1]<=graph.targets.length,'Invalid CSR offsets');
      let previous=-1;
      for(let e=graph.offsets[i];e<graph.offsets[i+1];e++){
        requireValue(graph.targets[e]<n&&graph.targets[e]>previous&&graph.weights[e]>0,'Invalid CSR edge');
        previous=graph.targets[e];contacts+=graph.weights[e];
      }
    }
    requireValue(Number.isSafeInteger(contacts)&&contacts*Math.max(1,p.gain)<=2**40,'Graph exceeds exact accumulation budget');
    this.signs=sourceSigns.slice();this.voltage=new Int32Array(n);this.refractory=new Uint16Array(n);
    this.pending=new Float64Array(n);this.spikes=new Uint32Array(n);this.reset();
  }
  get tick(){return this.ticks;}
  get stateBytes(){return this.voltage.byteLength+this.refractory.byteLength+this.pending.byteLength+this.spikes.byteLength+this.signs.byteLength;}
  reset(){this.voltage.fill(this.parameters.reset);this.refractory.fill(0);this.pending.fill(0);this.spikes.fill(0);this.spikeCount=0;this.ticks=0;}
  /** One model tick. Input is integer current, not game controls or physical units.
   * Returned spikes borrow reusable storage and expire on the next step/reset. */
  step(input?:Int32Array):Uint32Array{
    requireValue(!input||input.length===this.nodes,'Invalid input length');
    const p=this.parameters,v=this.voltage,r=this.refractory;this.spikeCount=0;
    for(let i=0;i<this.nodes;i++){
      const current=this.pending[i]+(input?input[i]:0);this.pending[i]=0;
      if(r[i]>0){r[i]--;v[i]=p.reset;continue;}
      const next=Math.trunc(v[i]*p.leakNumerator/p.leakDenominator)+current;
      if(next>=p.threshold){v[i]=p.reset;r[i]=p.refractorySteps;this.spikes[this.spikeCount++]=i;}
      else v[i]=Math.max(p.floor,next);
    }
    // Emit only after every neuron has integrated: all edges (including autapses)
    // have exactly one tick of delay, independent of CSR index ordering.
    const {offsets,targets,weights}=this.graph;
    for(let s=0;s<this.spikeCount;s++){
      const source=this.spikes[s],gain=this.signs[source]*p.gain;if(gain===0)continue;
      for(let e=offsets[source];e<offsets[source+1];e++)this.pending[targets[e]]+=weights[e]*gain;
    }
    this.ticks++;return this.spikes.subarray(0,this.spikeCount);
  }
  /** Copies for diagnostics, never on the hot rendering path. */
  snapshot(){return {tick:this.ticks,voltage:this.voltage.slice(),refractory:this.refractory.slice(),pending:this.pending.slice()};}
}
