# TODO

- [x] Inspect WiZ discovery implementation (backend/scanner.py) and WiZ client expectations (backend/wiz.py).
- [x] Reproduce/understand why scan doesn't find lights (likely: WiZ discovery response parsing or wrong method/payload).
- [x] Fix WiZ scanner parsing robustness (Root-cause likely: WiZ responses aren't JSON or don't include mac under result.).
- [x] Add robustness: parse response variants, handle non-JSON responses, improve logging.
  - Added socket binding for Windows compatibility
  - Improved socket timeout handling (0.5s instead of 0.3s)
  - Enhanced response detection to recognize WiZ patterns even without valid JSON
  - Added debug logging for discovery packets and responses
- [x] Ensure /api/scan returns discovered WiZ devices and IDs consistently.
- [ ] Run backend tests (backend/test_main.py) and/or quick smoke run.

