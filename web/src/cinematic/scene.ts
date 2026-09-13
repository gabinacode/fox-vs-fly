import * as THREE from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type {BrainGeometry} from '../../../brain/include/types';
import type {ActivitySource} from './activity/types';
import {CinematicTimelineActivity} from './activity/cinematic_timeline';
import {
  BG,
  BLOOM_RADIUS,
  BLOOM_THRESHOLD,
  CAMERA_DISTANCE_END,
  CAMERA_DISTANCE_START,
  CAMERA_FOV,
  CAMERA_LOOK_AT,
  CAMERA_PITCH_END,
  CAMERA_PITCH_START,
  CAMERA_YAW_END_DEG,
  CAMERA_YAW_START_DEG,
  EDGE_SAMPLE_COUNT,
  FOG_FAR,
  FOG_NEAR,
  HEIGHT,
  PRODUCTION_TUNING,
  WIDTH,
  type CinematicTuning,
} from './config';
import {buildSpatialProximityEdges} from './edges';
import {cameraProgress, frameToTime, somaVisibility} from './timeline';

const POINT_VS = /* glsl */ `
uniform float uPointSize;
uniform float uBaseVisibility;
uniform float uPixelRatio;
attribute float aActivity;
attribute float aColor;
varying float vActivity;
varying float vColor;
varying float vDepth;
varying float vY;
void main() {
  vActivity = aActivity;
  vColor = aColor;
  vY = position.y;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
  float atten = uPointSize * uPixelRatio * (260.0 / max(60.0, -mv.z * 58.0));
  float boost = 1.0 + aActivity * 2.8;
  gl_PointSize = clamp(atten * boost, 1.2, 8.0);
}
`;

const POINT_FS = /* glsl */ `
precision mediump float;
uniform float uBaseVisibility;
uniform float uFogNear;
uniform float uFogFar;
varying float vActivity;
varying float vColor;
varying float vDepth;
varying float vY;
void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  float r = length(c) * 2.0;
  if (r > 1.0) discard;
  float soft = 1.0 - smoothstep(0.35, 1.0, r);

  // Gray / white cinematic palette. Keep flash energy; restrain chroma.
  // Tiny cool/warm bias only — not teal/amber/rainbow.
  float idle = uBaseVisibility * 0.48;
  float bright = clamp(idle + vActivity * (1.15 + 0.55 * vActivity), 0.0, 1.0);
  if (bright < 0.004) discard;

  float yT = clamp(vY * 0.85 + 0.5, 0.0, 1.0);
  vec3 coolGray = vec3(0.52, 0.56, 0.62);
  vec3 warmGray = vec3(0.58, 0.55, 0.52);
  vec3 bone = mix(warmGray, coolGray, yT);

  vec3 softWhite = vec3(0.88, 0.90, 0.93);
  vec3 hotWhite = vec3(1.0, 0.99, 0.97);
  // Optional restrained fight-red flash on strongest tagged clusters only.
  vec3 fight = vec3(0.95, 0.35, 0.32);

  float aMix = smoothstep(0.01, 0.28, vActivity);
  vec3 activeCol = mix(softWhite, hotWhite, smoothstep(0.35, 1.0, vActivity));
  if (vColor > 0.9 && vActivity > 0.45) {
    activeCol = mix(activeCol, fight, 0.35 * smoothstep(0.45, 0.95, vActivity));
  }

  vec3 col = mix(bone, activeCol, aMix);
  col = mix(col, hotWhite, smoothstep(0.7, 1.0, vActivity) * 0.55);

  float fog = mix(0.78, 1.0, 1.0 - smoothstep(uFogNear, uFogFar, vDepth));
  gl_FragColor = vec4(col * bright * fog, max(soft * mix(0.65, 1.0, aMix), 0.5));
}
`;

