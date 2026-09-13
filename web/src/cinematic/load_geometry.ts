import type {BrainGeometry} from '../../../brain/include/types';
import {decodeGeometry} from '../brain/geometry';

/**
 * Load measured MaleCNS geometry for the cinematic.
 * Resolves connectome assets from the site root so /cinematic/ does not
 * look under /cinematic/connectome/. Refuses synthetic placeholder fallback.
 */
export async function loadMeasuredGeometry(): Promise<BrainGeometry> {
  const root = new URL(import.meta.env.BASE_URL, `${location.origin}/`);
  const base = new URL('connectome/', root);
  const response = await fetch(new URL('manifest.json', base), {signal: AbortSignal.timeout(10000)});
  if (!response.ok) throw Error('Measured MaleCNS geometry unavailable for cinematic');
  const geometry = await decodeGeometry(await response.json(), async a => {
    const r = await fetch(new URL(a.file, base), {signal: AbortSignal.timeout(15000)});
    if (!r.ok) throw Error('Geometry download failed');
    return r.arrayBuffer();
  });
  if (geometry.provenance !== 'MALECNS' || !geometry.measured) {
    throw Error('Cinematic refused non-measured geometry');
  }
  return geometry;
}
