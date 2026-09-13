import type {BrainGeometry} from '../include/types';
/** SYNTHETIC_DEMO: ellipsoids exercise the anatomical renderer contract, not measured anatomy. */
export function placeholderGeometry(count=7200):BrainGeometry {
 if(!Number.isInteger(count)||count<11)throw Error('Invalid geometry size');
 const positions=new Float32Array(count*3);
 const lobes=[[-.46,.38,.43,.29,.23],[.46,.38,.43,.29,.23],[0,.32,.37,.3,.29],[0,-.13,.10,.30,.12],[0,-.57,.24,.35,.14]];
 for(let i=0;i<count;i++){
  const l=lobes[i%5],j=Math.floor(i/5),n=Math.ceil(count/5);
  const z=1-2*(j+.5)/n,r=Math.sqrt(1-z*z),phi=j*2.399963229728653;
  const depth=.35+.65*((i*7919%997)/997)**(1/3);
  positions[i*3]=l[0]+Math.cos(phi)*r*l[2]*depth;
  positions[i*3+1]=l[1]+z*l[3]*depth;
  positions[i*3+2]=Math.sin(phi)*r*l[4]*depth;
 }
 return {version:1,provenance:'SYNTHETIC_DEMO',positions};
}
export function validateGeometry(g:BrainGeometry){if(g.version!==1||g.positions.length%3||g.positions.length===0||g.positions.some(x=>!Number.isFinite(x)))throw Error('Invalid geometry');}
