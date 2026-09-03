# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-09-03

### Fixed

- Event timeline height chain: long macros no longer push the record/play controls off-screen; only the event list scrolls, and the bottom control bar stays fixed in the viewport
- Macro list panel also scrolls internally when the list is long

### Added

- Project `CHANGELOG.md` (Keep a Changelog)

## [0.1.0] - 2026-09-01

### Added

- Mouse action recording: move track, left/right/middle/side clicks, wheel
- Playback with loop count or infinite loop
- Playback speed (0.25×–4×), start delay, and loop interval
- Record modes: overwrite or append; optional countdown before recording
- Pause / resume recording (default F11)
- Global hotkeys (customizable): record, stop, play/stop, pause, emergency stop (Esc)
- Macro list: create, rename, duplicate, delete; open / save / save as JSON
- Recent files list
- Event timeline editing: delete events, insert delay, clear, undo/redo
- Hide move events view; macro stats (duration, moves, clicks, wheels)
- System tray with show / quit; optional minimize-to-tray on close
- Single-instance lock: second launch focuses existing window and shows a toast
- Settings persistence (hotkeys, record/playback/general)
- Require administrator elevation (UAC) for reliable global input
- GitHub Actions release workflow for Windows bundles (setup.exe / msi / exe)

[0.1.1]: https://github.com/Leeable/-/releases/tag/v0.1.1
[0.1.0]: https://github.com/Leeable/-/releases/tag/v0.1.0
