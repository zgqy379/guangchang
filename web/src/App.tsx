import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import {
  CompanyParams,
  defaultParams,
  totalPackage,
  yuanToStacks,
  incrementPackage,
  layerLayout,
  BILL,
  MOUNTAIN_HEIGHT_SCALE,
  MOUNTAIN_SCALE,
} from './engine/params'
import { formatValue } from './engine/dictionary'
import { HRPanel } from './components/HRPanel'
import { schrodingerCapNote } from './components/SchrodingerBills'
import type { RoamRefs } from './components/AvatarActor'

// Aholo Viewer 体积大（3DGS 渲染器），仅办公室模式按需加载
const OfficeViewer = lazy(() =>
  import('./components/OfficeViewer').then((m) => ({ default: m.OfficeViewer }))
)
// 街区场景（v1.2）：十字路口四大领域招聘街区
const StreetScene = lazy(() =>
  import('./components/street/StreetScene').then((m) => ({ default: m.StreetScene }))
)
// 作品廊场景（P3 作品廊）：独立 Canvas，与街区物理隔离
const GalleryScene = lazy(() =>
  import('./components/gallery/GalleryScene').then((m) => ({ default: m.GalleryScene }))
)
// 单场景（single/compare）用到的 3D 组件：改按需加载，避免静态 import 把它们
// （含 three 依赖）打进主 chunk。首屏 roleGate 阶段不挂任何 <Canvas>，
// 这些 chunk 也就不被请求 —— 这是首屏体积守住 5MB 红线的前提之一。
const WorkdaySky = lazy(() =>
  import('./components/WorkdaySky').then((m) => ({ default: m.WorkdaySky }))
)
const CompanyPlot = lazy(() =>
  import('./components/CompanyPlot').then((m) => ({ default: m.CompanyPlot }))
)
const RoamCamera = lazy(() =>
  import('./components/RoamCamera').then((m) => ({ default: m.RoamCamera }))
)
import { fictionalCompanies, companyById } from './data/fictional-companies'
import { STREET_LOTS, type Lot } from './data/street-companies'
import { assetUrl } from './engine/asset'
import { ColorSceneHallFloor, ColorSceneHallFloorDay } from '../generated/design-tokens.output.mjs'
import { ErrorBoundary, SceneErrorBoundary } from './state/ErrorBoundary'
import { RoleGate, type Role } from './components/role/RoleGate'
import { RoleGateGlass } from './components/role/RoleGateGlass'
import { loadRole, saveRole, loadBasket, saveBasket } from './engine/progress'
import './components/role/role-gate.css'
import './components/role/role-gate-glass.css'
import {
  systemHour,
  resolveTheme,
  isDusk,
  type ThemeName,
  type LockMode,
} from './engine/theme'
import { FROZEN_HOUR } from './engine/time'

// 四套 Aholo 生成的办公室 3DGS：街区摊位按行业进入，办公室模式下也可手动切换对比
const OFFICE_SCENES = [
  { file: 'finance.spz', label: '金融 · 交易大厅（SpatialGen · SPZ 5.1MB）' },
  { file: 'manufacturing.spz', label: '智造 · 展厅（SpatialGen · SPZ 4.0MB）' },
  { file: 'culture.spz', label: '文创 · Loft（SpatialGen · SPZ 3.9MB）' },
  { file: 'office-promptonly.spz', label: '互联网 · 纯文案生成（World · SPZ 4.1MB）' },
]

