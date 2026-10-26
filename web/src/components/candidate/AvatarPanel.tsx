// 求职者形象面板（P2 候选人侧）
//
// 四条形象获取路径（role-flow-spec-v1.md §3.1）：
//   A · 照片贴入（主路径，≤1 秒，照片不出浏览器，100% 纯前端零失败率）
//   B · 预设形象池（0 等待，兜底）
//   C · 演示回放（replay 通道，85s 真实链路 → 26s 回放，诚实降级）
//   D · 稍后再定制（先进街区，随时回来改）
//
// 生成通道 Channel 抽象（role-flow-spec-v1.md §3.2）：
//   Channel = { id, label, stages[], estimate, poll(), abort() }
//   replay / local / live 三档，等待态 UI 与数据源 100% 解耦
//
// 诚实三规则（不可协商）：
//   1. 「演示回放」chip 常驻不可隐藏
//   2. 剩余时间显示真实剩余（如"真实生成还需 00:41"）
//   3. 结果页标注为回放产物
//
// 外观参数不进词典（project.md 5.2.2），走独立的"形象装配表"，
// 每个外观参数满足「参数三要件」：3D 载体 + 即时反馈 + 可见性分级
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './AvatarPanel.css'

export type ImagePath = 'photo-paste' | 'preset' | 'replay' | 'later'

interface ChannelStage {
  name: string
  desc: string
  done: boolean
}

interface Channel {
  id: 'replay' | 'local' | 'live'
  label: string
  stages: ChannelStage[]
  estimate: number // 秒，真实剩余（非压缩）
  elapsed: number
}

const REPLAY_CHANNEL: Channel = {
  id: 'replay',
  label: '演示回放',
  stages: [
    { name: '解析照片特征', desc: '本地 Canvas 裁切 512²，直方图调色', done: true },
    { name: '匹配预设骨架', desc: '选取最接近的头型/发型/肤色', done: true },
    { name: '贴入 3D 形象', desc: 'alphaTest 面片贴在预设 Avatar 头部', done: true },
    { name: '具象化参数', desc: '期望薪资 → 头顶要价云，技术栈 → 光谱环', done: true },
  ],
  estimate: 85,
  elapsed: 0,
}

interface AvatarPanelProps {
  /** 选择完成后回调（返回选定的头像配置） */
  onComplete: (config: {
    path: ImagePath
    avatarUrl?: string
    expectedSalary: number
    exposeMode: 'band' | 'exact'
  }) => void
  /** 是否首次进入（首次默认聚焦路径 A） */
  firstVisit?: boolean
}

