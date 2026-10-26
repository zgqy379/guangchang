import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { CompanyParams, defaultParams, totalPackage } from './engine/params'
import { formatValue } from './engine/dictionary'
import { WorkdaySky } from './components/WorkdaySky'
import { CompanyPlot } from './components/CompanyPlot'
import { HRPanel } from './components/HRPanel'
import { schrodingerCapNote } from './components/SchrodingerBills'
import { RoamCamera } from './components/RoamCamera'
import type { RoamRefs } from './components/AvatarActor'

// Aholo Viewer 体积大（3DGS 渲染器），仅办公室模式按需加载
const OfficeViewer = lazy(() =>
  import('./components/OfficeViewer').then((m) => ({ default: m.OfficeViewer }))
)
// 街区场景（v1.2）：十字路口四大领域招聘街区
const StreetScene = lazy(() =>
  import('./components/street/StreetScene').then((m) => ({ default: m.StreetScene }))
)
import { fictionalCompanies, companyById } from './data/fictional-companies'
import type { Lot } from './data/street-companies'
import { assetUrl } from './engine/asset'

// 四套 Aholo 生成的办公室 3DGS：街区摊位按行业进入，办公室模式下也可手动切换对比
const OFFICE_SCENES = [
  { file: 'finance.spz', label: '金融 · 交易大厅（SpatialGen · SPZ 5.1MB）' },
  { file: 'manufacturing.spz', label: '智造 · 展厅（SpatialGen · SPZ 4.0MB）' },
  { file: 'culture.spz', label: '文创 · Loft（SpatialGen · SPZ 3.9MB）' },
  { file: 'office-promptonly.spz', label: '互联网 · 纯文案生成（World · SPZ 4.1MB）' },
]

function Scene({
  name,
  params,
  growthKey,
  roam = false,
}: {
  name: string
  params: CompanyParams
  growthKey: number
  roam?: boolean
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
      <WorkdaySky offworkHour={params.offworkTime} />
      {/* 大地板：让展台坐在"地面"上而非悬空，地砖路可延伸向远方 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[90, 90]} />
        <meshStandardMaterial color="#10141a" roughness={1} />
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
        <OrbitControls target={[-0.4, 0.7, 0]} maxPolarAngle={Math.PI / 2.1} />
      )}
    </Canvas>
  )
}

export default function App() {
  const [mode, setMode] = useState<'single' | 'compare' | 'office' | 'street'>('single')
  const [paramsA, setParamsA] = useState<CompanyParams>(defaultParams())
  const [presetA, setPresetA] = useState('custom')
  const [paramsB, setParamsB] = useState<CompanyParams>(companyById('nebula').params)
  const [presetB, setPresetB] = useState('nebula')
  const [growthKey, setGrowthKey] = useState(0)
  const [officeScene, setOfficeScene] = useState(assetUrl('/assets/office/finance.spz'))
  const [roam, setRoam] = useState(false)

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
  const [basket, setBasket] = useState<Lot[]>([])
  const [nameA, setNameA] = useState<string | null>(null)
  const [nameB, setNameB] = useState<string | null>(null)
  const addBasket = (lot: Lot) =>
    setBasket((b) => (b.some((x) => x.id === lot.id) ? b : [...b, lot].slice(-2)))
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

  return (
    <div className="app">
      <header>
        <h1>
          逛厂 <span>把画的饼，砌成真的山</span>
        </h1>
        <div className="mode-switch">
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
            onClick={() => setMode('street')}
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
              onClick={() => setRoam((r) => !r)}
            >
              {roam ? '🚶 漫游中（点击地面行走 / WASD）' : '🚶 漫游模式'}
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
            <Suspense fallback={<div className="office-loading">招聘街区加载中…</div>}>
              <StreetSceneLoader
                offworkHour={paramsA.offworkTime}
                onEnterOffice={enterOfficeFromStreet}
                onAddBasket={addBasket}
                basketIds={basket.map((b) => b.id)}
              />
            </Suspense>
          ) : mode === 'office' ? (
            <Suspense
              fallback={
                <div className="office-loading">3DGS 渲染引擎加载中…</div>
              }
            >
              <OfficeViewer url={officeScene} />
            </Suspense>
          ) : mode === 'single' ? (
            <Scene
              name={nameA ? `A · ${nameA}` : fictionalCompanies.find((c) => c.id === presetA)?.name ?? '自定义空间'}
              params={paramsA}
              growthKey={growthKey}
              roam={roam}
            />
          ) : (
            <>
              <Scene
                name={nameA ? `A · ${nameA}` : 'A · 我的山'}
                params={paramsA}
                growthKey={growthKey}
              />
              <Scene
                name={nameB ? `B · ${nameB}` : `B · ${fictionalCompanies.find((c) => c.id === presetB)?.name ?? '自定义'}`}
                params={paramsB}
                growthKey={growthKey}
              />
            </>
          )}
        </section>
      </main>

      <footer>
        Aholo 全球 3D AI 黑客松参赛作品 · 逛厂 GuǎngChǎng · 数据为演示样例 ·
        源码与报告见 github.com/zgqy379/guangchang
      </footer>
    </div>
  )
}

// 街区加载遮罩：监听首帧事件，加载期显示品牌化加载态（消除黑屏窗口期）
function StreetSceneLoader(props: {
  onEnterOffice: (lot: { industry: string }) => void
  offworkHour: number
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
      <StreetScene {...props} />
      {!ready && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0d1117',
            zIndex: 20,
            color: '#8b949e',
            fontSize: 14,
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 30, fontWeight: 800, color: '#c23a2b' }}>逛厂</div>
          <div>招聘街区搭建中，即将开门…</div>
        </div>
      )}
    </div>
  )
}
