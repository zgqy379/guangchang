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
            cues.append((start, end, " ".join(body), sid))
    offset += durations[sid]

def write(path, rows):
    with path.open("w", encoding="utf8") as f:
        for i, (start, end, body, _sid) in enumerate(rows, 1):
            f.write(f"{i}\n{srt_time(start)} --> {srt_time(end)}\n{body}\n\n")
    print("saved", path, "cues=", len(rows))

def ass_time(ms):
    h = ms // 3600000
    m = (ms % 3600000) // 60000
    s = (ms % 60000) // 1000
    cs = (ms % 1000) // 10
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

ASS_HEAD = """[Script Info]
ScriptType: v4.00+
PlayResX: 1600
PlayResY: 900
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Microsoft YaHei,30,&H00FFFFFF,&H00FFFFFF,&H99000000,&H99000000,0,0,0,0,100,100,0,0,3,6,0,2,40,40,18,1
Style: Gate,Microsoft YaHei,30,&H00FFFFFF,&H00FFFFFF,&H99000000,&H99000000,0,0,0,0,100,100,0,0,3,6,0,2,40,40,305,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

def write_ass(path, rows):
    """角色门三句字幕抬高到主视觉暗部（MarginV=305），避开身份入口行；其余落底。"""
    gate_left = 3
    with path.open("w", encoding="utf8") as f:
        f.write(ASS_HEAD)
        for start, end, body, sid in rows:
            style = "Default"
            if sid == "m02" and gate_left > 0:
                style = "Gate"
                gate_left -= 1
            f.write(f"Dialogue: 0,{ass_time(start)},{ass_time(end)},{style},,0,0,0,,{body}\n")
    print("saved", path, "cues=", len(rows))

out = ROOT / "out/final.srt"
write(out, cues)
# 素材幕字幕：只覆盖实机画面 m02–m05，避免压住 overlay 卡片文字
asset_cues = [c for c in cues if c[3] in {"m02", "m03", "m04", "m05"}]
write(ROOT / "out/final-assets.srt", asset_cues)
write_ass(ROOT / "out/final-assets.ass", asset_cues)
print("total_ms=", offset)