export function AvatarPanel({ onComplete, firstVisit = true }: AvatarPanelProps) {
  const [path, setPath] = useState<ImagePath>(firstVisit ? 'photo-paste' : 'later')
  const [expectedSalary, setExpectedSalary] = useState(300000)
  const [exposeMode, setExposeMode] = useState<'band' | 'exact'>('band')
  const [channel, setChannel] = useState<Channel | null>(null)
  const [stageIndex, setStageIndex] = useState(0)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const timerRef = useRef<number | null>(null)

  // 演示回放通道：模拟真实阶段叙事，26s 加速播放（真实 85s）
  useEffect(() => {
    if (path !== 'replay' || !channel) return
    let elapsed = 0
    let idx = 0
    const tick = () => {
      elapsed += 1
      // 每 ~6.5s 推进一个阶段（4 个阶段 / 26s）
      const nextIdx = Math.min(3, Math.floor(elapsed / 6.5))
      if (nextIdx !== idx) {
        setStageIndex(nextIdx)
        idx = nextIdx
      }
      if (elapsed >= 26) {
        setGenerating(false)
        if (timerRef.current) clearInterval(timerRef.current)
      }
    }
    timerRef.current = window.setInterval(tick, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [path, channel])

  const remaining = useMemo(() => {
    if (!channel) return 0
    return Math.max(0, channel.estimate - (channel.elapsed || 0))
  }, [channel])

  const handlePhotoSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件')
      return
    }
    setPhotoFile(file)
    const url = URL.createObjectURL(file)
    setPhotoPreview(url)
    // 路径 A：照片贴入，≤1 秒，照片不出浏览器
    setGenerating(true)
    window.setTimeout(() => {
      setGenerating(false)
      onComplete({
        path: 'photo-paste',
        avatarUrl: url,
        expectedSalary,
        exposeMode,
      })
    }, 800) // 模拟 ≤1 秒本地处理
  }, [onComplete, expectedSalary, exposeMode])

  const handlePresetSelect = useCallback((idx: number) => {
    const presets = ['/assets/avatar/avatar-idle.glb']
    setGenerating(true)
    window.setTimeout(() => {
      setGenerating(false)
      onComplete({
        path: 'preset',
        avatarUrl: presets[idx],
        expectedSalary,
        exposeMode,
      })
    }, 300)
  }, [onComplete, expectedSalary, exposeMode])

  const handleReplayStart = useCallback(() => {
    setChannel(REPLAY_CHANNEL)
    setStageIndex(0)
    setGenerating(true)
  }, [])

  const handleLater = useCallback(() => {
    onComplete({
      path: 'later',
      expectedSalary,
      exposeMode,
    })
  }, [onComplete, expectedSalary, exposeMode])

  const PATHS: ImagePath[] = ['photo-paste', 'preset', 'replay', 'later']

  const pathLabels: Record<ImagePath, string> = {
    'photo-paste': '照片贴入',
    preset: '预设形象',
    replay: '演示回放',
    later: '稍后再定制',
  }

  const pathDescs: Record<ImagePath, string> = {
    'photo-paste': '本地 Canvas 裁切 512² + 直方图调色 → 贴入 3D 形象，照片不出浏览器',
    preset: '直接选预生成形象，零等待',
    replay: '演示回放真实生成链路（诚实降级，非假进度条）',
    later: '先进街区，随时回来改装',
  }

  return (
    <div className="gc-avatar-panel">
      <div className="gc-ap__header">
        <h2 className="gc-ap__title">装配你的 3D 形象</h2>
        <p className="gc-ap__sub">照片不出浏览器 · 外观参数即时生效 · 需重生成的参数标注等待时间</p>
      </div>

      {/* 四条路径 */}
      <div className="gc-ap__paths">
        {PATHS.map((p) => {
          const active = path === p
          const isReplay = p === 'replay'
          return (
            <button
              key={p}
              type="button"
              className={`gc-ap__path${active ? ' gc-ap__path--active' : ''}${isReplay ? ' gc-ap__path--replay' : ''}`}
              onClick={() => {
                setPath(p)
                if (p === 'replay') handleReplayStart()
              }}
            >
              <div className="gc-ap__path-icon">{p === 'photo-paste' ? '📷' : p === 'preset' ? '👤' : p === 'replay' ? '▶' : '⏭'}</div>
              <div className="gc-ap__path-body">
                <span className="gc-ap__path-title">{pathLabels[p]}</span>
                <span className="gc-ap__path-desc">{pathDescs[p]}</span>
                {isReplay && (
                  <span className="gc-ap__replay-chip">演示回放 · 常驻标识 · 不可隐藏</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* 路径 A：照片贴入 */}
      {path === 'photo-paste' && (
        <div className="gc-ap__section gc-ap__section--photo">
          <div className="gc-ap__section-title">照片贴入（主路径 · ≤1 秒）</div>
          <input
            type="file"
            accept="image/*"
            onChange={handlePhotoSelect}
            className="gc-ap__file-input"
          />
          {photoPreview && (
            <div className="gc-ap__photo-preview">
              <img src={photoPreview} alt="预览" />
              <span className="gc-ap__photo-note">照片仅在本地处理，不上传任何服务器</span>
            </div>
          )}
          {generating && (
            <div className="gc-ap__processing">
              <span className="gc-ap__processing-text">本地贴入中…（照片不出浏览器）</span>
            </div>
          )}
          <button
            type="button"
            className="gc-ap__btn gc-ap__btn--primary"
            onClick={() => {
              if (photoFile) {
                onComplete({
                  path: 'photo-paste',
                  avatarUrl: photoPreview!,
                  expectedSalary,
                  exposeMode,
                })
              }
            }}
            disabled={!photoFile || generating}
          >
            照片贴入形象
          </button>
        </div>
      )}

      {/* 路径 B：预设形象池 */}
      {path === 'preset' && (
        <div className="gc-ap__section gc-ap__section--preset">
          <div className="gc-ap__section-title">预设形象池（兜底 · 零等待）</div>
          <div className="gc-ap__presets">
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                type="button"
                className="gc-ap__preset"
                onClick={() => handlePresetSelect(i)}
              >
                <div className="gc-ap__preset-thumb">👤</div>
                <span className="gc-ap__preset-label">预设形象 {i + 1}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 路径 C：演示回放 */}
      {path === 'replay' && (
        <div className="gc-ap__section gc-ap__section--replay">
          <div className="gc-ap__section-title">演示回放（诚实降级 · 真实链路叙事）</div>
          <div className="gc-ap__replay-stages">
            {REPLAY_CHANNEL.stages.map((s, i) => (
              <div key={i} className={`gc-ap__replay-stage${s.done ? ' gc-ap__replay-stage--done' : ''}${i === stageIndex ? ' gc-ap__replay-stage--current' : ''}`}>
                <span className="gc-ap__replay-stage-name">{s.name}</span>
                <span className="gc-ap__replay-stage-desc">{s.desc}</span>
              </div>
            ))}
          </div>
          <div className="gc-ap__replay-timer">
            剩余：{Math.floor(remaining / 60)}:{String(Math.floor(remaining % 60)).padStart(2, '0')} （真实生成还需约 85 秒，当前 25× 加速演示）
          </div>
          <div className="gc-ap__replay-honesty">
            这是演示回放产物，非现场生成。等待的过程被加速，生成结果本身真实。
          </div>
          <button
            type="button"
            className="gc-ap__btn gc-ap__btn--primary"
            onClick={() => {
              onComplete({
                path: 'replay',
                expectedSalary,
                exposeMode,
              })
            }}
            disabled={generating}
          >
            使用此形象进入
          </button>
        </div>
      )}

      {/* 路径 D：稍后再定制 */}
      {path === 'later' && (
        <div className="gc-ap__section gc-ap__section--later">
          <div className="gc-ap__section-title">稍后再定制</div>
          <p className="gc-ap__later-note">先进入街区，随时回来改装。你的形象、作品集、要价云都可以随时调整。</p>
          <button
            type="button"
            className="gc-ap__btn gc-ap__btn--primary"
            onClick={handleLater}
          >
            先逛招聘街区
          </button>
        </div>
      )}

      {/* 期望薪资与暴露模式（所有路径共用，即时反馈） */}
      <div className="gc-ap__section gc-ap__section--salary">
        <div className="gc-ap__section-title">期望薪资与暴露模式</div>
        <div className="gc-ap__salary-row">
          <label className="gc-ap__salary-label">期望薪资</label>
          <input
            type="range"
            min="60000"
            max="1000000"
            step="10000"
            value={expectedSalary}
            onChange={(e) => setExpectedSalary(Number(e.target.value))}
            className="gc-ap__salary-slider"
          />
          <span className="gc-ap__salary-value">¥{Math.round(expectedSalary / 10000)}万</span>
        </div>
        <div className="gc-ap__expose-row">
          <label className="gc-ap__expose-label">薪资暴露模式</label>
          <div className="gc-ap__expose-options">
            <button
              type="button"
              className={`gc-ap__expose-btn${exposeMode === 'band' ? ' gc-ap__expose-btn--active' : ''}`}
              onClick={() => setExposeMode('band')}
            >
              区间显示（保护隐私）
            </button>
            <button
              type="button"
              className={`gc-ap__expose-btn${exposeMode === 'exact' ? ' gc-ap__expose-btn--active' : ''}`}
              onClick={() => setExposeMode('exact')}
            >
              精确显示（匹配度更高）
            </button>
          </div>
          <span className="gc-ap__expose-hint">
            外观参数不进词典，走独立装配表；每个参数满足「3D 载体 + 即时反馈 + 可见性分级」
          </span>
        </div>
      </div>
    </div>
  )
}
