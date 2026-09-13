# Working instructions
Read /Users/gabinacode/.codex/RTK.md when available; prefix shell commands with rtk on this host.
1. Read this file and docs/PROGRESS.md before working.
2. Inspect the pinned relevant reference code before implementing Melee behavior.
3. Choose the smallest highest-priority unfinished task. Implement it and add/update meaningful tests.
4. Run focused tests, then ./scripts/verify.sh. Diagnose failures and fix them; never delete or weaken failing tests.
5. Update architecture, fidelity and scientific documentation as appropriate, and docs/PROGRESS.md before stopping.
Continue autonomously until the task works or an external blocker exists. Compilation alone is not success.
Keep simulation separate from rendering; game frames are 60 Hz. Never hide approximations.
Synthetic data must remain clearly labeled in the UI. No biological claims without processed MaleCNS data and evidence.
Players and the browser build have no Nintendo assets, ROM/ISO/RVZ, Dolphin, full decomp compilation, or HAL/DoomFly runtime dependencies. Those tools may be used offline by developers (outside the shipped tree) to inspect behavior and produce numeric/semantic fixtures that the native/WASM sim must match in-browser. Never ship disc images, ripped art/audio/character data, or make Dolphin/decomp a build or player requirement. Prefer pinning doldecomp/melee commits in docs; label any ROM-derived fixtures as such and keep source media gitignored.
No accounts or installation for players. Preserve the native CMake + Emscripten + React/Vite architecture.
