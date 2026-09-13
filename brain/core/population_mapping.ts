/** MODEL_ASSUMPTION: lateral visual-projection drive and descending readout.
 * No game action or NT sign inference. Coordinates never participate. */
export interface MappingAnnotations {annotations:Record<string,Uint32Array>;dictionaries:Record<string,(string|null)[]>;}
export interface PopulationMapping {inputs:[Uint32Array,Uint32Array];outputs:[Uint32Array,Uint32Array];excludedInput:number;excludedOutput:number;}
export function buildPopulationMapping(data:MappingAnnotations):PopulationMapping{
 const sc=data.annotations.superclass,side=data.annotations.somaSide;
 if(!sc||!side||sc.length!==side.length)throw Error('Mapping annotation shape mismatch');
 const classes=data.dictionaries.superclass,sides=data.dictionaries.somaSide;
 if(!classes||!sides)throw Error('Missing mapping dictionaries');
 const input=[[],[]] as [number[],number[]],output=[[],[]] as [number[],number[]];let excludedInput=0,excludedOutput=0;
 for(let i=0;i<sc.length;i++){
  if(sc[i]>=classes.length||side[i]>=sides.length)throw Error('Invalid mapping code');
  const label=classes[sc[i]],s=sides[side[i]];
  if(label!=='visual_projection'&&label!=='descending_neuron')continue;
  const bucket=s==='L'?0:s==='R'?1:-1;
  if(bucket<0){if(label==='visual_projection')excludedInput++;else excludedOutput++;continue;}
  (label==='visual_projection'?input:output)[bucket as 0|1].push(i);
 }
 if([...input,...output].some(g=>g.length===0))throw Error('Empty lateral mapping population');
 return {inputs:input.map(g=>new Uint32Array(g)) as PopulationMapping['inputs'],outputs:output.map(g=>new Uint32Array(g)) as PopulationMapping['outputs'],excludedInput,excludedOutput};
}
/** Fixed seed permutation preserves sizes/disjointness, changing graph membership. */
export function shufflePopulationMapping(mapping:PopulationMapping,n:number,initialSeed=20260912):PopulationMapping{
 if(!Number.isInteger(initialSeed)||initialSeed<=0||initialSeed>0xffffffff)throw Error('Invalid shuffle seed');
 const permutation=Uint32Array.from({length:n},(_,i)=>i);let seed=initialSeed;
 for(let i=n-1;i>0;i--){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;const j=(seed>>>0)%(i+1);
  const old=permutation[i];permutation[i]=permutation[j];permutation[j]=old;}
 const remap=(groups:[Uint32Array,Uint32Array])=>groups.map(g=>Uint32Array.from(g,i=>permutation[i]).sort()) as [Uint32Array,Uint32Array];
 return {...mapping,inputs:remap(mapping.inputs),outputs:remap(mapping.outputs)};
}
export function mappedDrive(mapping:PopulationMapping,channel:0|1,current:Int32Array,amplitude:number){
 if(!Number.isInteger(amplitude)||amplitude<0||amplitude>1000)throw Error('Invalid mapped drive');
 current.fill(0);for(const i of mapping.inputs[channel])current[i]=amplitude;
}
/** Fraction of cells spiking per tick; no amplification or action threshold. */
export function mappedRates(counts:[number,number],mapping:PopulationMapping,ticks:number):[number,number]{
 if(!Number.isInteger(ticks)||ticks<=0)throw Error('Invalid readout window');
 return counts.map((count,i)=>{if(!Number.isInteger(count)||count<0||count>mapping.outputs[i].length*ticks)throw Error('Invalid spike count');
  return count/(mapping.outputs[i].length*ticks);}) as [number,number];
}
