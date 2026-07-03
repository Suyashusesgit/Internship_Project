# Full Fix Tasks

## Pi Firmware
- [ ] P1: Assign `_firebase_ref` inside `main()` after FirebaseClient init
- [ ] P4: Move DSP computation to 1Hz interval (not inside 100Hz poll loop)
- [ ] P10: Extract speed + heading from GPS GPRMC sentences
- [ ] P11: Add `throttleFlags` (vcgencmd) to reading dict

## pi/firebase_client.py
- [ ] P6: Add exponential backoff to flush loop on consecutive failures

## pi/buffer.py
- [ ] P3: Add `cleanup_synced()` to delete old synced rows

## pi/connectivity.py
- [ ] P14: Add `active_interface()` helper

## Dashboard — hooks
- [ ] P2: Fix `useLiveReading.ts` query — add `where("deviceId", "==", deviceId)`

## Dashboard — pages
- [ ] P7: Add browser notification + sound alarm on critical vitals (page.tsx)
- [ ] P9: Add CSV export button to history page

## Dashboard — layout
- [ ] Update navbar subtitle to "Army Dog Telemetry"
- [ ] Update metadata title/description

## Pi — SETUP.md
- [ ] P8: Add hardware watchdog setup section
