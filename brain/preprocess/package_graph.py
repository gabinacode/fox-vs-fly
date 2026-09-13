"""Lossless, deterministic chunked transport for the retained MaleCNS graph.

Only the small catalog is requested at page boot. All files are static website
assets; no scientific API, authentication or preprocessing runs in the browser.
"""
from pathlib import Path
import gzip, hashlib, json
from package_geometry import ROOT, sha
CHUNK_BYTES = 1024 * 1024
ANNOTATIONS = ('consensus_nt', 'predicted_nt', 'ground_truth', 'superclass', 'type', 'somaSide')
CORE = ('neuron_ids', 'row_offsets', 'target_indices', 'weights')

def atomic_json(path, value):
    temporary = path.with_suffix('.partial')
    temporary.write_text(json.dumps(value, sort_keys=True, separators=(',', ':')) + '\n')
    temporary.replace(path)

def package_graph(source, destination):
    m = json.loads((source / 'manifest.json').read_text())
    if m['format'] != 'MALECNS_CSR_V2' or m['release'] != 'male-cns:v1.0':
        raise ValueError('Wrong source graph')
    annotations_path = source / m['annotations']['file']
    if not annotations_path.resolve().is_relative_to(source.resolve()) or sha(annotations_path) != m['annotations']['sha256']:
        raise ValueError('Annotation checksum mismatch')
    dictionaries = json.loads(annotations_path.read_text())
    destination.mkdir(parents=True, exist_ok=True)
    arrays = {}
    for name in CORE + tuple('annotation_' + a for a in ANNOTATIONS):
        entry = m['arrays'][name]
        path = source / entry['file']
        dtype = '<u8' if name == 'neuron_ids' else '<u4'
        length = m['edges'] if name in ('weights', 'target_indices') else m['retained_neurons'] + (name == 'row_offsets')
        if (not path.resolve().is_relative_to(source.resolve()) or entry['dtype'] != dtype
                or entry['length'] != length or entry['bytes'] != length * (8 if dtype == '<u8' else 4)
                or path.stat().st_size != entry['bytes'] or sha(path) != entry['sha256']):
            raise ValueError('Source array mismatch: ' + name)
        parts = []
        with path.open('rb') as stream:
            offset = 0
            while raw := stream.read(CHUNK_BYTES):
                compressed = gzip.compress(raw, compresslevel=6, mtime=0)
                compressed_sha = hashlib.sha256(compressed).hexdigest()
                filename = 'chunk-' + compressed_sha + '.bin'
                target = destination / filename
                if not target.exists() or sha(target) != compressed_sha:
                    tmp = target.with_suffix('.partial'); tmp.write_bytes(compressed); tmp.replace(target)
                parts.append({'file': filename, 'offset': offset, 'raw_bytes': len(raw),
                              'bytes': len(compressed), 'sha256': compressed_sha,
                              'raw_sha256': hashlib.sha256(raw).hexdigest()})
                offset += len(raw)
        arrays[name] = {'dtype': dtype, 'length': length, 'bytes': entry['bytes'],
                        'sha256': entry['sha256'], 'chunks': parts}
    graph = {'format': 'MALECNS_GRAPH_V1', 'release': m['release'], 'nodes': m['retained_neurons'],
             'edges': m['edges'], 'synaptic_contacts': m['retained_synaptic_contacts'],
             'graph_identity': m['arrays']['neuron_ids']['sha256'],
             'license': m['license'], 'attribution': m['attribution'], 'arrays': arrays,
             'dictionaries': {a: dictionaries[a] for a in ANNOTATIONS}}
    manifest_bytes = (json.dumps(graph, sort_keys=True, separators=(',', ':')) + '\n').encode()
    manifest_sha = hashlib.sha256(manifest_bytes).hexdigest()
    filename = 'graph-' + manifest_sha + '.json'
    (destination / filename).write_bytes(manifest_bytes)
    catalog = {'format': 'MALECNS_GRAPH_CATALOG_V1', 'release': graph['release'],
               'nodes': graph['nodes'], 'edges': graph['edges'], 'graph_identity': graph['graph_identity'],
               'download_bytes': sum(c['bytes'] for a in arrays.values() for c in a['chunks']) + len(manifest_bytes),
               'array_bytes': sum(a['bytes'] for a in arrays.values()),
               'manifest': {'file': filename, 'bytes': len(manifest_bytes), 'sha256': manifest_sha}}
    atomic_json(destination / 'catalog.json', catalog)
    print(json.dumps(catalog, indent=2))
    return catalog

if __name__ == '__main__':
    source, destination = ROOT / 'data/generated', ROOT / 'web/public/connectome-graph'
    if (source / 'manifest.json').exists():
        package_graph(source, destination)
    elif (destination / 'catalog.json').exists():
        c = json.loads((destination / 'catalog.json').read_text())
        manifest_path = destination / c['manifest']['file']
        if not manifest_path.resolve().is_relative_to(destination.resolve()) or sha(manifest_path) != c['manifest']['sha256']:
            raise ValueError('Invalid packaged graph manifest')
        for a in json.loads(manifest_path.read_text())['arrays'].values():
            for part in a['chunks']:
                path = destination / part['file']
                if not path.resolve().is_relative_to(destination.resolve()) or path.stat().st_size != part['bytes'] or sha(path) != part['sha256']:
                    raise ValueError('Invalid packaged graph chunk')
        print('Reusing verified packaged graph.')
    else:
        raise SystemExit('Generate data/generated first, or restore the packaged graph assets before building.')
