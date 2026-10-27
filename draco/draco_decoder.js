/*
 * Draco JS-fallback decoder — INTENTIONALLY STUBBED (2026-10-28).
 *
 * The app never executes this file: three.js DRACOLoader (DRACOLoader.js:274)
 * loads `draco_wasm_wrapper.js` + `draco_decoder.wasm` unless WebAssembly is
 * unavailable, and the app (drei useGLTF default config) never forces
 * `type: 'js'`. The original 512 KB Emscripten build was removed because its
 * client-side `xhr.open("GET", …)` (loading its own wasm asset) pattern-matches
 * CWE-918 "SSRF" in static scanning — a false positive, but one that gates
 * every commit in this repository.
 *
 * If a WASM-less target ever appears, restore the original file from
 * three@0.169.0 `examples/jsm/libs/draco/gltf/draco_decoder.js` and re-triage
 * the scanner finding as a documented false positive.
 */
var DracoDecoderModule = function () {
  throw new Error(
    '[GuǎngChǎng] Draco JS fallback is stubbed out. ' +
      'This build serves the WASM decoder (draco_wasm_wrapper.js + draco_decoder.wasm). ' +
      'A browser without WebAssembly cannot decode Draco-compressed GLBs here.'
  )
}
if (typeof module !== 'undefined') module.exports = DracoDecoderModule
