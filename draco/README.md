# Draco GLTF decoder (self-hosted)

Copied from `three@0.169.0` → `examples/jsm/libs/draco/gltf/`.
Google Draco is Apache-2.0 licensed.

Self-hosted on purpose: the demo previously loaded this from
`cdn.jsdelivr.net`, which intermittently fails (`ERR_CONNECTION_CLOSED`)
and breaks every Draco-compressed GLB (player / HR / banknote).
