// HR 建厂五步向导（P4 争取项）
//
// project.md 4.3 建厂五步：
//   1. 公司认证（可跳过但显示代价：未认证 = 无认证铭牌 + 搜索不加权）
//   2. 上传空间照片（三档诚实降级：replay/local/live）
//   3. 填结构化参数（词典表单自动生成，滑杆只驱动建厂预览与对比页）
//   4. 预览 = 强制质量闸门（不可跳过，HR 自己先逛一遍）
//   5. 发布（生成可分享链接）
//
// 生成通道 Channel 抽象（role-flow-spec-v1.md §4.2）：
//   replay / local / live 三档，等待态 UI 与数据源 100% 解耦
//
// 诚实三规则（不可协商）：
//   1. 「演示回放」chip 常驻不可隐藏
//   2. 剩余时间显示真实剩余（如"真实生成还需 00:41"）
//   3. 结果页标注为回放产物
import { useEffect, useMemo, useRef, useState } from 'react'
import { ParamForm } from '../forms/ParamForm'
import './FactoryWizard.css'

export type FactoryStep = 'certify' | 'upload' | 'params' | 'preview' | 'publish'

interface FactoryWizardProps {
  /** 建厂完成回调（返回发布后的摊位数据） */
  onPublish: (data: {
    companyName: string
    certified: boolean
    officeScene: string
    params: Record<string, unknown>
  }) => void
  /** 是否首次进入 */
  firstVisit?: boolean
}

const STEPS: FactoryStep[] = ['certify', 'upload', 'params', 'preview', 'publish']

const STEP_LABELS: Record<FactoryStep, string> = {
  certify: '公司认证',
  upload: '空间照片',
  params: '结构化参数',
  preview: '3D 预览',
  publish: '发布摊位',
}

const STEP_DESCS: Record<FactoryStep, string> = {
  certify: '营业执照/企业邮箱 → 空间挂"已认证"铭牌',
  upload: '上传办公空间照片 → 三档诚实降级生成 3D 空间',
  params: '由词典 JSON 自动生成表单，滑杆仅驱动建厂预览',
  preview: 'HR 自己先逛一遍，调低画饼浓度',
  publish: '生成可分享链接，摊位出现在街区"新开张"位',
}

const REPLAY_CHANNEL = {
  id: 'replay' as const,
  label: '演示回放',
  stages: [
    { name: '解析空间照片', desc: 'Reality 重建底稿，语义探测工位/会议室/落地窗', done: true },
    { name: 'SpatialGen 生成', desc: '布局语义理解，生成可编辑 3D 空间', done: true },
    { name: 'Lux3D 填充', desc: '批量生成工位桌椅、绿植、会议室设备', done: true },
    { name: 'Viewer 预览', desc: '3DGS 漫游，碰撞体检测', done: true },
  ],
  estimate: 652, // 真实 652s
  elapsed: 0,
}

