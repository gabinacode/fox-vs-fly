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
type BrainUniforms={aspect:WebGLUniformLocation|null;pixel:WebGLUniformLocation|null;drive:WebGLUniformLocation|null;burst:WebGLUniformLocation|null;cameraYaw:WebGLUniformLocation|null;cameraPitch:WebGLUniformLocation|null;cameraRoll:WebGLUniformLocation|null;cameraZoom:WebGLUniformLocation|null;cameraPan:WebGLUniformLocation|null;cinematic:WebGLUniformLocation|null;showPopulations:WebGLUniformLocation|null;foregroundOnly:WebGLUniformLocation|null;softPoints:WebGLUniformLocation|null;};
export class BrainRenderer {
 private gl:WebGL2RenderingContext|null;private ctx:CanvasRenderingContext2D|null=null;
 private program:WebGLProgram|null=null;private buffers:WebGLBuffer[]=[];private vao:WebGLVertexArrayObject|null=null;
 private uniforms:BrainUniforms|null=null;
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
  // high-performance + no CSS canvas restyle: Chrome's ANGLE path is far more sensitive than Firefox.
  this.gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'high-performance'});this.mode=this.gl?'WebGL2':'Canvas fallback';
  if(!this.gl){this.ctx=canvas.getContext('2d');if(!this.ctx)throw Error('No compatible drawing context');return;}
  const gl=this.gl;
  const shader=(type:number,source:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)||'Shader error');return s;};
  // Interactive activity uses opaque squares (no gl_PointCoord / discard). Chrome ANGLE/Metal
  // pays tens of ms for circular discard across 139k points; Firefox does not. Soft circles stay
  // for capture/cinematic and the population foreground pass only.
  const vs=shader(gl.VERTEX_SHADER,`#version 300 es
  precision highp float;in vec3 position;in float activity;in float population;uniform bool showPopulations;uniform bool softPoints;uniform float aspect;uniform float pixel;uniform float drive;uniform float burst;uniform float cameraYaw;uniform float cameraPitch;uniform float cameraRoll;uniform float cameraZoom;uniform vec2 cameraPan;out float a;out float role;void main(){vec3 p=position;float cy=cos(cameraYaw),sy=sin(cameraYaw);p.xz=vec2(p.x*cy+p.z*sy,-p.x*sy+p.z*cy);float cp=cos(cameraPitch),sp=sin(cameraPitch);p.yz=vec2(p.y*cp-p.z*sp,p.y*sp+p.z*cp);p.xy=(p.xy+cameraPan)*cameraZoom;float cr=cos(cameraRoll),sr=sin(cameraRoll);p.xy=vec2(p.x*cr-p.y*sr,p.x*sr+p.y*cr);gl_Position=vec4(p.x*.91/aspect,p.y*.95,p.z*.02,1.);float size=showPopulations?(population>0.?3.0:1.0):(softPoints?(1.0+activity*(1.7+drive*.2+burst*.35)):(1.0+activity*(.85+drive*.12+burst*.2)));gl_PointSize=min(size*pixel*(.9+.1*cameraZoom),softPoints?8.*pixel:2.5*pixel);a=activity;role=population;}`);
  const fs=shader(gl.FRAGMENT_SHADER,`#version 300 es
  precision highp float;in float a;in float role;uniform bool showPopulations;uniform bool foregroundOnly;uniform bool cinematic;uniform bool softPoints;uniform float drive;uniform float burst;out vec4 color;void main(){if(foregroundOnly&&role<.5)discard;float edge=1.;if(softPoints){vec2 d=gl_PointCoord-.5;float r2=dot(d,d)*4.;if(r2>1.)discard;edge=1.-sqrt(r2)*.55;}vec3 base=cinematic?mix(vec3(.13,.15,.16),vec3(.96,.96,.93),a):mix(vec3(.13,.25,.24),vec3(.74,.97,.49),a);if(cinematic&&a>.78)base=mix(base,vec3(.92,.24,.18),(a-.78)*1.35);if(showPopulations)base=role<.5?vec3(.13,.25,.24):role<1.5?vec3(.3,.8,1.):vec3(1.,.6,.3);color=vec4(base*edge*(1.+a*(drive*.3+burst*.45)),1.);}`);
  this.program=gl.createProgram()!;gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program)||'Brain shader link failed');
  gl.useProgram(this.program);this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);
  const u=(name:string)=>gl.getUniformLocation(this.program!,name);
  this.uniforms={aspect:u('aspect'),pixel:u('pixel'),drive:u('drive'),burst:u('burst'),cameraYaw:u('cameraYaw'),cameraPitch:u('cameraPitch'),cameraRoll:u('cameraRoll'),cameraZoom:u('cameraZoom'),cameraPan:u('cameraPan'),cinematic:u('cinematic'),showPopulations:u('showPopulations'),foregroundOnly:u('foregroundOnly'),softPoints:u('softPoints')};
  const bind=(name:string,data:Float32Array|Uint8Array,size:number,type:number,normalize:boolean,usage:number)=>{const b=gl.createBuffer()!;this.buffers.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,usage);const loc=gl.getAttribLocation(this.program!,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,type,normalize,0,0);};
  bind('position',geometry.positions,3,gl.FLOAT,false,gl.STATIC_DRAW);bind('activity',this.visual,1,gl.UNSIGNED_BYTE,true,gl.DYNAMIC_DRAW);bind('population',this.populations,1,gl.UNSIGNED_BYTE,false,gl.STATIC_DRAW);
 }
 ingest(frame:BrainFrame){if(frame.version!==1)throw Error('Unsupported brain frame');this.ingestActivity(frame.activity);}
 ingestActivity(activity:Uint8Array){if(this.continuous){this.latest=activity;mapRateActivity(activity,this.geometry,this.visual,this.scale);}else mapActivity(activity,this.geometry,this.visual);this.visualDirty=true;}
 setPopulations(roles:Uint8Array){const {visual,...coverage}=mapPopulationRoles(roles,this.geometry);this.populations=visual;if(this.gl){this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.buffers[2]);this.gl.bufferData(this.gl.ARRAY_BUFFER,visual,this.gl.STATIC_DRAW);}return coverage;}
 setPopulationView(enabled:boolean){this.showPopulations=enabled;if(enabled){this.playing=false;this.time=0;this.yaw=this.targetYaw=.12;this.pitch=this.targetPitch=0;this.drive=this.targetDrive=0;this.burst=0;}}
 syncGameplay(snapshot:Snapshot,frame:BrainFrame|null,running:boolean){
  this.playing=running&&!this.showPopulations;if(this.showPopulations)return;
  const reaction=brainReaction(snapshot,frame,running);this.targetYaw=reaction.yaw;this.targetPitch=reaction.pitch;this.targetDrive=reaction.drive;
  if((reaction.attack&&!this.lastAttack)||(reaction.impact&&!this.lastImpact))this.burst=Math.max(this.burst,reaction.impact?1.35:1);
  this.lastAttack=reaction.attack;this.lastImpact=reaction.impact;
 }
 /** Capture / cinematic: stark black plate behind measured somas. */
 setClearColor(r:number,g:number,b:number){this.clearRgb=[r,g,b];}
 setCaptureCamera(camera:BrainCameraState|null){this.captureCamera=camera;}
 setCaptureFrame(snapshot:Snapshot,frame:BrainFrame|null,camera:BrainCameraState){
  this.captureCamera=camera;this.playing=false;this.yaw=camera.yaw;this.pitch=camera.pitch;
  this.drive=frame?clamp(Math.max(...frame.motor_values),0,1):0;
  this.burst=snapshot.fox.hitlag>0||snapshot.fly.hitlag>0?1.2:(frame?.motor_values[3]??0)>.5?.55:0;
 }
 clear(){this.latest=null;this.visual.fill(0);this.visualDirty=true;this.time=0;this.yaw=this.targetYaw=.12;this.pitch=this.targetPitch=0;this.drive=this.targetDrive=0;this.burst=0;this.lastAttack=false;this.lastImpact=false;}

 /** Presentation pose stays inside the draw path (uniforms / canvas math) — never CSS on the WebGL layer. */
 private liveCamera(){
  if(this.captureCamera)return {yaw:this.captureCamera.yaw,pitch:this.captureCamera.pitch,roll:0,zoom:this.captureCamera.zoom,panX:this.captureCamera.panX,panY:this.captureCamera.panY,cinematic:!!this.captureCamera.cinematic};
  if(this.showPopulations)return {yaw:.12,pitch:0,roll:0,zoom:1,panX:0,panY:0,cinematic:false};
  const lean=this.yaw-.12,breathe=Math.sin(this.time*1.55)*.003;
  return {
   yaw:this.yaw,pitch:this.pitch,
   roll:lean*(Math.PI/45),
   zoom:1+breathe+this.drive*.004+this.burst*.008,
   panX:lean*.035,panY:this.pitch*.07+Math.sin(this.time*.8)*.0025,
   cinematic:false,
  };
 }

 draw(dt:number){
  const c=this.canvas,dpr=Math.min(devicePixelRatio,this.pixelRatioCap),w=Math.round(c.clientWidth*dpr),h=Math.round(c.clientHeight*dpr);if(!w||!h)return;
  if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
  const seconds=this.playing?Math.min(Math.max(dt,0),100)/1000:0,smooth=1-Math.exp(-seconds*7);this.time+=seconds;this.yaw+=(this.targetYaw-this.yaw)*smooth;this.pitch+=(this.targetPitch-this.pitch)*smooth;this.drive+=(this.targetDrive-this.drive)*smooth;this.burst*=Math.exp(-seconds*4.8);
  const decay=Math.pow(.9,Math.min(dt,100)/16.667);if(!this.continuous){for(let i=0;i<this.count;i++)this.visual[i]=Math.floor(this.visual[i]*decay);this.visualDirty=true;}
  const cam=this.liveCamera(),gl=this.gl,u=this.uniforms;
  if(gl&&u){
   const soft=!!this.captureCamera||this.showPopulations;
   gl.viewport(0,0,w,h);gl.clearColor(this.clearRgb[0],this.clearRgb[1],this.clearRgb[2],1);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(this.program);gl.bindVertexArray(this.vao);gl.uniform1f(u.aspect,w/h);gl.uniform1f(u.pixel,dpr);gl.uniform1f(u.drive,this.drive);gl.uniform1f(u.burst,this.burst);gl.uniform1f(u.cameraYaw,cam.yaw);gl.uniform1f(u.cameraPitch,cam.pitch);gl.uniform1f(u.cameraRoll,cam.roll);gl.uniform1f(u.cameraZoom,cam.zoom);gl.uniform2f(u.cameraPan,cam.panX,cam.panY);if(this.visualDirty){gl.bindBuffer(gl.ARRAY_BUFFER,this.buffers[1]);gl.bufferSubData(gl.ARRAY_BUFFER,0,this.visual);this.visualDirty=false;}gl.uniform1i(u.cinematic,Number(cam.cinematic));gl.uniform1i(u.showPopulations,Number(this.showPopulations));gl.uniform1i(u.softPoints,Number(soft));gl.uniform1i(u.foregroundOnly,0);gl.drawArrays(gl.POINTS,0,this.count);if(this.showPopulations){gl.uniform1i(u.foregroundOnly,1);gl.drawArrays(gl.POINTS,0,this.count);}
  }
  else if(this.ctx){
   const ctx=this.ctx;ctx.fillStyle=`rgb(${Math.round(this.clearRgb[0]*255)},${Math.round(this.clearRgb[1]*255)},${Math.round(this.clearRgb[2]*255)})`;ctx.fillRect(0,0,w,h);
   const p=this.geometry.positions,cr=Math.cos(cam.roll),sr=Math.sin(cam.roll);
   for(let pass=0;pass<(this.showPopulations?2:1);pass++)for(let i=0;i<this.count;i++){
    const role=this.populations[i];if(this.showPopulations&&((pass===0&&role>0)||(pass===1&&role===0)))continue;
    const a=this.showPopulations?0:this.visual[i]/255;
    ctx.fillStyle=this.showPopulations&&role?(role===1?'#4dccff':'#ff994d'):cam.cinematic?(a>.78?`rgb(${Math.round(170+70*a)},${Math.round(75+155*(1-a))},${Math.round(72+150*(1-a))})`:`rgb(${Math.round(33+210*a)},${Math.round(38+205*a)},${Math.round(41+195*a)})`):`rgb(${Math.round(33+156*a)},${Math.round(64+183*a)},${Math.round(61+64*a)})`;
    const x=p[i*3],y=p[i*3+1],z=p[i*3+2],cy=Math.cos(cam.yaw),sy=Math.sin(cam.yaw),rx0=x*cy+z*sy,rz=-x*sy+z*cy,cp=Math.cos(cam.pitch),sp=Math.sin(cam.pitch),ry0=y*cp-rz*sp;
    const px=(rx0+cam.panX)*cam.zoom,py=(ry0+cam.panY)*cam.zoom,rx=px*cr-py*sr,ry=px*sr+py*cr;
    const size=dpr*(this.showPopulations&&role?3:1+a*(1+this.drive*.2+this.burst*.35));ctx.fillRect(w/2+rx*h*.455,h/2-ry*h*.475,size,size);
   }
  }
 }
 dispose(){if(this.gl){this.buffers.forEach(b=>this.gl!.deleteBuffer(b));this.gl.deleteVertexArray(this.vao);this.gl.deleteProgram(this.program);}}
}
