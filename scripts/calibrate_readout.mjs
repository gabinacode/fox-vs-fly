import {graph,api,identity,makeModel} from './neural_runtime.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';
const model=await makeModel(),mapping=api.rateMapping(graph),input=new Uint32Array(model.count),responses=[];let ms=0,ticks=0;
function stimulate(signal){model.reset();input.fill(0);for(let c=0;c<6;c++)for(const i of mapping.inputs[c])input[i]=Math.round(6000*signal[c]);let values;
 for(let t=0;t<80;t++){const start=performance.now();values=model.step(input);ms+=performance.now()-start;ticks++;}
 return Array.from(mapping.outputs,i=>values[i]/65535);
}
for(let c=0;c<6;c++){const signal=Array(6).fill(0);signal[c]=1;responses.push(stimulate(signal));}
const gram=responses.map(a=>responses.map(b=>a.reduce((s,v,i)=>s+v*b[i],0))),lambda=gram.reduce((s,r,i)=>s+r[i],0)/6*1e-7;
const augmented=gram.map((r,i)=>[...r.map((v,j)=>v+(i===j?lambda:0)),...Array.from({length:6},(_,j)=>Number(i===j))]);
for(let k=0;k<6;k++){let pivot=k;for(let i=k+1;i<6;i++)if(Math.abs(augmented[i][k])>Math.abs(augmented[pivot][k]))pivot=i;[augmented[k],augmented[pivot]]=[augmented[pivot],augmented[k]];
 const divisor=augmented[k][k];assert(Math.abs(divisor)>1e-12);for(let j=0;j<12;j++)augmented[k][j]/=divisor;
 for(let i=0;i<6;i++)if(i!==k){const factor=augmented[i][k];for(let j=0;j<12;j++)augmented[i][j]-=factor*augmented[k][j];}
}
const weights=augmented.map(r=>Array.from(mapping.outputs,(_,j)=>responses.reduce((s,response,c)=>s+r[6+c]*response[j],0)));
const checks=[];for(const stimulus of [[.3,.7,0,.4,0,0],[0,0,.6,.8,0,0],[0,1,0,0,0,1],[0,0,0,0,0,0]]){
 const response=stimulate(stimulus),decoded=weights.map(w=>w.reduce((s,v,j)=>s+v*response[j],0)),error=Math.max(...decoded.map((v,i)=>Math.abs(v-stimulus[i])));checks.push({stimulus,decoded,error});assert(error<.08,`Calibration mixture error ${error}`);
}
const calibration={version:2,graph_identity:identity,outputs:[...mapping.outputs],weights};fs.mkdirSync(new URL('../web/public/neural/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('../web/public/neural/readout.json',import.meta.url),JSON.stringify(calibration));
const report={version:2,graph_identity:identity,inputCounts:mapping.inputs.map(a=>a.length),outputs:mapping.outputs.length,training:'six independent one-hot artificial stimuli, 80 model ticks each, ridge inverse',lambda,checks,meanModelMs:ms/ticks};fs.writeFileSync(new URL('../data/rate-calibration.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
