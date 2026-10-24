import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { CompanyParams, defaultParams, totalPackage } from './engine/params'
import { formatValue } from './engine/dictionary'
import { WorkdaySky } from './components/WorkdaySky'
import { CompanyPlot } from './components/CompanyPlot'
import { HRPanel } from './components/HRPanel'
import { schrodingerCapNote } from './components/SchrodingerBills'
import { fictionalCompanies, companyById } from './data/fictional-companies'

function Scene({
  name,
  params,
  growthKey,
}: {
  name: string
  params: CompanyParams
  growthKey: number
}) {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [4.5, 3.2, 7.5], fov: 45 }}>
      <WorkdaySky offworkHour={params.offworkTime} />
      <CompanyPlot
        position={[0, 0, 0]}
        name={name}
        params={params}
        growthKey={growthKey}
      />
      <OrbitControls target={[0, 0.6, 0]} maxPolarAngle={Math.PI / 2.1} />
    </Canvas>
  )
}

export default function App() {
  const [mode, setMode] = useState<'single' | 'compare'>('single')
  const [paramsA, setParamsA] = useState<CompanyParams>(defaultParams())
  const [presetB, setPresetB] = useState('nebula')
  const [companyB, setCompanyB] = useState(companyById('nebula'))
  const [growthKey, setGrowthKey] = useState(0)

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
          <button className="replay" onClick={() => setGrowthKey((k) => k + 1)}>
            ▶ 生长动画
          </button>
        </div>
      </header>

      <main>
        <aside className="controls">
          <div className="preset-row">
            {fictionalCompanies.map((c) => (
              <button
                key={c.id}
                className="chip-btn"
                onClick={() => setParamsA(c.id === 'custom' ? defaultParams() : { ...c.params })}
                title={c.tagline}
              >
                {c.name}
              </button>
            ))}
          </div>
          <HRPanel
            title="HR 参数面板（由词典 JSON 自动生成）"
            params={paramsA}
            onChange={(patch) => setParamsA((p) => ({ ...p, ...patch }))}
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
            <div className="preset-b">
              <label>
                对比对象：
                <select
                  value={presetB}
                  onChange={(e) => {
                    setPresetB(e.target.value)
                    setCompanyB(companyById(e.target.value))
                  }}
                >
                  {fictionalCompanies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="tagline">{companyB.tagline}</p>
            </div>
          )}
        </aside>

        <section className={mode === 'compare' ? 'scenes compare' : 'scenes'}>
          {mode === 'single' ? (
            <Scene name="自定义空间" params={paramsA} growthKey={growthKey} />
          ) : (
            <>
              <Scene name="A · 我的山" params={paramsA} growthKey={growthKey} />
              <Scene name={`B · ${companyB.name}`} params={companyB.params} growthKey={growthKey} />
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
