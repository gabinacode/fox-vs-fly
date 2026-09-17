#!/usr/bin/env node
/**
 * Deterministic PNG frame export for LinkedIn capture presets.
 * Drives window.__CAPTURE__.renderFrame(n) via Playwright; PNGs from canvas.toDataURL.
 *
 * Env:
 *   CAPTURE_SHOT=reveal|approach|brain-response|fly-response|impact|split
 *   FRAME / FRAME_START / FRAME_END
 *   VERIFY_DETERMINISM=1
 *   CAPTURE_PORT=5194
 */
import {chromium} from '@playwright/test';
import {createHash} from 'node:crypto';
import {mkdir, writeFile, access} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, '..');
const shot = process.env.CAPTURE_SHOT || 'reveal';
const legacyPreset=process.env.CAPTURE_PRESET||null;
const legacyView=['brain','split'].includes(process.env.CAPTURE_VIEW)?process.env.CAPTURE_VIEW:'game';
const outputName=legacyPreset?`${legacyPreset}-${legacyView}`:shot;
const outDir = resolve(webRoot, `capture-output/${outputName}/frames`);
const PORT = Number(process.env.CAPTURE_PORT || 5194);
const BASE = `http://127.0.0.1:${PORT}`;

async function wait(ms) {
  await new Promise(r => setTimeout(r, ms));
}

async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function pngSize(buf) {
  return {
    width: (buf[16] << 24) | (buf[17] << 16) | (buf[18] << 8) | buf[19],
    height: (buf[20] << 24) | (buf[21] << 16) | (buf[22] << 8) | buf[23],
  };
}

async function main() {
  const startFrame = Number(process.env.FRAME_START || 0);
  const endEnv = process.env.FRAME_END;
  const single = process.env.FRAME != null ? Number(process.env.FRAME) : null;
  const verifyDup = process.env.VERIFY_DETERMINISM === '1';

  await mkdir(outDir, {recursive: true});

  if (!(await fileExists(join(webRoot, 'dist/index.html')))) {
    console.error('Missing dist/index.html — run npm run build first.');
    process.exit(1);
  }

  const preview = spawn(
    'npm',
    ['exec', 'vite', '--', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    {
      cwd: webRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {...process.env},
    },
  );

  let previewLog = '';
  preview.stdout.on('data', d => (previewLog += d.toString()));
  preview.stderr.on('data', d => (previewLog += d.toString()));

  const cleanup = () => {
    try {
      preview.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit(130);
  });

  let ready = false;
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(`${BASE}/`);
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {
      /* retry */
    }
    await wait(500);
  }
  if (!ready) {
    cleanup();
    console.error('Vite preview failed to start.\n', previewLog);
    process.exit(1);
  }

  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    headless: true,
  });
  const page = await browser.newPage({
    viewport: {width: 1080, height: 1350},
    deviceScaleFactor: 1,
  });

  const cameraOverride = process.env.CAPTURE_CAMERA || '';
  const cameraQuery = cameraOverride ? `&camera=${encodeURIComponent(cameraOverride)}` : '';
  const url = legacyPreset
    ? `${BASE}/index.html?capture=${encodeURIComponent(legacyPreset)}&view=${legacyView}&export=1${cameraQuery}`
    : `${BASE}/capture/?shot=${encodeURIComponent(shot)}&export=1${cameraQuery}`;
  await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 180000});
  // Graph load can take ~1–2 s; wait for export API.
  await page.waitForFunction(() => window.__CAPTURE__?.ready === true, null, {timeout: 300000});

  const meta = await page.evaluate(() => {
    const a = window.__CAPTURE__;
    return {
      preset: a.preset,
      shot:a.shot,
      view: a.view,
      camera:a.camera,
      brainCamera:a.brainCamera,
      width: a.width,
      height: a.height,
      fps: a.fps,
      totalFrames: a.totalFrames,
      markers: a.markers,
      suggestedCaptureWindow: a.suggestedCaptureWindow,
      musicNote: a.musicNote,
      canvasWidth: a.getCanvas()?.width ?? 0,
      canvasHeight: a.getCanvas()?.height ?? 0,
    };
  });
  console.log(JSON.stringify(meta, null, 2));

  // First render forces canvas buffer to layout size.
  await page.evaluate(async () => {
    await window.__CAPTURE__.renderFrame(0);
  });
  const sized = await page.evaluate(() => {
    const c = window.__CAPTURE__.getCanvas();
    return {w: c?.width ?? 0, h: c?.height ?? 0, cw: c?.clientWidth ?? 0, ch: c?.clientHeight ?? 0};
  });
  if (sized.cw !== 1080 || sized.ch !== 1350) {
    throw Error(`Unexpected CSS canvas size ${sized.cw}x${sized.ch}`);
  }
  // Buffer may be 1080 or 1080*dpr; with deviceScaleFactor 1 expect 1080.
  if (sized.w !== 1080 || sized.h !== 1350) {
    console.warn(`Canvas buffer ${sized.w}x${sized.h} (expected 1080x1350); continuing if aspect matches.`);
  }

  const last = single != null ? single : endEnv != null ? Number(endEnv) : meta.totalFrames - 1;
  const first = single != null ? single : startFrame;
  if (first < 0 || last >= meta.totalFrames || first > last) throw Error(`Invalid frame range ${first}..${last}`);

  async function capture(frame) {
    const dataUrl = await page.evaluate(async f => {
      await window.__CAPTURE__.renderFrame(f);
      const c = window.__CAPTURE__.getCanvas();
      if (!c) throw Error('No capture canvas');
      return c.toDataURL('image/png');
    }, frame);
    const b64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    return Buffer.from(b64, 'base64');
  }

  for (let f = first; f <= last; f++) {
    const buf = await capture(f);
    const {width, height} = pngSize(buf);
    if (width < 1000 || height < 1000) {
      throw Error(`PNG IHDR size ${width}x${height} looks wrong (frame ${f})`);
    }
    const name = `frame_${String(f).padStart(5, '0')}.png`;
    await writeFile(join(outDir, name), buf);
    if (f === first || f === last || f % 10 === 0) {
      console.log(`wrote ${name} (${buf.length} bytes, ${width}x${height})`);
    }
    if (verifyDup && f === first) {
      const buf2 = await capture(f);
      const h1 = createHash('sha256').update(buf).digest('hex');
      const h2 = createHash('sha256').update(buf2).digest('hex');
      if (h1 !== h2) throw Error(`Determinism check failed for frame ${f}: ${h1} vs ${h2}`);
      console.log(`determinism ok frame ${f}: ${h1.slice(0, 16)}…`);
    }
  }

  await writeFile(
    join(outDir, '..', 'markers.json'),
    JSON.stringify(
      {
        preset: meta.preset,
        shot:meta.shot,
        view: meta.view,
        camera:meta.camera,
        brainCamera:meta.brainCamera,
        fps: meta.fps,
        totalFrames: meta.totalFrames,
        markers: meta.markers,
        suggestedCaptureWindow: meta.suggestedCaptureWindow,
        musicNote: meta.musicNote,
        honesty: 'Live MaleCNS V2 model activity / gameplay. No music. No baked titles.',
      },
      null,
      2,
    ) + '\n',
  );

  await browser.close();
  cleanup();
  console.log(`Done. Frames in ${outDir}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
