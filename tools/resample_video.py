"""把可变帧率的 screencast 帧按真实时间戳重采样成 12fps，并剪掉指定时间区间。"""
import json
import shutil
from pathlib import Path

VIDEO = Path(r"E:\guangchang\docs\video")
SRC = VIDEO / "frames"
DST = VIDEO / "frames_timed"
FPS = 12

times = json.loads((VIDEO / "frames-times-v8.json").read_text())
marks = json.loads((VIDEO / "scene-marks-v8.json").read_text())
events = json.loads((VIDEO / "scene-events-v8.json").read_text())

files = sorted(SRC.glob("f_*.jpg"))
assert len(files) == len(times), (len(files), len(times))

cut_a, cut_b = events["returnClickAt"], events["streetReadyAt"]
cut_len = max(0.0, cut_b - cut_a)
print("cut %.2fs (%.2f -> %.2f)" % (cut_len, cut_a - times[0], cut_b - times[0]))


def adjusted(i: int) -> float:
    t = times[i] - times[0]
    if times[i] >= cut_b:
        t -= cut_len
    return t


kept = [i for i in range(len(files)) if not (cut_a <= times[i] < cut_b)]
print("kept", len(kept), "of", len(files))

timeline = [(i, adjusted(i)) for i in kept]
duration = timeline[-1][1]
count = int(round(duration * FPS))
print("duration %.2fs -> %d frames @ %dfps" % (duration, count, FPS))

if DST.exists():
    shutil.rmtree(DST)
DST.mkdir(parents=True)

j = 0
for k in range(count):
    target = k / FPS
    while j + 1 < len(timeline) and timeline[j + 1][1] <= target:
        j += 1
    shutil.copyfile(files[timeline[j][0]], DST / ("f_%04d.jpg" % k))

marks_out = []
for m in marks:
    t = adjusted(m["frameIndex"])
    marks_out.append({"frameIndex": int(round(t * FPS)), "label": m["label"]})
(VIDEO / "scene-marks-v8-timed.json").write_text(json.dumps(marks_out, indent=1, ensure_ascii=False))
print("marks", marks_out)
