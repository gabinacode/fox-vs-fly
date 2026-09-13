# Data

Real MaleCNS v1.0 source files have been processed locally. `male-cns-v1.0.sources.json` pins exact official URLs, bytes and SHA-256 values. `male-cns-v1.0.report.json` records counts, filtering, transformations and output hashes. These small metadata files are suitable for source control.

Raw downloads (`raw/`) and full generated CSR binaries (`generated/`) are ignored and must not be committed. The full artifact is about 209 MiB; its lossless transport is now served only when players request network preparation. Browser play now loads the compact measured soma package in web/public/connectome, while controller activity remains explicitly synthetic. The browser package is small and versioned; raw and full CSR data remain ignored.

See docs/FLY_CONNECTOME.md for reproducible acquisition/build commands, provenance and limitations. No EM volumes or per-synapse coordinate dumps were downloaded.

`python3 brain/preprocess/package_graph.py` packages the generated graph into ignored `web/public/connectome-graph/` (also run by npm prebuild). A clean production build requires generating this data first or restoring a packaged copy. Serve gzip payloads as opaque `.bin` assets without a gzip Content-Encoding: decompression and checksum validation belong to the worker. `male-cns-v1.0.transport.json` records the small transport catalog; see docs/GRAPH_LOADING.md.
