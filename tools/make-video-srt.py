import json
import re
from pathlib import Path

ROOT = Path("docs/video/demo-v2")
ORDER = ["m00", "m01", "m02", "m03", "m04", "m05", "m06", "m07", "m08"]
durations = json.loads((ROOT / "audio/durations.json").read_text(encoding="utf8"))

TIME = re.compile(r"(\d+):(\d+):(\d+),(\d+)\s*-->\s*(\d+):(\d+):(\d+),(\d+)")

def to_ms(h, m, s, ms):
    return int(h) * 3600000 + int(m) * 60000 + int(s) * 1000 + int(ms)

def srt_time(ms):
    h = ms // 3600000
    m = (ms % 3600000) // 60000
    s = (ms % 60000) // 1000
    ms2 = ms % 1000
    return f"{h:02d}:{m:02d}:{s:02d},{ms2:03d}"

cues = []
offset = 0
for sid in ORDER:
    text = (ROOT / f"audio/{sid}.vtt").read_text(encoding="utf8")
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        m = TIME.search(lines[i])
        if not m:
            i += 1
            continue
        start = offset + to_ms(*m.groups()[:4])
        end = offset + to_ms(*m.groups()[4:8])
        body = []
        i += 1
        while i < len(lines) and lines[i].strip():
            body.append(lines[i].strip())
            i += 1
        if body:
            cues.append((start, end, " ".join(body)))
    offset += durations[sid]

out = ROOT / "out/final.srt"
with out.open("w", encoding="utf8") as f:
    for i, (start, end, body) in enumerate(cues, 1):
        f.write(f"{i}\n{srt_time(start)} --> {srt_time(end)}\n{body}\n\n")
print("saved", out, "cues=", len(cues), "total_ms=", offset)
