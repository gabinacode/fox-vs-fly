#!/usr/bin/env node
/**
 * Encode exported PNG frames to ProRes master + H.264 preview.
 * Does not delete the PNG sequence.
 */
import {access, mkdir, readdir} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, '..');
const framesDir = resolve(webRoot, 'cinematic-output/frames');
const outDir = resolve(webRoot, 'cinematic-output');

async function whichFfmpeg() {
  const r = spawnSync('ffmpeg', ['-version'], {encoding: 'utf8'});
  if (r.status === 0) return 'ffmpeg';
  return null;
}

async function main() {
  const ffmpeg = await whichFfmpeg();
  if (!ffmpeg) {
    console.error(`ffmpeg not found.

Install with Homebrew:
  brew install ffmpeg

Then re-run: npm run cinematic:video`);
    process.exit(1);
  }

  let files;
  try {
    files = (await readdir(framesDir)).filter(f => /^frame_\d{5}\.png$/.test(f)).sort();
  } catch {
    console.error(`No frames directory at ${framesDir}. Run npm run cinematic:frames first.`);
    process.exit(1);
  }
  if (files.length === 0) {
    console.error(`No frame_XXXXX.png files in ${framesDir}.`);
    process.exit(1);
  }
  await mkdir(outDir, {recursive: true});

  const pattern = join(framesDir, 'frame_%05d.png');
  const master = join(outDir, 'fox-vs-fly-brain-master.mov');
  const preview = join(outDir, 'fox-vs-fly-brain-preview.mp4');

  console.log(`Encoding ${files.length} frames…`);

  const masterArgs = [
    '-y',
    '-framerate',
    '60',
    '-i',
    pattern,
    '-c:v',
    'prores_ks',
    '-profile:v',
    '3',
    '-pix_fmt',
    'yuv422p10le',
    '-an',
    master,
  ];
  let m = spawnSync(ffmpeg, masterArgs, {stdio: 'inherit'});
  if (m.status !== 0) {
    console.warn('ProRes encode failed; trying prores (non-ks)…');
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

  // Probe fps
  const probe = spawnSync(
    ffmpeg,
    ['-i', preview],
    {encoding: 'utf8'},
  );
  const info = `${probe.stderr || ''}`;
  const fpsMatch = info.match(/(\d+(?:\.\d+)?) fps/);
  console.log(`Master:  ${master}`);
  console.log(`Preview: ${preview}`);
  if (fpsMatch) console.log(`Preview reports ${fpsMatch[1]} fps`);
  try {
    await access(master);
    await access(preview);
  } catch {
    console.error('Output files missing after encode.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