export function FactoryWizard({ onPublish }: FactoryWizardProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [companyName, setCompanyName] = useState('')
  const [certified, setCertified] = useState(false)
  const [officeScene, setOfficeScene] = useState('office-promptonly.spz') // 默认互联网纯文案
  const [params, setParams] = useState<Record<string, unknown>>({
    annualBaseSalary: 300000,
    salaryStructure: 14,
    equityValue: 0,
    offworkTime: 19,
    socialInsuranceBaseRatio: 'full',
  })
  const [channel, setChannel] = useState<typeof REPLAY_CHANNEL | null>(null)
  const [stageIndex, setStageIndex] = useState(0)
  const [generating, setGenerating] = useState(false)
  const timerRef = useRef<number | null>(null)

  const currentStep = STEPS[stepIndex]
  const progress = ((stepIndex) / (STEPS.length - 1)) * 100

  // 演示回放通道：652s 真实 → 26s 加速（25×）
  useEffect(() => {
    if (currentStep !== 'upload' || !channel) return
    let elapsed = 0
    let idx = 0
    const tick = () => {
      elapsed += 1
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
  }, [currentStep, channel])

  const remaining = useMemo(() => {
    if (!channel) return 0
    return Math.max(0, channel.estimate - (channel.elapsed || 0))
  }, [channel])

  const nextStep = () => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex(stepIndex + 1)
    }
  }

  const prevStep = () => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1)
    }
  }

  const handlePublish = () => {
    onPublish({
      companyName,
      certified,
      officeScene,
      params,
    })
  }

  const startReplay = () => {
    setChannel(REPLAY_CHANNEL)
    setStageIndex(0)
    setGenerating(true)
  }

  const stepLabel = STEP_LABELS[currentStep]
  const stepDesc = STEP_DESCS[currentStep]
  const isLast = stepIndex === STEPS.length - 1
  const isFirst = stepIndex === 0

  return (
    <div className="gc-factory-wizard">
      {/* 头部进度 */}
      <div className="gc-fw__header">
        <div className="gc-fw__progress">
          <div
            className="gc-fw__progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="gc-fw__step-info">
          <span className="gc-fw__step-current">{stepIndex + 1}</span>
          <span className="gc-fw__step-total">/{STEPS.length}</span>
          <span className="gc-fw__step-label">{stepLabel}</span>
        </div>
        <span className="gc-fw__step-desc">{stepDesc}</span>
      </div>

      {/* 步骤内容 */}
      <div className="gc-fw__content">
        {currentStep === 'certify' && (
          <div className="gc-fw__step certify">
            <h3>1. 公司认证</h3>
            <div className="gc-fw__field">
              <label>公司名称</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="输入公司名称"
                className="gc-fw__input"
              />
            </div>
            <div className="gc-fw__field">
              <label className="gc-fw__checkbox-label">
                <input
                  type="checkbox"
                  checked={certified}
                  onChange={(e) => setCertified(e.target.checked)}
                />
                已完成公司认证（营业执照/企业邮箱）
              </label>
              {!certified && (
                <span className="gc-fw__cert-note">
                  ⚠ 未认证：无认证铭牌，搜索不加权
                </span>
              )}
            </div>
          </div>
        )}

        {currentStep === 'upload' && (
          <div className="gc-fw__step upload">
            <h3>2. 上传办公空间照片</h3>
            <p className="gc-fw__upload-hint">
              World 重建需 ≥20 张图或视频/.insv；定点摇镜视频不可用（无平移视差），必须真实行走穿越素材
            </p>
            <div className="gc-fw__channel">
              <span className="gc-fw__channel-chip replay">演示回放 · 常驻标识</span>
              <button
                type="button"
                className="gc-fw__btn gc-fw__btn--primary"
                onClick={startReplay}
                disabled={generating}
              >
                使用演示回放（25× 加速，真实 652s → 26s）
              </button>
            </div>
            {generating && (
              <div className="gc-fw__replay-progress">
                <div className="gc-fw__replay-stages">
                  {REPLAY_CHANNEL.stages.map((s, i) => (
                    <div key={i} className={`gc-fw__replay-stage${s.done ? ' gc-fw__replay-stage--done' : ''}${i === stageIndex ? ' gc-fw__replay-stage--current' : ''}`}>
                      <span className="gc-fw__replay-stage-name">{s.name}</span>
                      <span className="gc-fw__replay-stage-desc">{s.desc}</span>
                    </div>
                  ))}
                </div>
                <div className="gc-fw__replay-timer">
                  剩余：{Math.floor(remaining / 60)}:{String(Math.floor(remaining % 60)).padStart(2, '0')} （真实生成还需 652s，当前为 25× 加速演示）
                </div>
                <div className="gc-fw__replay-honesty">
                  这是演示回放产物，非现场生成。等待的过程被加速，生成结果本身真实。
                </div>
              </div>
            )}
            <div className="gc-fw__office-select">
              <label>办公空间类型（Demo 预置）</label>
              <select
                value={officeScene}
                onChange={(e) => setOfficeScene(e.target.value)}
                className="gc-fw__select"
              >
                <option value="office-promptonly.spz">互联网 · 纯文案生成（World · SPZ 4.1MB）</option>
                <option value="finance.spz">金融 · 交易大厅（SpatialGen · SPZ 5.1MB）</option>
                <option value="manufacturing.spz">智造 · 展厅（SpatialGen · SPZ 4.0MB）</option>
                <option value="culture.spz">文创 · Loft（SpatialGen · SPZ 3.9MB）</option>
              </select>
            </div>
          </div>
        )}

        {currentStep === 'params' && (
          <div className="gc-fw__step params">
            <h3>3. 填结构化参数</h3>
            <p className="gc-fw__params-hint">
              表单由词典 JSON 自动生成，加词条零前端代码。滑杆仅驱动建厂预览与对比页，街区摊位为已发布快照。
            </p>
            <ParamForm
              side="hr"
              params={params}
              onChange={(patch) => setParams({ ...params, ...patch })}
            />
          </div>
        )}

        {currentStep === 'preview' && (
          <div className="gc-fw__step preview">
            <h3>4. 3D 预览（强制质量闸门）</h3>
            <p className="gc-fw__preview-hint">
              请先逛一遍自己的空间，确认参数具象化效果。很多 HR 在这一步会主动调低画饼浓度。
            </p>
            <div className="gc-fw__preview-placeholder">
              <div className="gc-fw__preview-icon">🏢</div>
              <div className="gc-fw__preview-text">
                点击"进入预览"进入 3D 空间漫游
              </div>
              <button
                type="button"
                className="gc-fw__btn gc-fw__btn--primary"
                onClick={() => {
                  // 进入预览模式（实际应跳转到 3D 场景）
                  alert('进入 3D 办公空间预览（实际应跳转到 OfficeViewer 场景）')
                }}
              >
                进入 3D 预览
              </button>
            </div>
          </div>
        )}

        {currentStep === 'publish' && (
          <div className="gc-fw__step publish">
            <h3>5. 发布摊位</h3>
            <div className="gc-fw__publish-summary">
              <div className="gc-fw__summary-row">
                <span>公司名称：</span>
                <span className="gc-fw__summary-value">{companyName || '(未填写)'}</span>
              </div>
              <div className="gc-fw__summary-row">
                <span>认证状态：</span>
                <span className={certified ? 'gc-fw__summary-cert' : 'gc-fw__summary-uncert'}>
                  {certified ? '已认证 · 有铭牌 · 搜索加权' : '未认证 · 无铭牌 · 搜索不加权'}
                </span>
              </div>
              <div className="gc-fw__summary-row">
                <span>办公空间：</span>
                <span className="gc-fw__summary-value">{officeScene}</span>
              </div>
              <div className="gc-fw__summary-row">
                <span>年薪 base：</span>
                <span className="gc-fw__summary-value">¥{Math.round(Number(params.annualBaseSalary) / 10000)}万</span>
              </div>
              <div className="gc-fw__summary-row">
                <span>下班时间：</span>
                <span className="gc-fw__summary-value">
                  {Math.floor(Number(params.offworkTime))}:{String(Math.round((Number(params.offworkTime) % 1) * 60)).padStart(2, '0')}
                </span>
              </div>
            </div>
            <div className="gc-fw__publish-note">
              发布后摊位将出现在街区中心「新开张」位，求职者可定向访问。
            </div>
          </div>
        )}
      </div>

      {/* 底部导航 */}
      <div className="gc-fw__footer">
        <button
          type="button"
          className="gc-fw__btn gc-fw__btn--ghost"
          onClick={prevStep}
          disabled={isFirst}
        >
          ← 上一步
        </button>
        <button
          type="button"
          className="gc-fw__btn gc-fw__btn--primary"
          onClick={isLast ? handlePublish : nextStep}
          disabled={currentStep === 'upload' && generating}
        >
          {isLast ? '发布摊位' : '下一步 →'}
        </button>
      </div>
    </div>
  )
}
