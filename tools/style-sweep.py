# 风格锦标赛 tokens 补丁工具（零 subprocess——纯 JSON 操作）
# 用法：
#   python tools/style-sweep.py toon     # 应用 toon 变体
#   python tools/style-sweep.py blue     # 应用 blue 变体
#   python tools/style-sweep.py restore  # 还原基线
# 编排（tokens → build → shoot）由调用方逐步执行；还原后 git diff design/tokens.json 必须为空
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOK = ROOT / 'web' / 'design' / 'tokens.json'
BACKUP = ROOT / 'web' / 'design' / 'tokens.base-backup.json'


def apply_patch(toks, patch):
    for path, value in patch:
        node = toks
        keys = path.split('.')
        for k in keys[:-1]:
            node = node[k]
        node[keys[-1]]['$value'] = value


PATCHES = {
    'toon': [
        ('theme.light.skyTop', '#5f92c8'),
        ('theme.light.skyMid', '#9dc0dd'),
        ('theme.light.skyHorizon', '#d3e3ef'),
        ('theme.light.ground', '#98a5b3'),
        ('theme.light.road', '#66737f'),
        ('theme.light.glassBody', '#b6d2e9'),
        ('theme.light.glassHead', '#e6eef6'),
        ('industryDay.internet', '#2f7fe8'),
        ('industryDay.finance', '#c98f14'),
        ('industryDay.manufacturing', '#e05f1f'),
        ('industryDay.culture', '#b45fd0'),
    ],
    'blue': [
        ('theme.light.skyTop', '#4d7ba8'),
        ('theme.light.skyMid', '#7d9cbb'),
        ('theme.light.skyHorizon', '#b3c9da'),
        ('theme.light.fog', '#a9c0d2'),
        ('theme.light.ground', '#8fa0b0'),
        ('theme.light.road', '#5d6b78'),
        ('theme.light.glassBody', '#c2dbe9'),
        ('theme.light.glassHead', '#dfeaf2'),
        ('twin.gridOpacityDay', 0.85),
    ],
}


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ('restore', *PATCHES):
        print(__doc__)
        sys.exit(1)
    action = sys.argv[1]
    if action == 'restore':
        if BACKUP.exists():
            shutil.copy(BACKUP, TOK)
            BACKUP.unlink()
            print('tokens.json restored from backup')
        else:
            print('no backup present')
        return
    if not BACKUP.exists():
        shutil.copy(TOK, BACKUP)
        print('baseline backed up -> tokens.base-backup.json')
    toks = json.loads(TOK.read_text(encoding='utf-8'))
    apply_patch(toks, PATCHES[action])
    TOK.write_text(json.dumps(toks, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'patched: {action}（还原 = python tools/style-sweep.py restore）')


if __name__ == '__main__':
    main()
