---
id: TASK-35
title: 'Build the interactive SPA sample app: chiptune composer and mixer'
status: Done
assignee:
  - '@Spark'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 20:58'
labels: []
milestone: m-6
dependencies:
  - TASK-45
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The user wants to play with a highly interactive SPA built with Lumen as soon as possible: an in-browser chiptune composer/mixer (2026-10-08). It starts now as a client-only app (views via app state) ahead of the remaining SSR work; TASK-71 moves it onto file routes and the client router once TASK-25 lands.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 examples/spa-chiptune: client-only Lumen app (lumen/vite, ssr:false style entry) with views (songs list, tracker editor, instrument editor, settings) switched via app state; NES-style 4-channel chip voices (2 pulse with duty 12.5/25/50/75%, triangle, noise) synthesized in an AudioWorklet, optional wavetable channel
- [x] #2 Tracker pattern editor (rows × channels: note, instrument, volume, effect columns) with full keyboard entry, cursor/selection, copy/paste; song arrangement (order list); effects at least arpeggio, vibrato, volume slide, duty change; instrument envelopes (volume/duty/pitch macros); transport (play song/pattern, loop, BPM/speed) with the playing row following
- [x] #3 Mixer: per-channel volume/pan/mute/solo, master, VU meters and per-channel oscilloscopes animated via requestAnimationFrame; state in store() with undo/redo; save/load song (localStorage + JSON file), export WAV via OfflineAudioContext; retro pixel UI with scoped styles and $tokens; a bundled demo song
- [x] #4 Runs in vite dev and builds; type-checks with lumen check; README; screenshots in backlog/assets; a performance note (frame times while playing with meters and scopes animating); framework bugs found are filed as tasks for their owners
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Spark (standalone worker under Lux), scope examples/spa-chiptune/** only.
1. Scaffold examples/spa-chiptune like vite-counter (lumen/vite, mount entry, tsconfig with shadow rootDirs, COOP/COEP headers for SharedArrayBuffer, worker format es).
2. Domain model (plain TS): types (Song/Pattern/Cell/Instrument/Macro/Mixer), song factory + bundled demo song, store()-backed app state, path-patch history (undo/redo, transactions, coalescing) whose patches also sync the engine, editing commands (cells, selection clear/copy/cut/paste/transpose, insert/delete row, order list, instruments), persistence (localStorage library + JSON import/export).
3. Audio: pure DSP core synth.ts (2 pulse w/ PolyBLEP + duty, 4-bit stepped triangle, 15-bit LFSR noise long/short; per-tick sequencer speed/BPM, Bxx/Dxx/Fxx; effects 0xy/1xx/2xx/3xx/4xy/Axy/Vxx; vol/arp/pitch/duty macros with loop/release; per-channel vol/pan/mute/solo + master), AudioWorklet wrapper, telemetry via SharedArrayBuffer when crossOriginIsolated else postMessage (~60 Hz), main-thread engine controller, WAV export via OfflineAudioContext + 16-bit WAV encoder. Vitest unit tests for synth/sequencer/history.
4. UI (.stsx): App shell + header transport, views via app state (tracker, instruments, songs, settings); pattern editor with overlay cursor/selection/play-row (one binding each) and keyboard-first entry; order list; channel headers with canvas scopes + VU; mixer panel; instrument editor with drawable macros; song library; settings; single rAF telemetry loop; perf monitor.
5. Retro pixel styling with $tokens palette, scoped blocks + one <style global> base, focus-visible states.
6. Verify: vite dev/build, lumen check, Playwright e2e (load, play demo, enter notes, undo, mute, export WAV, screenshots to backlog/assets/task-35-*.png, rAF frame-time measurement), README with perf note. File framework bugs as tasks for owners.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark: claimed (session spark-task35-20261008T162705Z), standalone worker under Lux; ownership examples/spa-chiptune/**.

RESUME (Spark, checkpoint requested by Lux, 2026-10-08):
State: examples/spa-chiptune is playable. Run: cd examples/spa-chiptune && pnpm dev (vite, COOP/COEP headers -> SharedArrayBuffer telemetry), open the URL, press PLAY (or Space). lumen check: no problems. vitest (pnpm test): 10/10 (synth/sequencer/history).
Works (verified in headless Chromium via a scratch Playwright script): demo song 'Lumen Quest' (4 patterns, 8 orders, 8 instruments) plays through the AudioWorklet (2 pulse PolyBLEP + duty, 4-bit triangle, LFSR noise long/short; per-tick sequencer; 0/1/2/3/4/A/B/D/F/S/V effects; vol/arp/pitch/duty macros with loop/release); SAB telemetry -> single rAF loop drives playing-row signals, VU meters (one style binding each) and canvas scopes; follow mode; keyboard entry (piano keys, hex digits, effects, note off/cut, octave/instrument), selection, transpose, copy/cut/paste, insert/delete row, undo/redo (path-patch history, cursor restore); order list editing; mixer volume/pan/mute/solo/master; instrument editor (draw macros, loop/release lanes, MML text); songs view (library in localStorage with autosave, JSON import/export, new/demo); settings (theme NES/DMG, audio info, frame stats, shortcuts); WAV export via OfflineAudioContext (implemented, not yet verified in a browser).
In progress (written, never run): tests/app.spec.ts + playwright.config.ts (dev 5193 / preview 5194). Just changed and unverified in browser: meters/scopes are now post-fader (synth.ts voice.gain/panL/panR) so mute reads silent; markOpened() so reload reopens the loaded song.
Next steps: 1) run CHIPTUNE_SHOTS=$PWD/../../backlog/assets pnpm test:e2e (fix failures; check WAV download works with a detached <a>); 2) vite build + preview check; 3) README.md with run instructions, architecture and the perf note (numbers from the e2e frame stats; scratch run showed ~0.1 ms frame work, ~55-60 FPS headless); 4) visual polish seen in screenshots: vertical fader tracks, BPM field width (now 9ch, recheck), scope midline when silent; 5) check ACs, final summary, Done.
Lumen notes (no tasks filed yet): (a) in Vitest's default node environment resolve.conditions ['browser'] alone still resolves lumen's node entry (computeds read untracked never update); needs environment happy-dom too - doc nuance for testing.md (Beacon). (b) store() has no toRaw/snapshot export and structuredClone(storeProxy) throws; app keeps the raw root to clone/post (possible runtime API gap, Spark). LUM3005/LUM2001 diagnostics were accurate and helpful.
Files: examples/spa-chiptune/** only (package.json, tsconfig.json, vite.config.ts, playwright.config.ts, index.html, .gitignore, src/{main.tsx,state.ts,editor.ts,keys.ts,frame.ts,files.ts,lens.ts,tokens.ts}, src/model/{types,song,demo,history,library,mml}.ts + tests, src/audio/{synth,worklet,engine,protocol,wav}.ts + test, src/ui/*.stsx, tests/app.spec.ts); pnpm-lock.yaml gained the new importer (deps.lock taken/released). Not committed.

Spark: resumed (session spark-20261008T203611Z), claimed. The user has uncommitted edits in src/ui/App.stsx, src/ui/Header.stsx, vite.config.ts and src/ui/prueba.md — preserved; my edits avoid those hunks.

Spark (session spark-20261008T203611Z) — finish:
- E2E: tests/app.spec.ts, 6 tests × 2 projects (vite dev on 5195; vite build + vite preview on 5196, so the build is checked too) — 12/12 green: playback with moving rows/meters/scopes + frame stats, keyboard entry/selection/transpose/undo/redo/copy/paste, mute/solo (post-fader meters read 0 when muted), WAV export (RIFF/WAVE, 52.7 s, 44.1 kHz stereo 16-bit, peak > 8000), macro drawing + MML, library save/load + reload reopens the song + DMG theme. Macro assertion made robust (drawn value 1 or 2 depending on borders). Ports moved off 5193 (islands-e2e uses it).
- Screenshots: backlog/assets/task-35-{tracker-playing,editing,instruments,songs,settings-dmg,tracker-dmg}.png (CHIPTUNE_SHOTS).
- Visual fixes from the screenshots: mixer faders were 18 px tall (inline-size in vertical-lr is the height) → vfader sized in its own writing mode, with the track; strip VU meters had width 0 (flex shrink) → flex: none; scopes now show a themed midline before audio starts and use a 96×28 canvas (the 112×32 one was displayed at ~105 px, so pixelated downscaling dropped 1 px lines).
- Perf (README): 300 frames / 5 s at 60.0 FPS, frame work 0.10–0.13 ms avg, ≤ 0.26 ms p95, 0 slow frames (headless Chromium 153, M1 Max). Build: 82 kB JS (29 kB gzip), 9 kB worklet, 19 kB CSS.
- Lint warnings in the app fixed; oxfmt applied. lumen check clean; vitest 10/10.
- Framework findings filed: TASK-84 (store snapshot/unwrap API, Spark); TASK-54 note (Vitest needs a DOM environment, not only the browser condition). No other framework bugs found in this pass.
- Commits: 38c99e9 (fixes), 5e2f173 (README, e2e, lint/format).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Lumen Chip (examples/spa-chiptune) is complete: a client-only tracker/composer/mixer with an AudioWorklet NES synth (2 PolyBLEP pulses with duty, 4-bit triangle, LFSR noise; per-tick sequencer, effects, macros), a keyboard-first pattern editor with selection, clipboard, transpose and path-patch undo/redo, order list, instrument macro editor (drawing + MML), mixer with post-fader VU meters and canvas scopes, song library with autosave and reload restore, JSON import/export, WAV export via OfflineAudioContext, NES/DMG themes with $tokens and scoped styles.
Evidence: Playwright 12/12 (dev and vite build + preview), vitest 10/10, lumen check clean, screenshots in backlog/assets/task-35-*.png, README with run instructions and the performance note (60 FPS, ~0.1 ms frame work while playing). Optional wavetable channel not built. Follow-ups: TASK-84 (store snapshot API), TASK-72 (file routes + client router, later).
<!-- SECTION:FINAL_SUMMARY:END -->
