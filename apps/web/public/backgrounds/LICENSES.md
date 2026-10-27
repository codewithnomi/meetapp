# Background files (F15, D073)

Everything here ships inside the app; nothing is downloaded while it runs.

| File | What | Source | Licence |
|---|---|---|---|
| `office.jpg`, `living-room.jpg`, `bookshelf.jpg`, `cafe.jpg`, `nature.jpg`, `city-view.jpg`, `calm-waves.jpg`, `soft-shapes.jpg` | The 8 background pictures (1280×720) | Drawn for MeetApp (simple generated illustrations, 2026-10-27) | MeetApp's own; no outside rights |
| `selfie_segmenter.tflite` | The model that finds the person in the picture (float16, 249 537 bytes, sha256 `191ac9529ae506ee0beefa6b2c945a172dab9d07d1e802a290a4e4038226658b`) | Google MediaPipe, `storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/` | Apache-2.0 |
| `wasm/` (added at build time, not stored in the repository) | MediaPipe's WebAssembly engine, copied by `vite.config.ts` from the installed `@mediapipe/tasks-vision` 0.10.14 | Google MediaPipe | Apache-2.0 |