// 单人模式构图自适应：低薪参数山太矮（0.16–0.32m），固定机位下主体 <8% 画幅、
// 90×90 地板占 >80%（盲审「60% 空黑」根因）。按引擎公式同源算出山高/占地，
// 相机距离 = k × max(footprint, 1.4)，目标高度随山抬升；参数变化时一次性重设（不逐帧 lerp）。
// 只动相机与 OrbitControls 目标，不碰 MoneyMountain/SchrodingerBills 内部。
function MountainFit({ params, growthKey }: { params: CompanyParams; growthKey: number }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as {
    target: THREE.Vector3
    update: () => void
  } | null
  const fit = useMemo(() => {
    const baseL = layerLayout(yuanToStacks(params.annualBaseSalary), 0)
    const inc = incrementPackage(params)
    const incL = layerLayout(yuanToStacks(inc), baseL.length ? baseL[baseL.length - 1].layer + 1 : 0)
    const layers = baseL.length + (inc > 0 ? incL.length : 0)
    const mountainH = layers * BILL.stackH * MOUNTAIN_HEIGHT_SCALE
    const stacks = yuanToStacks(params.annualBaseSalary) + yuanToStacks(inc)
    const footprint = Math.min(3, Math.max(1, Math.ceil(stacks / 9))) * BILL.w * MOUNTAIN_SCALE
    const dist = THREE.MathUtils.clamp(2.6 * Math.max(footprint, 1.4), 3.0, 8.5)
    const ty = THREE.MathUtils.clamp(0.22 + mountainH * 0.5, 0.28, 1.05)
    return { mountainH, dist, ty }
  }, [params])
  useLayoutEffect(() => {
    const dir = new THREE.Vector3(3.1, 2.1, 4.3).normalize()
    camera.position.set(
      dir.x * fit.dist,
      Math.max(1.35, dir.y * fit.dist + fit.ty * 0.6),
      dir.z * fit.dist
    )
    camera.lookAt(-0.4, fit.ty, 0)
    if (controls) {
      controls.target.set(-0.4, fit.ty, 0)
      controls.update()
    }
    // growthKey 变化必伴随 params 变化；显式列出以防同参重播时相机不复位
  }, [camera, controls, fit, growthKey])
  return null
}

function Scene({
  name,
  params,
  growthKey,
  roam = false,
  envHour,
  theme,
}: {
  name: string
  params: CompanyParams
  growthKey: number
  roam?: boolean
  envHour: number
  theme: ThemeName
}) {
  // 漫游共享状态：Avatar 位置 + 点击目标（相机/演员/地面点击三方共用）
  const positionRef = useRef(new THREE.Vector3(-1.9, 0, 2.0))
  const targetRef = useRef<THREE.Vector3 | null>(null)
  const roamRefs = useMemo<RoamRefs>(
    () => ({ position: positionRef, target: targetRef }),
    []
  )
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [3.1, 2.1, 4.3], fov: 45 }}>
      {/* lazy 3D 组件首次加载会挂起：Canvas 内必须有 Suspense，否则挂起冒泡到根、整树空白 */}
      <Suspense fallback={null}>
        <WorkdaySky envHour={envHour} theme={theme} />
        {/* 大地板：让展台坐在"地面"上而非悬空。日/夜双地板：夜间深（夜色氛围）、
            日间浅（与浅色天幕/亮 UI 同带，消除「亮 UI+黑地」割裂——盲审 R6 短板①） */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
          <planeGeometry args={[90, 90]} />
          <meshStandardMaterial color={theme === 'dark' ? ColorSceneHallFloor : ColorSceneHallFloorDay} roughness={0.9} />
        </mesh>
        <CompanyPlot
          position={[0, 0, 0]}
          name={name}
          params={params}
          growthKey={growthKey}
          roam={roam}
          roamRefs={roamRefs}
          onGroundClick={
            roam
              ? (p) => {
                  targetRef.current = new THREE.Vector3(p.x, p.y, p.z)
                }
              : undefined
          }
        />
        {roam ? (
          <RoamCamera enabled refs={roamRefs} />
        ) : (
          <>
            {/* makeDefault：MountainFit 通过 useThree(controls) 接管目标点（原固定 target 已移除） */}
            <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.1} />
            <MountainFit params={params} growthKey={growthKey} />
          </>
        )}
      </Suspense>
    </Canvas>
  )
}

const GLASS_GATE_PREVIEW =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('gate') === 'glass'

