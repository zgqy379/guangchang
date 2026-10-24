// HR 参数面板：表单由词典 JSON 自动生成（project.md 5.5 词典即引擎）
// 加词条零前端开发——hr-dictionary.json 加一条，这里自动多一个控件
import { hrDictionary, formatValue } from '../engine/dictionary'
import { CompanyParams } from '../engine/params'

interface Props {
  title: string
  params: CompanyParams
  onChange: (patch: Partial<CompanyParams>) => void
}

const editableIds: (keyof CompanyParams)[] = [
  'annualBaseSalary',
  'salaryStructure',
  'equityValue',
  'offworkTime',
]

export function HRPanel({ title, params, onChange }: Props) {
  return (
    <div className="panel">
      <h2>{title}</h2>
      {hrDictionary.entries
        .filter((e) => editableIds.includes(e.id as keyof CompanyParams))
        .map((e) => {
          if (e.input.type === 'slider') {
            const value = params[e.id as keyof CompanyParams] as number
            return (
              <label key={e.id} className="field">
                <span className="field-label">
                  {e.label}
                  <em className="value">{formatValue(e.input, value)}</em>
                </span>
                <input
                  type="range"
                  min={e.input.min}
                  max={e.input.max}
                  step={e.input.step}
                  value={value}
                  onChange={(ev) =>
                    onChange({ [e.id]: Number(ev.target.value) } as Partial<CompanyParams>)
                  }
                />
                <small className="perception">{e.perception}</small>
              </label>
            )
          }
          if (e.input.type === 'select') {
            const value = params[e.id as keyof CompanyParams] as number
            return (
              <label key={e.id} className="field">
                <span className="field-label">{e.label}</span>
                <select
                  value={value}
                  onChange={(ev) =>
                    onChange({ [e.id]: Number(ev.target.value) } as Partial<CompanyParams>)
                  }
                >
                  {e.input.options.map((o) => (
                    <option key={String(o.value)} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <small className="perception">{e.perception}</small>
              </label>
            )
          }
          return null
        })}
      <div className="planned">
        <h3>词典中更多参数（接入渲染管线中）</h3>
        {hrDictionary.entries
          .filter((e) => e.implementation === 'planned')
          .map((e) => (
            <span key={e.id} className="chip">
              {e.label}
            </span>
          ))}
      </div>
    </div>
  )
}
