export interface FighterObservation { x:number; y:number; vx:number; vy:number; damage:number; grounded:number; action:number; hitstun:number; stocks:number; }
export interface Observation { tick:number; fox:FighterObservation; fly:FighterObservation; }
export interface ControllerInput { axis:number; buttons:number; }
export const SENSORY_LABELS=['Opponent left','Opponent right','Approaching','Edge proximity','Damage signal','Ground contact'] as const;
export const MOTOR_LABELS=['Left','Right','Jump','Attack','Fastfall'] as const;
export interface BrainFrame { version:1; tick:number; activity:Uint8Array; active_neuron_count:number; sensory_values:Float32Array; motor_values:Float32Array; }
export interface BrainGeometry { version:1; provenance:'SYNTHETIC_DEMO'|'MALECNS'; positions:Float32Array; neuron_count?:number; visual_indices?:Uint32Array; measured?:{graph_identity?:string;release:string; edges:number; missing:number; attribution:string}; }
