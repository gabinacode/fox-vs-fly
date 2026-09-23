/**
 * Stable, evenly distributed-by-identity point sampling for interactive LOD.
 * The selected soma set never changes between frames, so motion does not shimmer.
 */
export function sampleBrainPointIndices(count:number,stride:number):Uint32Array|null {
  if(!Number.isSafeInteger(count)||count<0)throw new RangeError('Point count must be a non-negative integer');
  if(!Number.isSafeInteger(stride)||stride<1)throw new RangeError('Point stride must be a positive integer');
  if(stride===1||count===0)return null;
  const indices=new Uint32Array(Math.ceil(count/stride));
  let length=0;
  for(let i=0;i<count;i++){
    // Avalanche the geometry index so sampling is not correlated with neuron-ID ordering.
    let hash=(i^0x9e3779b9)>>>0;
    hash=Math.imul(hash^(hash>>>16),0x7feb352d);
    hash=Math.imul(hash^(hash>>>15),0x846ca68b);
    hash=(hash^(hash>>>16))>>>0;
    if(hash%stride===0&&length<indices.length)indices[length++]=i;
  }
  // Small inputs may miss the hash bucket; never return an empty display for a nonempty cloud.
  if(length===0)indices[length++]=0;
  return indices.subarray(0,length);
}
