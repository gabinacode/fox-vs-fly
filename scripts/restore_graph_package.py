#!/usr/bin/env python3
"""Restore ignored web/public/connectome-graph assets for builds and CI.

Pins identity to data/male-cns-v1.0.transport.json. Downloads from the public
static site (or CONNECTOME_GRAPH_BASE) when the packaged tree is absent.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'web/public/connectome-graph'
TRANSPORT = ROOT / 'data/male-cns-v1.0.transport.json'
DEFAULT_BASE = 'https://fox-vs-fly.pages.dev/connectome-graph/'
WORKERS = 8


def sha(path: Path) -> str:
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def sha_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_transport() -> dict:
    catalog = json.loads(TRANSPORT.read_text())
    if catalog.get('format') != 'MALECNS_GRAPH_CATALOG_V1':
        raise SystemExit(f'Unexpected transport catalog format in {TRANSPORT}')
    return catalog


def catalog_matches(expected: dict, actual: dict) -> bool:
    keys = ('format', 'release', 'nodes', 'edges', 'graph_identity',
            'download_bytes', 'array_bytes', 'manifest')
    return all(expected.get(k) == actual.get(k) for k in keys)


def verify_packaged(expected: dict, destination: Path) -> bool:
    catalog_path = destination / 'catalog.json'
    if not catalog_path.exists():
        return False
    catalog = json.loads(catalog_path.read_text())
    if not catalog_matches(expected, catalog):
        return False
    manifest_path = destination / catalog['manifest']['file']
    if (not manifest_path.resolve().is_relative_to(destination.resolve())
            or sha(manifest_path) != catalog['manifest']['sha256']
            or manifest_path.stat().st_size != catalog['manifest']['bytes']):
        return False
    graph = json.loads(manifest_path.read_text())
    for array in graph['arrays'].values():
        for part in array['chunks']:
            path = destination / part['file']
            if (not path.resolve().is_relative_to(destination.resolve())
                    or path.stat().st_size != part['bytes']
                    or sha(path) != part['sha256']):
                return False
    return True


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={'User-Agent': 'fox-vs-fly-ci-restore/1.0'})
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read()


def write_atomic(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.partial')
    temporary.write_bytes(data)
    temporary.replace(path)


def download_file(base: str, relative: str, expected_sha: str, expected_bytes: int, destination: Path) -> str:
    path = destination / relative
    if path.exists() and path.stat().st_size == expected_bytes and sha(path) == expected_sha:
        return relative
    data = fetch(base + relative)
    if len(data) != expected_bytes or sha_bytes(data) != expected_sha:
        raise ValueError(f'Checksum mismatch for {relative}')
    write_atomic(path, data)
    return relative


def restore(base: str | None = None) -> None:
    expected = load_transport()
    if verify_packaged(expected, DEST):
        print('Packaged connectome graph already present and matches transport lock.')
        return

    base = (base or os.environ.get('CONNECTOME_GRAPH_BASE') or DEFAULT_BASE).rstrip('/') + '/'
    print(f'Restoring packaged connectome graph from {base}')
    try:
        remote_catalog = json.loads(fetch(base + 'catalog.json').decode())
    except urllib.error.URLError as error:
        raise SystemExit(
            f'Failed to download catalog from {base}: {error}\n'
            'Generate data/generated first, or restore the packaged graph assets before building.'
        ) from error
    if not catalog_matches(expected, remote_catalog):
        raise SystemExit(
            'Remote catalog does not match data/male-cns-v1.0.transport.json; '
            'refusing to restore mismatched graph assets.'
        )

    DEST.mkdir(parents=True, exist_ok=True)
    manifest_name = expected['manifest']['file']
    download_file(base, manifest_name, expected['manifest']['sha256'],
                  expected['manifest']['bytes'], DEST)
    graph = json.loads((DEST / manifest_name).read_text())
    jobs = []
    for array in graph['arrays'].values():
        for part in array['chunks']:
            jobs.append((part['file'], part['sha256'], part['bytes']))

    failures = []
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {
            pool.submit(download_file, base, name, digest, size, DEST): name
            for name, digest, size in jobs
        }
        done = 0
        for future in as_completed(futures):
            name = futures[future]
            try:
                future.result()
                done += 1
                if done % 25 == 0 or done == len(futures):
                    print(f'  {done}/{len(futures)} chunks')
            except Exception as error:  # noqa: BLE001 — surface any download/verify failure
                failures.append(f'{name}: {error}')

    if failures:
        raise SystemExit('Graph restore failed:\n' + '\n'.join(failures[:10]))

    write_atomic(DEST / 'catalog.json',
                 (json.dumps(expected, sort_keys=True, separators=(',', ':')) + '\n').encode())
    if not verify_packaged(expected, DEST):
        raise SystemExit('Restored graph failed local verification against transport lock.')
    print(f'Restored packaged graph ({expected["download_bytes"]} logical bytes) to {DEST}')


if __name__ == '__main__':
    restore(sys.argv[1] if len(sys.argv) > 1 else None)
