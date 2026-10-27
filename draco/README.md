# Draco GLTF decoder (self-hosted)

Copied from `three@0.169.0` → `examples/jsm/libs/draco/gltf/`.
Google Draco is Apache-2.0 licensed.

Self-hosted on purpose: the demo previously loaded this from
`cdn.jsdelivr.net`, which intermittently fails (`ERR_CONNECTION_CLOSED`)
and breaks every Draco-compressed GLB (player / HR / banknote).

## 2026-10-28: `draco_decoder.js` (JS-only fallback) removed

`DRACOLoader.js:274` decides the decoder type:

```js
const useJS = typeof WebAssembly !== 'object' || this.decoderConfig.type === 'js'
```

The app never sets `type: 'js'` (drei `useGLTF(url, dracoPath)` leaves the
default), so the JS fallback loaded **only in browsers without WebAssembly** —
none among any 2026 evergreen browser. The file was also the sole trigger of a
recurring static-scanner false positive (its client-side `xhr.open("GET", …)`
for loading its own wasm asset pattern-matches CWE-918 "SSRF", which by
definition requires a server-side request — this code never runs server-side).

Removal effects: scanner finding gone, 512 KB lighter deployment, zero runtime
change on any WASM-capable browser. Restore it only if a WASM-less target
appears (then also re-triage the scanner finding as a documented false
positive).