const EDGE_VS = /* glsl */ `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const EDGE_FS = /* glsl */ `
uniform float uOpacity;
void main() {
  gl_FragColor = vec4(0.72, 0.75, 0.78, uOpacity);
}
`;

export type CameraState = {
  distance: number;
  yawDeg: number;
  time: number;
  frame: number;
};

export class CinematicBrainScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly points: THREE.Points;
  private readonly activityAttr: THREE.BufferAttribute;
  private readonly colorAttr: THREE.BufferAttribute;
  private readonly activity: Float32Array;
  private readonly colorHint: Float32Array;
  private readonly pointMat: THREE.ShaderMaterial;
  private readonly edgeLines: THREE.LineSegments;
  private readonly edgeMat: THREE.ShaderMaterial;
  private activitySource: ActivitySource;
  private readonly timelineActivity: CinematicTimelineActivity;
  private tuning: CinematicTuning;
  private lastCamera: CameraState = {distance: 0, yawDeg: 0, time: 0, frame: 0};
  readonly neuronCount: number;
  readonly geometryProvenance: string;

  constructor(canvas: HTMLCanvasElement, geometry: BrainGeometry, tuning: CinematicTuning = PRODUCTION_TUNING) {
    if (geometry.provenance !== 'MALECNS') {
      throw Error('Cinematic requires measured MaleCNS geometry; refusing synthetic placeholder');
    }
    this.canvas = canvas;
    this.tuning = {...tuning};
    this.geometryProvenance = geometry.measured?.release ?? 'MALECNS';
    const positions = geometry.positions;
    this.neuronCount = positions.length / 3;
    this.activity = new Float32Array(this.neuronCount);
    this.colorHint = new Float32Array(this.neuronCount);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(BG, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(WIDTH, HEIGHT, false);
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BG);
    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, WIDTH / HEIGHT, 0.05, 24);
    this.camera.position.set(0, CAMERA_PITCH_START, CAMERA_DISTANCE_START);
    this.camera.lookAt(CAMERA_LOOK_AT.x, CAMERA_LOOK_AT.y, CAMERA_LOOK_AT.z);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.activityAttr = new THREE.BufferAttribute(this.activity, 1);
    this.activityAttr.setUsage(THREE.DynamicDrawUsage);
    this.colorAttr = new THREE.BufferAttribute(this.colorHint, 1);
    this.colorAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aActivity', this.activityAttr);
    geo.setAttribute('aColor', this.colorAttr);

    this.pointMat = new THREE.ShaderMaterial({
      vertexShader: POINT_VS,
      fragmentShader: POINT_FS,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uPointSize: {value: this.tuning.pointSize},
        uBaseVisibility: {value: 0},
        uPixelRatio: {value: 1},
        uFogNear: {value: FOG_NEAR},
        uFogFar: {value: FOG_FAR},
      },
    });
    this.points = new THREE.Points(geo, this.pointMat);
    this.scene.add(this.points);

    const edgePositions = buildSpatialProximityEdges(positions, EDGE_SAMPLE_COUNT);
    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3));
    this.edgeMat = new THREE.ShaderMaterial({
      vertexShader: EDGE_VS,
      fragmentShader: EDGE_FS,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {uOpacity: {value: this.tuning.edgeOpacity}},
    });
    this.edgeLines = new THREE.LineSegments(edgeGeo, this.edgeMat);
    this.edgeLines.visible = this.tuning.showEdges;
    this.scene.add(this.edgeLines);

    this.composer = new EffectComposer(this.renderer);
    this.composer.setSize(WIDTH, HEIGHT);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(WIDTH, HEIGHT), this.tuning.bloomStrength, BLOOM_RADIUS, BLOOM_THRESHOLD);
    this.composer.addPass(this.bloom);

    this.timelineActivity = new CinematicTimelineActivity(positions);
    this.activitySource = this.timelineActivity;
  }

  setActivitySource(source: ActivitySource) {
    this.activitySource = source;
  }

  getActivitySource() {
    return this.activitySource;
  }

  setTuning(partial: Partial<CinematicTuning>) {
    Object.assign(this.tuning, partial);
    this.pointMat.uniforms.uPointSize.value = this.tuning.pointSize;
    this.bloom.strength = this.tuning.bloomStrength;
    this.edgeMat.uniforms.uOpacity.value = this.tuning.edgeOpacity;
    this.edgeLines.visible = this.tuning.showEdges;
  }

  getTuning() {
    return {...this.tuning};
  }

  getCameraState() {
    return {...this.lastCamera};
  }

  /**
   * Deterministic absolute-frame render. Same frame ⇒ same visual state.
   * Does not use wall-clock time.
   */
  renderFrame(frameNumber: number) {
    const frame = Math.max(0, Math.floor(frameNumber));
    const time = frameToTime(frame);
    const progress = cameraProgress(time);
    const distance = THREE.MathUtils.lerp(CAMERA_DISTANCE_START, CAMERA_DISTANCE_END, progress);
    const yawDeg = THREE.MathUtils.lerp(CAMERA_YAW_START_DEG, CAMERA_YAW_END_DEG, progress);
    const pitch = THREE.MathUtils.lerp(CAMERA_PITCH_START, CAMERA_PITCH_END, progress);
    const yaw = (yawDeg * Math.PI) / 180;
    this.camera.position.set(Math.sin(yaw) * distance, pitch, Math.cos(yaw) * distance);
    this.camera.lookAt(CAMERA_LOOK_AT.x, CAMERA_LOOK_AT.y, CAMERA_LOOK_AT.z);
    this.lastCamera = {distance, yawDeg, time, frame};

    this.activitySource.fill(frame, this.activity);
    const mult = this.tuning.activityMultiplier;
    for (let i = 0; i < this.activity.length; i++) {
      let v = this.activity[i] * mult;
      if (v > 1) v = 1;
      this.activity[i] = v;
    }
    if (this.activitySource instanceof CinematicTimelineActivity) {
      this.activitySource.fillColorHint(frame, this.colorHint);
    } else {
      this.colorHint.fill(0);
    }
    this.activityAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
    this.pointMat.uniforms.uBaseVisibility.value = somaVisibility(time);

    this.composer.render();
  }

  dispose() {
    this.points.geometry.dispose();
    this.pointMat.dispose();
    this.edgeLines.geometry.dispose();
    this.edgeMat.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
