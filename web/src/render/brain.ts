import type {BrainFrame,BrainGeometry} from '../../../brain/include/types';
import {mapRateActivity,type ActivityScale} from '../brain/activity_display';
import {mapPopulationRoles} from '../brain/population_display';
import {mapActivity} from '../brain/geometry';
import {validateGeometry} from '../../../brain/core/geometry';
import type {Snapshot} from '../wasm/sim';
import type {BrainCameraState} from '../capture/camera';

export interface BrainReaction {yaw:number;pitch:number;drive:number;attack:boolean;impact:boolean;}
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
/** Renderer-only pose derived from the same match/model values already shown in the UI. */
export function brainReaction(snapshot:Snapshot,frame:BrainFrame|null,running:boolean):BrainReaction {
 const relative=clamp((snapshot.fox.x-snapshot.fly.x)/90,-1,1);
 const vertical=clamp(snapshot.fly.vy/4,-1,1);
 const motor=frame?.motor_values;
 return {yaw:.12+relative*.2,pitch:-vertical*.075,drive:running&&motor?clamp(Math.max(...motor),0,1):0,attack:!!motor&&motor[3]>.5,impact:snapshot.fox.hitlag>0||snapshot.fly.hitlag>0};
}
export class BrainRenderer {
 private gl:WebGL2RenderingContext|null;private ctx:CanvasRenderingContext2D|null=null;
 private program:WebGLProgram|null=null;private buffers:WebGLBuffer[]=[];private vao:WebGLVertexArrayObject|null=null;
 private latest:Uint8Array|null=null;private scale:ActivityScale='log';
 private populations:Uint8Array;private showPopulations=false;
 private visual:Uint8Array;private count:number;readonly mode:string;
 private visualDirty=true;
 private clearRgb:[number,number,number]=[.055,.071,.067];
 private captureCamera:BrainCameraState|null=null;
 private time=0;private yaw=.12;private pitch=0;private drive=0;private burst=0;
 private targetYaw=.12;private targetPitch=0;private targetDrive=0;private lastAttack=false;private lastImpact=false;private playing=false;
 constructor(private canvas:HTMLCanvasElement,private geometry:BrainGeometry,private continuous=false,private pixelRatioCap=2){
  validateGeometry(geometry);this.count=geometry.positions.length/3;this.visual=new Uint8Array(this.count);this.populations=new Uint8Array(this.count);
  this.gl=canvas.getContext('webgl2',{alpha:false,antialias:false});this.mode=this.gl?'WebGL2':'Canvas fallback';
  if(!this.gl){this.ctx=canvas.getContext('2d');if(!this.ctx)throw Error('No compatible drawing context');return;}
  const gl=this.gl;
  const shader=(type:number,source:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)||'Shader error');return s;};
  const vs=shader(gl.VERTEX_SHADER,`#version 300 es
  precision highp float;in vec3 position;in float activity;in float population;uniform bool showPopulations;uniform float aspect;uniform float pixel;uniform float drive;uniform float burst;uniform float cameraYaw;uniform float cameraPitch;uniform float cameraZoom;uniform vec2 cameraPan;out float a;out float role;void main(){vec3 p=position;float cy=cos(cameraYaw),sy=sin(cameraYaw);p.xz=vec2(p.x*cy+p.z*sy,-p.x*sy+p.z*cy);float cp=cos(cameraPitch),sp=sin(cameraPitch);p.yz=vec2(p.y*cp-p.z*sp,p.y*sp+p.z*cp);p.xy=(p.xy+cameraPan)*cameraZoom;gl_Position=vec4(p.x*.91/aspect,p.y*.95,p.z*.02,1.);gl_PointSize=(showPopulations?(population>0.?3.0:1.0):(1.0+activity*(1.7+drive*.2+burst*.35)))*pixel*(.9+.1*cameraZoom);a=activity;role=population;}`);
  const fs=shader(gl.FRAGMENT_SHADER,`#version 300 es
  precision highp float;in float a;in float role;uniform bool showPopulations;uniform bool foregroundOnly;uniform bool cinematic;uniform float drive;uniform float burst;out vec4 color;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.||(foregroundOnly&&role<.5))discard;vec3 base=cinematic?mix(vec3(.13,.15,.16),vec3(.96,.96,.93),a):mix(vec3(.13,.25,.24),vec3(.74,.97,.49),a);if(cinematic&&a>.78)base=mix(base,vec3(.92,.24,.18),(a-.78)*1.35);if(showPopulations)base=role<.5?vec3(.13,.25,.24):role<1.5?vec3(.3,.8,1.):vec3(1.,.6,.3);color=vec4(base*(1.-r*.55)*(1.+a*(drive*.3+burst*.45)),1.);}`);
  this.program=gl.createProgram()!;gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program)||'Brain shader link failed');
  gl.useProgram(this.program);this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);
  const bind=(name:string,data:Float32Array|Uint8Array,size:number,type:number,normalize:boolean,usage:number)=>{const b=gl.createBuffer()!;this.buffers.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,usage);const loc=gl.getAttribLocation(this.program!,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,type,normalize,0,0);};
  bind('position',geometry.positions,3,gl.FLOAT,false,gl.STATIC_DRAW);bind('activity',this.visual,1,gl.UNSIGNED_BYTE,true,gl.DYNAMIC_DRAW);bind('population',this.populations,1,gl.UNSIGNED_BYTE,false,gl.STATIC_DRAW);
 }
 ingest(frame:BrainFrame){if(frame.version!==1)throw Error('Unsupported brain frame');this.ingestActivity(frame.activity);}
 ingestActivity(activity:Uint8Array){if(this.continuous){this.latest=activity;mapRateActivity(activity,this.geometry,this.visual,this.scale);}else mapActivity(activity,this.geometry,this.visual);this.visualDirty=true;}
 setPopulations(roles:Uint8Array){const {visual,...coverage}=mapPopulationRoles(roles,this.geometry);this.populations=visual;if(this.gl){this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.buffers[2]);this.gl.bufferData(this.gl.ARRAY_BUFFER,visual,this.gl.STATIC_DRAW);}return coverage;}
 setPopulationView(enabled:boolean){this.showPopulations=enabled;if(enabled){this.time=0;this.yaw=this.targetYaw=.12;this.pitch=this.targetPitch=0;this.drive=this.targetDrive=0;this.burst=0;}}
 syncGameplay(snapshot:Snapshot,frame:BrainFrame|null,running:boolean){
  this.playing=running&&!this.showPopulations;if(this.showPopulations)return;
  const reaction=brainReaction(snapshot,frame,running);this.targetYaw=reaction.yaw;this.targetPitch=reaction.pitch;this.targetDrive=reaction.drive;
  if((reaction.attack&&!this.lastAttack)||(reaction.impact&&!this.lastImpact))this.burst=Math.max(this.burst,reaction.impact?1.35:1);
  this.lastAttack=reaction.attack;this.lastImpact=reaction.impact;
 }
 /** Capture / cinematic: stark black plate behind measured somas. */
 setClearColor(r:number,g:number,b:number){this.clearRgb=[r,g,b];}
 setCaptureCamera(camera:BrainCameraState|null){this.captureCamera=camera;if(camera)this.canvas.style.transform='';}
 setCaptureFrame(snapshot:Snapshot,frame:BrainFrame|null,camera:BrainCameraState){
  this.captureCamera=camera;this.playing=false;this.yaw=camera.yaw;this.pitch=camera.pitch;
  this.drive=frame?clamp(Math.max(...frame.motor_values),0,1):0;
  this.burst=snapshot.fox.hitlag>0||snapshot.fly.hitlag>0?1.2:(frame?.motor_values[3]??0)>.5?.55:0;
  this.canvas.style.transform='';
 }
 clear(){this.latest=null;this.visual.fill(0);this.visualDirty=true;this.time=0;this.yaw=this.targetYaw=.12;this.pitch=this.targetPitch=0;this.drive=this.targetDrive=0;this.burst=0;this.lastAttack=false;this.lastImpact=false;this.canvas.style.transform='';}

 draw(dt:number){
  const c=this.canvas,dpr=Math.min(devicePixelRatio,this.pixelRatioCap),w=Math.round(c.clientWidth*dpr),h=Math.round(c.clientHeight*dpr);if(!w||!h)return;
  if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
  const seconds=this.playing?Math.min(Math.max(dt,0),100)/1000:0,smooth=1-Math.exp(-seconds*7);this.time+=seconds;this.yaw+=(this.targetYaw-this.yaw)*smooth;this.pitch+=(this.targetPitch-this.pitch)*smooth;this.drive+=(this.targetDrive-this.drive)*smooth;this.burst*=Math.exp(-seconds*4.8);
  const lean=this.yaw-.12,breathe=Math.sin(this.time*1.55)*.003;if(!this.captureCamera)this.canvas.style.transform=`translate3d(${(lean*18).toFixed(2)}px,${(this.pitch*36+Math.sin(this.time*.8)*1.2).toFixed(2)}px,0) rotate(${(lean*4).toFixed(2)}deg) scale(${(1+breathe+this.drive*.004+this.burst*.008).toFixed(4)})`;
  const decay=Math.pow(.9,Math.min(dt,100)/16.667);if(!this.continuous){for(let i=0;i<this.count;i++)this.visual[i]=Math.floor(this.visual[i]*decay);this.visualDirty=true;}
  const gl=this.gl;
  if(gl){gl.viewport(0,0,w,h);gl.clearColor(this.clearRgb[0],this.clearRgb[1],this.clearRgb[2],1);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(this.program);gl.bindVertexArray(this.vao);const location=(name:string)=>gl.getUniformLocation(this.program!,name),uniform=(name:string,value:number)=>gl.uniform1f(location(name),value);const cam=this.captureCamera??{yaw:.12,pitch:0,zoom:1,panX:0,panY:0,cinematic:false};uniform('aspect',w/h);uniform('pixel',dpr);uniform('drive',this.drive);uniform('burst',this.burst);uniform('cameraYaw',cam.yaw);uniform('cameraPitch',cam.pitch);uniform('cameraZoom',cam.zoom);gl.uniform2f(location('cameraPan'),cam.panX,cam.panY);if(this.visualDirty){gl.bindBuffer(gl.ARRAY_BUFFER,this.buffers[1]);gl.bufferSubData(gl.ARRAY_BUFFER,0,this.visual);this.visualDirty=false;}gl.uniform1i(location('cinematic'),Number(cam.cinematic));gl.uniform1i(location('showPopulations'),Number(this.showPopulations));gl.uniform1i(location('foregroundOnly'),0);gl.drawArrays(gl.POINTS,0,this.count);if(this.showPopulations){gl.uniform1i(location('foregroundOnly'),1);gl.drawArrays(gl.POINTS,0,this.count);}}
  else if(this.ctx){
   const ctx=this.ctx;ctx.fillStyle=`rgb(${Math.round(this.clearRgb[0]*255)},${Math.round(this.clearRgb[1]*255)},${Math.round(this.clearRgb[2]*255)})`;ctx.fillRect(0,0,w,h);
   const p=this.geometry.positions,cam=this.captureCamera??{yaw:.12,pitch:0,zoom:1,panX:0,panY:0,cinematic:false};
   for(let pass=0;pass<(this.showPopulations?2:1);pass++)for(let i=0;i<this.count;i++){
    const role=this.populations[i];if(this.showPopulations&&((pass===0&&role>0)||(pass===1&&role===0)))continue;
    const a=this.showPopulations?0:this.visual[i]/255;
    ctx.fillStyle=this.showPopulations&&role?(role===1?'#4dccff':'#ff994d'):cam.cinematic?(a>.78?`rgb(${Math.round(170+70*a)},${Math.round(75+155*(1-a))},${Math.round(72+150*(1-a))})`:`rgb(${Math.round(33+210*a)},${Math.round(38+205*a)},${Math.round(41+195*a)})`):`rgb(${Math.round(33+156*a)},${Math.round(64+183*a)},${Math.round(61+64*a)})`;
    const x=p[i*3],y=p[i*3+1],z=p[i*3+2],cy=Math.cos(cam.yaw),sy=Math.sin(cam.yaw),rx=x*cy+z*sy,rz=-x*sy+z*cy,cp=Math.cos(cam.pitch),sp=Math.sin(cam.pitch),ry=y*cp-rz*sp;
    const size=dpr*(this.showPopulations&&role?3:1+a*(1+this.drive*.2+this.burst*.35));ctx.fillRect(w/2+(rx+cam.panX)*h*.455*cam.zoom,h/2-(ry+cam.panY)*h*.475*cam.zoom,size,size);
   }
  }
 }
 dispose(){if(this.gl){this.buffers.forEach(b=>this.gl!.deleteBuffer(b));this.gl.deleteVertexArray(this.vao);this.gl.deleteProgram(this.program);}}
}
