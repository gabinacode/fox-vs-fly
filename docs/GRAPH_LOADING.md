# Browser graph transport and ownership

The graph is data only. Preparing it does not enable neural dynamics or switch Fly control away from DummyBrain.

## Delivery and budgets
`brain/preprocess/package_graph.py` reads the verified generated artifact and emits lossless gzip chunks of at most 1 MiB decompressed data. Payloads use opaque `.bin` filenames so static servers do not transparently decode `.gz` files before checksum validation. Arrays preserve exact little-endian uint64 neuron IDs, uint32 CSR offsets/targets/positive weights, and six uint32 annotation-code columns: consensus_nt, predicted_nt, ground_truth, superclass, type, somaSide. Associated dictionaries are included in the graph manifest. No graph filter, pruning, quantization, or neurotransmitter sign assignment is added.

The generated package is in ignored `web/public/connectome-graph/`. Production builds include it as ordinary same-origin static assets. The source/generated graph is needed to generate this package; an already packaged copy can be verified/reused when the full offline graph is absent. Full package acquisition by developers is separate from browser play. The tiny catalog is requested on boot; graph manifests/chunks load only on **Load connectivity**. No scientific API, credentials, Python, extension, or manual file download is required by players.

Current package: 79,731,456 logical download bytes, including its manifest (~76.0 MiB), and 210,664,708 typed-array bytes (~200.9 MiB). The on-disk total may be slightly smaller due to identical chunk deduplication. Progress counts the declared bytes for sequential asset requests, not HTTP headers or cache-specific wire traffic.

Hard loader limits before allocation: 256 MiB graph arrays; 128 MiB declared download; 1 MiB manifest; 1 MiB raw chunk; 2 MiB compressed chunk; 1M nodes / 32M edges. The small JSON catalog carries counts, budgets, graph identity and a SHA-256-identified manifest. These limits are engineering budgets, not biological parameters.

## Integrity
- Packer verifies source array/dictionary SHA-256 against the processed manifest before packaging.
- Manifest is SHA-256 verified before parsing. Counts and aggregate byte sizes must match the catalog.
- Arrays have exact contiguous chunk coverage, declared dtype/length, expected keys, safe local filenames, and bounds checked before allocation.
- Every compressed chunk and decompressed chunk is SHA-256 checked, with bounded streaming reads that reject excess/truncated output.
- Full neuron ID buffer is also hashed against the identity supplied by the loaded anatomy package. The other full-array source hashes are provenance metadata; verified chunk hashes establish their browser integrity without creating a second 100 MB buffer for whole-array WebCrypto hashing.
- Completed graph validation checks exact uint64 ID ordering, CSR endpoints/monotonicity/target ordering, positive weights, annotation-code bounds, and total synaptic contacts.
- No graph is exposed as ready until all validation succeeds.

Catalog/manifest integrity is rooted in the site's own published metadata; this is not a publisher signature scheme. Same-origin deployment integrity remains the host's responsibility.

## Threads and lifecycle
The existing brain worker still computes dummy decisions. A **separate preparation worker** downloads, decompresses, validates and retains graph arrays. Large graph buffers never cross to the UI thread. It can later host the real model. The UI receives only progress and scalar metrics. Normal game ticks and rendering continue independently.

Cancel and Unload terminate the preparation worker and clear its UI metrics. This aborts pending fetches and makes its graph storage reclaimable by the browser. Late messages from old workers are ignored by identity. Failed preparation terminates the worker and offers retry. Game reset does not discard an immutable prepared graph. A page unmount terminates both owned workers.

## Measurements and interpretation
The preparation worker reports elapsed time, final structural-validation time, exact retained typed-array bytes, logical bytes downloaded, maximum simultaneously live explicit compressed+raw chunk staging, and a string neuron ID. These are not process RSS, JavaScript heap high-water marks, or a guarantee about garbage-collection timing. Browser decoder/WebCrypto internals, queued stream chunks, metadata and unreachable-but-not-yet-collected buffers are outside the explicit staging metric.

Tests cover tiny exact-ID/CSR fixtures, budgets, checksums, truncated/oversized streams, bad CSR, abort, packaging roundtrip, actual full-graph Chrome loading, gameplay during preparation, retry, cancel and unload. Timing evidence belongs in BENCHMARKS.md after the full run completes.

The loader uses standard gzip `DecompressionStream`, following the [WHATWG Compression Standard](https://compression.spec.whatwg.org/). Current Chrome is the hard target; no SharedArrayBuffer, WebGPU, or special browser flags are required.

### Browser neural experiment — 2026-09-12
The graph worker now supports an optional bounded LIF benchmark with artificial all-positive signs and index-based drive. Stop cooperatively cancels it while retaining connectivity; unload terminates the worker. Only scalar timings/progress/results reach the UI. Reset-replay traces match the headless core. The anatomy overlay and Fly controller still use DummyBrain. See NEURAL_MODEL.md for ownership, timing and interpretation limits.