export default function App() {
  const [mode, setMode] = useState<'single' | 'compare' | 'office' | 'street' | 'gallery'>('single')
  // 首屏角色门禁（v1.4 双角色体系）：
  //   首屏**不挂任何 <Canvas>** → 零 WebGL 上下文、零 3D 资产请求。
  //   这是首屏体积能守住 5MB 红线的前提（实测：渲染 single 模式会拉
  //   avatar-idle 3.08MB + avatar-walk 3.08MB + gc-bill-bundle 2.23MB ≈ 8.5MB）。
  const [roleGate, setRoleGate] = useState(true)
  const [role, setRole] = useState<Role | null>(null)
  const [rememberedRole, setRememberedRole] = useState<Role | null>(() => loadRole())
  const [paramsA, setParamsA] = useState<CompanyParams>(defaultParams())
  const [presetA, setPresetA] = useState('custom')
  const [paramsB, setParamsB] = useState<CompanyParams>(companyById('nebula').params)
  const [presetB, setPresetB] = useState('nebula')
  const [growthKey, setGrowthKey] = useState(0)
  const [officeScene, setOfficeScene] = useState(assetUrl('/assets/office/finance.spz'))
  const [roam, setRoam] = useState(false)

  // ===== 环境主题（v4 玻璃数字孪生）=====
  // 系统时钟 → 主题；用户可锁定（评审演示时不被系统时间打断）
  // ?hour= 冻结（截图确定性，engine/time.ts）：冻结时初始 envHour 取参数且 60s 轮询跳过
  const [lockMode, setLockMode] = useState<LockMode>('auto')
  const [envHour, setEnvHour] = useState(() => FROZEN_HOUR ?? systemHour())
  const [theme, setTheme] = useState<ThemeName>(() => resolveTheme(FROZEN_HOUR ?? systemHour(), 'auto'))
  const [pendingTheme, setPendingTheme] = useState<ThemeName | null>(null)

  // 每 60 秒检查一次系统时间；临界点抖动时延迟 3 秒再应用（防闪烁）
  useEffect(() => {
    const tick = () => {
      if (FROZEN_HOUR !== null) return
      const h = systemHour()
      setEnvHour(h)
      const next = resolveTheme(h, lockMode)
      setPendingTheme((cur) => (cur === next ? null : next))
    }
    tick()
    const id = window.setInterval(tick, 60000)
    return () => window.clearInterval(id)
  }, [lockMode])

  // 切换延迟 3 秒（避免临界点反复横跳）
  useEffect(() => {
    if (!pendingTheme) return
    const id = window.setTimeout(() => {
      setTheme(pendingTheme)
      setPendingTheme(null)
    }, 3000)
    return () => window.clearTimeout(id)
  }, [pendingTheme])

  const dusk = isDusk(envHour)

  // 主题锁定循环：auto → light → dark → auto
  // 手动锁定必须**立即生效**（用户点击就是要立刻看到反馈），
  // 只有跟随系统时间的自动切换才走 3 秒防抖延迟。
  const cycleLock = () =>
    setLockMode((m) => {
      const next = m === 'auto' ? 'light' : m === 'light' ? 'dark' : 'auto'
      if (next !== 'auto') {
        setTheme(next)
        setPendingTheme(null)
      } else {
        // 回到自动：立即按当前系统时间重算
        setTheme(resolveTheme(systemHour(), 'auto'))
        setPendingTheme(null)
      }
      return next
    })

  // 街区名片 → 进办公室参观（v1.2：按行业切换对应 SpatialGen 生成空间）
  const enterOfficeFromStreet = (lot: { industry: string }) => {
    const file =
      lot.industry === 'internet'
        ? 'office-promptonly.spz'
        : `${lot.industry}.spz`
    setOfficeScene(assetUrl(`/assets/office/${file}`))
    setMode('office')
  }

  // 对比篮：街区收两家 → 一键进 A/B（v1.2 新旧模式打通）
  const [basket, setBasket] = useState<Lot[]>(() => {
    const ids = loadBasket()
    return ids.map((id) => {
      const lot = STREET_LOTS.find((l) => l.id === id)
      return lot ?? null
    }).filter((l): l is Lot => l !== null)
  })
  const [nameA, setNameA] = useState<string | null>(null)
  const [nameB, setNameB] = useState<string | null>(null)
  const addBasket = (lot: Lot) => {
    setBasket((prev) => {
      const next = prev.some((x) => x.id === lot.id) ? prev : [...prev, lot].slice(-2)
      saveBasket(next.map((l) => l.id))
      return next
    })
  }
  const applyBasketAndCompare = () => {
    if (basket[0]) {
      setParamsA(basket[0].params)
      setPresetA('custom')
      setNameA(basket[0].name)
    }
    if (basket[1]) {
      setParamsB(basket[1].params)
      setPresetB('custom')
      setNameB(basket[1].name)
    }
    setMode('compare')
  }

  const capNote = schrodingerCapNote({
    equityYuan: paramsA.equityValue,
    baseYuan: paramsA.annualBaseSalary,
  })

  // 角色选择 → 进入 3D。求职者走街区，HR 走建厂入口（本期先落街区 + 摊主替身视角）
  const enterAsRole = (r: Role) => {
    setRole(r)
    saveRole(r)
    setMode('street')
    setRoleGate(false)
  }
  const enterStreetDirectly = () => {
    setRoleGate(false)
    setMode('street')
  }

  return (
    <div className="app" data-theme={theme}>
      {/* 顶层错误边界：任何未捕获错误都降级为可读页，而不是整站白屏（T8 同构风险） */}
      <ErrorBoundary>
      {/* 首屏角色门禁：纯 SVG，零 3D 资产、零 WebGL 上下文 */}
      {roleGate &&
        (GLASS_GATE_PREVIEW ? (
          <RoleGateGlass
            onPick={enterAsRole}
            onEnterStreet={enterStreetDirectly}
            remembered={rememberedRole}
            onDismissRemembered={() => setRememberedRole(null)}
          />
        ) : (
          <RoleGate
            onPick={enterAsRole}
            onEnterStreet={enterStreetDirectly}
            remembered={rememberedRole}
            onDismissRemembered={() => setRememberedRole(null)}
          />
        ))}
      {!roleGate && (
      <>
      <header>
        <h1>
          逛厂 <span>把画的饼，砌成真的山</span>
        </h1>
        <div className="mode-switch">
          {/* 主题锁定：auto 跟随系统时间 / 强制白天 / 强制夜间（评审演示不被系统时间打断） */}
          <button
            className={`theme-lock theme-lock--${lockMode}`}
            onClick={cycleLock}
            title={`主题：${lockMode === 'auto' ? `跟随系统时间（${dusk ? '黄昏' : theme === 'light' ? '白天' : '夜间'}）` : lockMode === 'light' ? '强制白天' : '强制夜间'}`}
            aria-label={`主题：${lockMode === 'auto' ? '跟随系统时间' : lockMode === 'light' ? '强制白天' : '强制夜间'}`}
          >
            {lockMode === 'light' ? '☀' : lockMode === 'dark' ? '☾' : '◐'}
          </button>
          {/* 切换角色：误选必须可修正（总纲 §2.4 无死路要求） */}
          <button
            className="theme-lock theme-lock--auto"
            onClick={() => setRoleGate(true)}
            title="切换角色（求职者 / HR）"
            aria-label="切换角色（求职者 / HR）"
          >
            {role === 'hr' ? 'HR' : role === 'candidate' ? '求职者' : '角色'}
          </button>
          <button className={mode === 'single' ? 'active' : ''} onClick={() => setMode('single')}>
            逛一家
          </button>
          <button className={mode === 'compare' ? 'active' : ''} onClick={applyBasketAndCompare}>
            A/B 对比
          </button>
          {basket.length > 0 && mode !== 'compare' && (
            <button className="basket-badge" onClick={applyBasketAndCompare}>
              🧺 对比篮 {basket.length}
            </button>
          )}
          <button
            className={mode === 'office' ? 'active' : ''}
            onClick={() => setMode('office')}
          >
            办公室漫游
          </button>
          <button
            className={mode === 'street' ? 'active' : ''}
            onClick={() => {
              setRoleGate(false)
              setMode('street')
            }}
          >
            🏙️ 招聘街区
          </button>
          {mode !== 'street' && mode !== 'office' && (
            <button className="replay" onClick={() => setGrowthKey((k) => k + 1)}>
              ▶ 生长动画
            </button>
          )}
          {mode === 'single' && (
            <button
              className={roam ? 'active' : 'roam-btn'}
              title={roam ? '点击地面行走，或用 WASD 移动' : '进入漫游模式'}
              onClick={() => setRoam((r) => !r)}
            >
              {roam ? '🚶 漫游中 · 点地行走' : '🚶 漫游模式'}
            </button>
          )}
          {mode === 'office' && (
            <select
              className="office-select"
              value={officeScene}
              onChange={(e) => setOfficeScene(e.target.value)}
            >
              {OFFICE_SCENES.map((o) => (
                <option key={o.file} value={assetUrl(`/assets/office/${o.file}`)}>
                  {o.label}
                </option>
              ))}
              {/* InteriorGS 数据集为受限授权（HF gated）：资产与入口都只在本地 dev 出现，任何生产构建都不暴露 */}
              {import.meta.env.DEV && (
                <option value={assetUrl("/assets/office/interiorgs-0024.ply")}>
                  真实扫描办公室（InteriorGS 0024 · PLY 57MB，仅本地版）
                </option>
              )}
            </select>
          )}
        </div>
      </header>

      <main>
        {mode !== 'street' && (
          <aside className="controls">
          <div className="preset-row">
            {fictionalCompanies.map((c) => (
              <button
                key={c.id}
                className={`chip-btn ${presetA === c.id ? 'active' : ''}`}
                onClick={() => {
                  setPresetA(c.id)
                  setParamsA(c.id === 'custom' ? defaultParams() : { ...c.params })
                }}
                title={c.tagline}
              >
                {c.name}
              </button>
            ))}
          </div>
          <HRPanel
            title="HR 参数面板（由词典 JSON 自动生成）"
            params={paramsA}
            onChange={(patch) => {
              setPresetA('custom')
              setParamsA((p) => ({ ...p, ...patch }))
            }}
          />
          <div className="readout">
            <div>
              总包：
              <strong>
                {formatValue(
                  { type: 'slider', min: 0, max: 0, step: 1, default: 0, format: 'wan-yuan' },
                  totalPackage(paramsA)
                )}
              </strong>
              <small>（base {formatValue(
                { type: 'slider', min: 0, max: 0, step: 1, default: 0, format: 'wan-yuan' },
                paramsA.annualBaseSalary
              )} × {paramsA.salaryStructure} 薪）</small>
            </div>
            <div>
              下班：
              <strong>
                {formatValue(
                  { type: 'slider', min: 0, max: 0, step: 0.5, default: 0, format: 'clock-hour' },
                  paramsA.offworkTime
                )}
              </strong>
            </div>
            {capNote && <div className="cap-note">🛡 {capNote}</div>}
          </div>

          {mode === 'compare' && (
            <div className="panel-b">
              <h2>B 侧参数（实时同步右屏）</h2>
              <div className="preset-row">
                {fictionalCompanies.map((c) => (
                  <button
                    key={c.id}
                    className={`chip-btn ${presetB === c.id ? 'active' : ''}`}
                    onClick={() => {
                      setPresetB(c.id)
                      setParamsB(c.id === 'custom' ? defaultParams() : { ...c.params })
                    }}
                    title={c.tagline}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              <HRPanel
                title="B · HR 参数面板"
                params={paramsB}
                onChange={(patch) => {
                  setPresetB('custom')
                  setParamsB((p) => ({ ...p, ...patch }))
                }}
              />
            </div>
          )}
        </aside>
        )}

        <section className={mode === 'compare' ? 'scenes compare' : 'scenes'}>
          {mode !== 'office' && mode !== 'street' && (
            <div className="scale-note scale-note--overlay">
              钞票山 水平等比放大 2.5× · 高度做感知增强 · 公司间比例真实（换算见报告附录A）
            </div>
          )}
          {mode === 'street' ? (
            <SceneErrorBoundary label="招聘街区">
              <Suspense fallback={<div className="office-loading">招聘街区加载中…</div>}>
                <StreetSceneLoader
                  envHour={envHour}
                  theme={theme}
                  onEnterOffice={enterOfficeFromStreet}
                  onEnterGallery={() => setMode('gallery')}
                  onAddBasket={addBasket}
                  basketIds={basket.map((b) => b.id)}
                />
              </Suspense>
            </SceneErrorBoundary>
          ) : mode === 'office' ? (
            <SceneErrorBoundary label="3DGS 办公室">
              <Suspense
                fallback={
                  <div className="office-loading">3DGS 渲染引擎加载中…</div>
                }
              >
                <OfficeViewer url={officeScene} />
              </Suspense>
            </SceneErrorBoundary>
          ) : mode === 'gallery' ? (
            <SceneErrorBoundary label="作品廊">
              <Suspense fallback={<div className="office-loading">作品廊加载中…</div>}>
                <GalleryScene
                  expectedSalary={450000}
                  night={theme === 'dark'}
                />
              </Suspense>
            </SceneErrorBoundary>
          ) : mode === 'single' ? (
            <Scene
              name={nameA ? `A · ${nameA}` : fictionalCompanies.find((c) => c.id === presetA)?.name ?? '自定义空间'}
              params={paramsA}
              growthKey={growthKey}
              roam={roam}
              envHour={envHour}
              theme={theme}
            />
          ) : (
            <>
              <Scene
                name={nameA ? `A · ${nameA}` : 'A · 我的山'}
                params={paramsA}
                growthKey={growthKey}
                envHour={envHour}
                theme={theme}
              />
              <Scene
                name={nameB ? `B · ${nameB}` : `B · ${fictionalCompanies.find((c) => c.id === presetB)?.name ?? '自定义'}`}
                params={paramsB}
                growthKey={growthKey}
                envHour={envHour}
                theme={theme}
              />
            </>
          )}
        </section>
      </main>

      <footer>
        Aholo 全球 3D AI 黑客松参赛作品 · 逛厂 GuǎngChǎng · 数据为演示样例 ·
        源码与报告见 github.com/zgqy379/guangchang
      </footer>
      </>
      )}
      </ErrorBoundary>
    </div>
  )
}

// 街区加载遮罩：监听首帧事件，加载期显示品牌化加载态（消除黑屏窗口期）
function StreetSceneLoader(props: {
  onEnterOffice: (lot: { industry: string }) => void
  onEnterGallery?: () => void
  envHour: number
  theme: ThemeName
  onAddBasket: (lot: Lot) => void
  basketIds: string[]
}) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const h = () => setReady(true)
    window.addEventListener('street-ready', h)
    // 兜底：即便首帧事件因竞态丢失，12s 后也撤遮罩
    const t = setTimeout(h, 12000)
    return () => {
      window.removeEventListener('street-ready', h)
      clearTimeout(t)
    }
  }, [])
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <StreetScene {...props} onEnterGallery={props.onEnterGallery} />
      {!ready && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // 遮罩是不透明面板 → 用随主题反相的面板令牌（旧硬编码 #0d1117 在浅色主题下突兀）
            background: 'var(--ui-panel-bg)',
            zIndex: 20,
            color: 'var(--ui-panel-fg-muted)',
            fontSize: 14,
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--color-brand-red-deep)' }}>逛厂</div>
          <div>招聘街区搭建中，即将开门…</div>
        </div>
      )}
    </div>
  )
}
