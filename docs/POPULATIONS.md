# Annotation-supported population candidates

This audit prepares exact candidate memberships from measured MaleCNS v1.0 annotations. It does not assign game actions, stimulus currents or neurotransmitter signs. The source artifact retains 166,700 nodes; these six disjoint superclass selections contain 28,559 candidate nodes. They are an initial research subset, not a complete sensory/motor taxonomy.

| Exact superclass selector | Members | Positioned | Unpositioned | Related `_tbc` label, separate |
|---|---:|---:|---:|---:|
| cb_sensory | 4,868 | 0 | 4,868 | 14 |
| ol_sensory | 6,098 | 28 | 6,070 | 0 |
| vnc_sensory | 6,370 | 2 | 6,368 | 36 |
| visual_projection | 9,201 | 9,162 | 39 | 2 |
| descending_neuron | 1,314 | 1,308 | 6 | 2 |
| vnc_motor | 708 | 703 | 5 | 0 |

The first three groups are candidates for studying artificial sensory inputs because of their released sensory labels. Visual projection is retained as a separate candidate for comparison, not relabeled as primary sensory. Descending and VNC motor groups are candidates for future output studies. These annotation names alone do not establish which neurons should encode opponent location, ground contact, movement direction, jump or attack. All such assignments remain MODEL_ASSUMPTION and unimplemented.

## Findings that constrain future mappings
Most selected sensory neurons lack soma positions. A display-only population selector would therefore omit nearly all of them. Membership must use full graph indices and exact IDs; positions are optional coverage metadata only.

Soma side and root side are different source fields and are never substituted. All 4,868 cb_sensory entries lack somaSide, while rootSide contains L 1,961, R 2,494 and unknown 413. VNC sensory has only two L somaSide labels but rootSide L 3,186, R 3,170, missing 13 and unknown 1. Descending neurons have somaSide L 656, M 10, R 648 and all lack rootSide. VNC motor has somaSide L 355 and R 353, with all rootSide missing. Neither field by itself justifies left/right game motor semantics.

Class annotations expose possible narrower studies: ol_sensory contains 6,091 `visual` entries and seven missing class labels; vnc_sensory contains 1,030 `mechanosensory_proprioceptive` and 2,558 `mechanosensory_tactile` entries, among other classes. These exact labels are retained in the audit. No functional receptor, stimulus tuning or behavior is inferred. NT distributions preserve null and `unclear`; no unknown entry is assigned excitation by default.

## Reproducibility and artifact contract
`brain/preprocess/populations.py` verifies SHA-256 and layouts of every used source: exact uint64 IDs, dictionary JSON, seven annotation columns and visual indices. It rejects unordered IDs, invalid dictionary codes and invalid visual mappings. The report includes graph identity, source hashes, release/license/attribution, exact selectors, superclass inventory, all class/subclass/type/side/NT distributions and each member's graph index plus decimal-string neuron ID. Decimal strings preserve IDs beyond JavaScript's exact integer range.

The versioned [membership report](../data/male-cns-v1.0.populations.json) is 1,114,893 bytes. Related uncertain `_tbc` classes are counted separately and remain in the graph, but are not silently merged into an exact selection. No position, side, type or NT filter narrows the selected groups. Missing labels are JSON null; literal unknown labels remain literal strings.

Generate with `.venv/bin/python brain/preprocess/populations.py`. Verify exact reproducibility with `.venv/bin/python brain/preprocess/populations.py --check`, also part of `./scripts/verify.sh`. Missing source data produces an explicit check skip; it never claims regeneration validation. Fixture tests cover IDs above 2^53, missing metadata/positions, uncertainty separation, empty groups, deterministic serialization, source corruption and invalid indices. Existing full-graph validation remains separate.

The report is developer research data, not an additional browser download. Current experimental index-based signs/drive, anatomy display and DummyBrain controls are unchanged. The next mapping step must choose an explicit annotation predicate, preserve unknown-side handling, define current/output scaling and compare against disconnected and shuffled controls before any biological claim.

Canonical verification completed successfully: 59 tests (native 2, TypeScript 27, Python 17, Chrome 13), native/WASM replay, neural benchmark, full graph validation and byte-for-byte candidate report regeneration.

## Experimental annotation mapping
The worker now offers **Annotation mapping**: artificial sequential left/right visual-projection drive and normalized descending-neuron readout, with transmission-off and fixed-seed shuffled-membership controls. Exact side predicates and unknown/midline exclusions are explicit. Outputs do not control the Fly. See [POPULATION_MAPPING.md](POPULATION_MAPPING.md).
