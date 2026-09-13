#!/usr/bin/env node
/**
 * Deterministic PNG frame export for the MaleCNS brain cinematic.
 * Uses Playwright to drive window.__CINEMATIC__.renderFrame(n) — not screen recording.
 * PNGs are taken from canvas.toDataURL so resolution matches the WebGL buffer (1080×1350),
 * not the CSS layout box.
 */
import {chromium} from '@playwright/test';
import {createHash} from 'node:crypto';
import {mkdir, writeFile, access} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, '..');
const outDir = resolve(webRoot, 'cinematic-output/frames');
const PORT = Number(process.env.CINEMATIC_PORT || 5193);
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
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/cinematic/`);
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

  if (!(await fileExists(join(webRoot, 'dist/cinematic/index.html')))) {
    console.error('Missing dist/cinematic/index.html — run npm run cinematic:build first.');
    cleanup();
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

  await page.goto(`${BASE}/cinematic/index.html?export=1`, {waitUntil: 'networkidle', timeout: 120000});
  await page.waitForFunction(() => window.__CINEMATIC__?.ready === true, null, {timeout: 120000});

  const meta = await page.evaluate(() => {
    const a = window.__CINEMATIC__;
    return {
      width: a.width,
      height: a.height,
      fps: a.fps,
      totalFrames: a.totalFrames,
      neuronCount: a.neuronCount,
      geometryProvenance: a.geometryProvenance,
      activityProvenance: a.activityProvenance,
      activityDescription: a.activityDescription,
      canvasWidth: a.getCanvas().width,
      canvasHeight: a.getCanvas().height,
    };
  });

  if (meta.width !== 1080 || meta.height !== 1350 || meta.canvasWidth !== 1080 || meta.canvasHeight !== 1350) {
    throw Error(`Unexpected canvas size meta=${meta.width}x${meta.height} buffer=${meta.canvasWidth}x${meta.canvasHeight}`);
  }
  console.log(JSON.stringify(meta, null, 2));

  const last = single != null ? single : endEnv != null ? Number(endEnv) : meta.totalFrames - 1;
  const first = single != null ? single : startFrame;
  if (first < 0 || last >= meta.totalFrames || first > last) throw Error(`Invalid frame range ${first}..${last}`);

  async function capture(frame) {
    const dataUrl = await page.evaluate(async f => {
      await window.__CINEMATIC__.renderFrame(f);
      return window.__CINEMATIC__.getCanvas().toDataURL('image/png');
    }, frame);
    const b64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    return Buffer.from(b64, 'base64');
  }

  for (let f = first; f <= last; f++) {
    const buf = await capture(f);
    const {width, height} = pngSize(buf);
    if (width !== 1080 || height !== 1350) {
      throw Error(`PNG IHDR size ${width}x${height}, expected 1080x1350 (frame ${f})`);
    }
    const name = `frame_${String(f).padStart(5, '0')}.png`;
    await writeFile(join(outDir, name), buf);
    if (f === first || f === last || f % 30 === 0) {
      console.log(`wrote ${name} (${buf.length} bytes)`);
    }
    if (verifyDup && f === first) {
      const buf2 = await capture(f);
      const h1 = createHash('sha256').update(buf).digest('hex');
      const h2 = createHash('sha256').update(buf2).digest('hex');
      if (h1 !== h2) throw Error(`Determinism check failed for frame ${f}: ${h1} vs ${h2}`);
      console.log(`determinism ok frame ${f}: ${h1.slice(0, 16)}…`);
    }
  }

  await browser.close();
  cleanup();
  console.log(`Done. Frames in ${outDir}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
