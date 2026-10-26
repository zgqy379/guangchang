// HR 参数面板：表单由词典 JSON 自动生成（project.md 5.5 词典即引擎）
// 加词条零前端开发——hr-dictionary.json 加一条，这里自动多一个控件
import { hrDictionary } from '../engine/dictionary'
import { CompanyParams } from '../engine/params'
import { ParamForm } from './forms/ParamForm'

interface Props {
  title: string
  params: CompanyParams
  onChange: (patch: Partial<CompanyParams>) => void
}

export function HRPanel({ title, params, onChange }: Props) {
  return (
    <div className="panel">
      <h2>{title}</h2>
      <ParamForm
        side="hr"
        params={params as unknown as Record<string, unknown>}
        onChange={(patch) => onChange(patch as Partial<CompanyParams>)}
      />
      <div className="planned">
        <h3>词典中更多参数（接入渲染管线中）</h3>
        {hrDictionary.entries
          .filter((e) => e.implementation === 'planned')
          .map((e) => (
            <span key={e.id} className="chip">{e.label}</span>
          ))}
      </div>
    </div>
  )
}
