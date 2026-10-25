import { lazy, Suspense, useMemo, useRef, useState } from 'react'
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
import { fictionalCompanies, companyById } from './data/fictional-companies'
import { assetUrl } from './engine/asset'

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
  const positionRef = useRef(new THREE.Vector3(-1.9, 0, 3.4))
  const targetRef = useRef<THREE.Vector3 | null>(null)
  const roamRefs = useMemo<RoamRefs>(
    () => ({ position: positionRef, target: targetRef }),
    []
  )
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [2.6, 1.7, 3.4], fov: 45 }}>
      <WorkdaySky offworkHour={params.offworkTime} />
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
        <OrbitControls target={[0, 0.45, 0]} maxPolarAngle={Math.PI / 2.1} />
      )}
    </Canvas>
  )
}

export default function App() {
  const [mode, setMode] = useState<'single' | 'compare' | 'office'>('single')
  const [paramsA, setParamsA] = useState<CompanyParams>(defaultParams())
  const [presetA, setPresetA] = useState('custom')
  const [paramsB, setParamsB] = useState<CompanyParams>(companyById('nebula').params)
  const [presetB, setPresetB] = useState('nebula')
  const [growthKey, setGrowthKey] = useState(0)
  const [officeScene, setOfficeScene] = useState(assetUrl('/assets/office/office-promptonly.spz'))
  const [roam, setRoam] = useState(false)

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
          <button className={mode === 'compare' ? 'active' : ''} onClick={() => setMode('compare')}>
            A/B 对比
          </button>
          <button
            className={mode === 'office' ? 'active' : ''}
            onClick={() => setMode('office')}
          >
            办公室漫游
          </button>
          <button className="replay" onClick={() => setGrowthKey((k) => k + 1)}>
            ▶ 生长动画
          </button>
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
              <option value={assetUrl("/assets/office/office-promptonly.spz")}>
                AI 生成办公室（World · SPZ 4.1MB）
              </option>
              {/* InteriorGS 数据集为受限授权（HF gated），公开部署不携带该资产 */}
              {!import.meta.env.VITE_PUBLIC_DEPLOY && (
                <option value={assetUrl("/assets/office/interiorgs-0024.ply")}>
                  真实扫描办公室（InteriorGS 0024 · PLY 57MB，仅本地版）
                </option>
              )}
            </select>
          )}
        </div>
      </header>

      <main>
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

        <section className={mode === 'compare' ? 'scenes compare' : 'scenes'}>
          {mode === 'office' ? (
            <Suspense
              fallback={
                <div className="office-loading">3DGS 渲染引擎加载中…</div>
              }
            >
              <OfficeViewer url={officeScene} />
            </Suspense>
          ) : mode === 'single' ? (
            <Scene
              name={fictionalCompanies.find((c) => c.id === presetA)?.name ?? '自定义空间'}
              params={paramsA}
              growthKey={growthKey}
              roam={roam}
            />
          ) : (
            <>
              <Scene name="A · 我的山" params={paramsA} growthKey={growthKey} />
              <Scene
                name={`B · ${fictionalCompanies.find((c) => c.id === presetB)?.name ?? '自定义'}`}
                params={paramsB}
                growthKey={growthKey}
              />
            </>
          )}
        </section>
      </main>

      <footer>
        Aholo 全球 3D AI 黑客松 · 演示脚手架 v0.1 · 词典引擎 / 钞票山 / 薛定谔钞票 / 工时天空 /
        A-B 对比 已通 · Avatar 与办公空间管线见 docs/w1-api-test-checklist.md
      </footer>
    </div>
  )
}
