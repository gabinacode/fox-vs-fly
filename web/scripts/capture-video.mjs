#!/usr/bin/env node
/**
 * Encode capture PNG frames to ProRes master + H.264 preview (no audio).
 */
import {access, mkdir, readdir} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, '..');
const requestedShot=process.env.CAPTURE_SHOT||'reveal';
const legacyPreset=process.env.CAPTURE_PRESET||null;
const legacyView=['brain','split'].includes(process.env.CAPTURE_VIEW)?process.env.CAPTURE_VIEW:'game';
const shot=legacyPreset?`${legacyPreset}-${legacyView}`:requestedShot;
const framesDir = resolve(webRoot, `capture-output/${shot}/frames`);
const outDir = resolve(webRoot, 'capture-output');

async function whichFfmpeg() {
  const r = spawnSync('ffmpeg', ['-version'], {encoding: 'utf8'});
  if (r.status === 0) return 'ffmpeg';
  return null;
}

async function main() {
  const ffmpeg = await whichFfmpeg();
  if (!ffmpeg) {
    console.error(`ffmpeg not found. Install with: brew install ffmpeg`);
    process.exit(1);
  }

  let files;
  try {
    files = (await readdir(framesDir)).filter(f => /^frame_\d{5}\.png$/.test(f)).sort();
  } catch {
    console.error(`No frames at ${framesDir}. Run capture:frames first.`);
    process.exit(1);
  }
  if (files.length === 0) {
    console.error(`No frame_XXXXX.png in ${framesDir}.`);
    process.exit(1);
  }
  await mkdir(outDir, {recursive: true});

  const pattern = join(framesDir, 'frame_%05d.png');
  const master = join(outDir, `capture-${shot}.mov`);
  const preview = join(outDir, `capture-${shot}.mp4`);

  console.log(`Encoding ${files.length} frames for ${shot}…`);

  let m = spawnSync(
    ffmpeg,
    ['-y', '-framerate', '60', '-i', pattern, '-c:v', 'prores_ks', '-profile:v', '3', '-pix_fmt', 'yuv422p10le', '-an', master],
    {stdio: 'inherit'},
  );
  if (m.status !== 0) {
    console.warn('ProRes ks failed; trying prores…');
    m = spawnSync(
      ffmpeg,
      ['-y', '-framerate', '60', '-i', pattern, '-c:v', 'prores', '-profile:v', '3', '-an', master],
      {stdio: 'inherit'},
    );
    if (m.status !== 0) {
      console.error('ProRes master encode failed.');
      process.exit(m.status ?? 1);
    }
  }

  const p = spawnSync(
    ffmpeg,
    [
      '-y',
      '-framerate',
      '60',
      '-i',
      pattern,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-crf',
      '15',
      '-preset',
      'slow',
      '-movflags',
      '+faststart',
      '-an',
      preview,
    ],
    {stdio: 'inherit'},
  );
  if (p.status !== 0) {
    console.error('H.264 preview encode failed.');
    process.exit(p.status ?? 1);
  }

  const probe = spawnSync(ffmpeg, ['-i', preview], {encoding: 'utf8'});
  const fpsMatch = `${probe.stderr || ''}`.match(/(\d+(?:\.\d+)?) fps/);
  console.log(`Master:  ${master}`);
  console.log(`Preview: ${preview}`);
  if (fpsMatch) console.log(`Preview reports ${fpsMatch[1]} fps`);
  await access(master);
  await access(preview);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
