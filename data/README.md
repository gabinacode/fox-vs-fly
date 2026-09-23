# Data

Real MaleCNS v1.0 source files have been processed locally. `male-cns-v1.0.sources.json` pins exact official URLs, bytes and SHA-256 values. `male-cns-v1.0.report.json` records counts, filtering, transformations and output hashes. These small metadata files are suitable for source control.

Raw downloads (`raw/`) and full generated CSR binaries (`generated/`) are ignored and must not be committed. The full artifact is about 209 MiB. Default gameplay automatically loads its compressed graph transport (about 76 MiB) and runs the authored V2 rate controller over measured wiring. Only the explicit `?controller=dummy` route uses synthetic controller activity. Browser soma geometry is versioned under `web/public/connectome`; raw and full CSR data remain ignored.

See [MaleCNS provenance and build instructions](../docs/FLY_CONNECTOME.md) for reproducible acquisition, processing, and limitations. No EM volumes or per-synapse coordinate dumps were downloaded.

`python3 brain/preprocess/package_graph.py` packages the generated graph into ignored `web/public/connectome-graph/` (also run by npm prebuild). A clean production build requires generating this data first or restoring a packaged copy. The production site serves these chunks as static assets. Serve gzip payloads as opaque `.bin` files without a gzip Content-Encoding: decompression and checksum validation belong to the worker. `male-cns-v1.0.transport.json` records the transport catalog; see [graph loading](../docs/GRAPH_LOADING.md).
