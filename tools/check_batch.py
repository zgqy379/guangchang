import json
import glob
import os

ok = fail = 0
for m in sorted(glob.glob('docs/iterations/lux3d-hr/2026-10-25-v2/*/meta.json')):
    d = json.load(open(m, encoding='utf-8'))
    tag = os.path.basename(os.path.dirname(m))
    st = d.get('result', '?')
    ok += st == 'success'
    fail += st != 'success'
    print(f"{tag}: {st} {round(d.get('elapsedSeconds', 0))}s")
print(f"--- 成功 {ok} / 失败 {fail}")
hr_dir = 'web/public/assets/hr'
if os.path.isdir(hr_dir):
    files = os.listdir(hr_dir)
    print(f"web/public/assets/hr: {len(files)} 个文件", files[:4])
else:
    print("web/public/assets/hr 不存在")
