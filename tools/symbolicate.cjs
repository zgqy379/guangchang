// sourcemap 符号化：node tools/symbolicate.mjs <map> <line> <col>
const fs = require('fs')
function vlqDecode(str) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const res = []
  let shift = 0, val = 0
  for (const c of str) {
    const d = chars.indexOf(c)
    if (d < 0) continue
    const cont = d & 32
    val += (d & 31) << shift
    if (cont) { shift += 5 } else {
      const neg = val & 1
      val >>= 1
      res.push(neg ? -val : val)
      val = 0; shift = 0
    }
  }
  return res
}
const [mapPath, lineS, colS] = process.argv.slice(2)
const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'))
const line = Number(lineS), col = Number(colS)
const lines = map.mappings.split(';')
if (!lines[line]) { console.log('no mappings line', line); process.exit(0) }
let cc = 0, si = 0, sl = 0, sc = 0
let best = null
for (const s of lines[line].split(',')) {
  if (!s) continue
  const d = vlqDecode(s)
  cc += d[0]
  if (d.length >= 4) { si += d[1]; sl += d[2]; sc += d[3] }
  if (cc <= col) best = { src: map.sources[si], l: sl + 1, c: sc }
  if (cc === col) break
}
console.log('symbolicated:', JSON.stringify(best, null, 1))
