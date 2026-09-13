import type {BrainFrame,BrainGeometry} from '../../../brain/include/types';
import {mapActivity} from '../brain/geometry';
import {validateGeometry} from '../../../brain/core/geometry';
export class BrainRenderer {
 private gl:WebGL2RenderingContext|null;private ctx:CanvasRenderingContext2D|null=null;
 private program:WebGLProgram|null=null;private buffers:WebGLBuffer[]=[];private vao:WebGLVertexArrayObject|null=null;
 private visual:Uint8Array;private count:number;readonly mode:string;
 constructor(private canvas:HTMLCanvasElement,private geometry:BrainGeometry){
  validateGeometry(geometry);this.count=geometry.positions.length/3;this.visual=new Uint8Array(this.count);
  this.gl=canvas.getContext('webgl2',{alpha:false,antialias:false});this.mode=this.gl?'WebGL2':'Canvas fallback';
  if(!this.gl){this.ctx=canvas.getContext('2d');if(!this.ctx)throw Error('No compatible drawing context');return;}
  const gl=this.gl;
  const shader=(type:number,source:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)||'Shader error');return s;};
  const vs=shader(gl.VERTEX_SHADER,`#version 300 es
  in vec3 position;in float activity;uniform float aspect;uniform float pixel;out float a;void main(){vec3 p=position;float angle=.12;p.x=position.x*cos(angle)+position.z*sin(angle);gl_Position=vec4(p.x*.91/aspect,p.y*.95,0.,1.);gl_PointSize=(1.0+activity*1.7)*pixel;a=activity;}`);
  const fs=shader(gl.FRAGMENT_SHADER,`#version 300 es
  precision mediump float;in float a;out vec4 color;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;vec3 base=mix(vec3(.13,.25,.24),vec3(.74,.97,.49),a);color=vec4(base*(1.-r*.55),1.);}`);
  this.program=gl.createProgram()!;gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error('Brain shader link failed');
  gl.useProgram(this.program);this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);
  const bind=(name:string,data:Float32Array|Uint8Array,size:number,type:number,normalize:boolean,usage:number)=>{const b=gl.createBuffer()!;this.buffers.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,usage);const loc=gl.getAttribLocation(this.program!,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,type,normalize,0,0);};
  bind('position',geometry.positions,3,gl.FLOAT,false,gl.STATIC_DRAW);bind('activity',this.visual,1,gl.UNSIGNED_BYTE,true,gl.DYNAMIC_DRAW);
 }
 ingest(frame:BrainFrame){if(frame.version!==1)throw Error('Unsupported brain frame');this.ingestActivity(frame.activity);}
 ingestActivity(activity:Uint8Array){mapActivity(activity,this.geometry,this.visual);}
 clear(){this.visual.fill(0);}

 draw(dt:number){
  const c=this.canvas,dpr=Math.min(devicePixelRatio,2),w=Math.round(c.clientWidth*dpr),h=Math.round(c.clientHeight*dpr);if(!w||!h)return;
  if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
  const decay=Math.pow(.9,Math.min(dt,100)/16.667);for(let i=0;i<this.count;i++)this.visual[i]=Math.floor(this.visual[i]*decay);
  const gl=this.gl;
  if(gl){gl.viewport(0,0,w,h);gl.clearColor(.055,.071,.067,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(this.program);gl.bindVertexArray(this.vao);gl.uniform1f(gl.getUniformLocation(this.program!,'aspect'),w/h);gl.uniform1f(gl.getUniformLocation(this.program!,'pixel'),dpr);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffers[1]);gl.bufferSubData(gl.ARRAY_BUFFER,0,this.visual);gl.drawArrays(gl.POINTS,0,this.count);}
  else if(this.ctx){const ctx=this.ctx;ctx.fillStyle='#0e1211';ctx.fillRect(0,0,w,h);const p=this.geometry.positions;for(let i=0;i<this.count;i++){const a=this.visual[i]/255;ctx.fillStyle=a>.2?`rgba(190,244,127,${.3+a*.7})`:'#244039';ctx.fillRect(w/2+p[i*3]*h*.455,h/2-p[i*3+1]*h*.475,dpr*(1+a),dpr*(1+a));}}
 }
 dispose(){if(this.gl){this.buffers.forEach(b=>this.gl!.deleteBuffer(b));this.gl.deleteVertexArray(this.vao);this.gl.deleteProgram(this.program);}}
}
