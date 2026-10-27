// 通用词典参数表单（P1 词典双端化）
//
// 按 editableEntries(side) 自动生成 slider / select / toggle / readonly 控件，
// 词典加一条 implemented 词条 → 零前端代码自动出现控件。
// 候选人侧与 HR 侧共用本组件，仅 side 不同。
import { useMemo } from 'react'
import { editableEntries, readValue, makePatch, bindField, type DictEntry } from '../../engine/dictionary-binding'
import { GcSlider } from './GcSlider'
import { GcSelect } from './GcSelect'
import './ParamForm.css'

interface ParamFormProps {
  /** 'hr' | 'candidate' */
  side: 'hr' | 'candidate'
  params: Record<string, unknown>
  onChange: (patch: Record<string, unknown>) => void
}

export function ParamForm({ side, params, onChange }: ParamFormProps) {
  const fields = useMemo(() => editableEntries(side), [side])

  const handleChange = (entry: DictEntry, raw: unknown) => {
    onChange(makePatch(entry, raw))
  }

  return (
    <div className="gc-param-form">
      {fields.map(({ entry }: { entry: DictEntry }) => {
        const input = entry.input as {
          type: 'slider' | 'select' | 'toggle' | 'readonly'
          min?: number
          max?: number
          step?: number
          default?: unknown
          unit?: string
          format?: 'plain' | 'wan-yuan' | 'clock-hour'
          options?: { value: string | number; label: string }[]
        }
        const current = readValue(entry, params)

        if (input.type === 'slider') {
          return (
            <GcSlider
              key={entry.id}
              label={entry.label}
              value={Number(current ?? input.default ?? input.min ?? 0)}
              min={input.min ?? 0}
              max={input.max ?? 100}
              step={input.step ?? 1}
              format={input.format}
              unit={input.unit}
              onChange={(v) => handleChange(entry, v)}
            />
          )
        }
        if (input.type === 'select') {
          // select 必须传**原始存储值**（如 14）：readValue 返回的是展示 label（"14 薪"），
          // 与 option.value（"14"）对不上会导致回落到第一项——预设芯片切 14 薪时下拉仍显 12 薪（盲审 R4 短板①）
          const rawValue = String((params as Record<string, unknown>)[bindField(entry)] ?? input.default ?? input.options?.[0]?.value ?? '')
          return (
            <GcSelect
              key={entry.id}
              label={entry.label}
              value={rawValue}
              options={input.options ?? []}
              onChange={(v) => handleChange(entry, v)}
            />
          )
        }
        if (input.type === 'toggle') {
          return (
            <div className="gc-param-field gc-param-toggle" key={entry.id}>
              <span className="gc-param-label">{entry.label}</span>
              <button
                className={`gc-param-toggle-btn${Boolean(current) ? ' gc-param-toggle-btn--on' : ''}`}
                onClick={() => handleChange(entry, !Boolean(current))}
              >
                {Boolean(current) ? '开' : '关'}
              </button>
            </div>
          )
        }
        // readonly：仅展示，不编辑
        return (
          <div className="gc-param-field gc-param-readonly" key={entry.id}>
            <span className="gc-param-label">{entry.label}</span>
            <span className="gc-param-value">{String(current ?? '')}</span>
          </div>
        )
      })}
    </div>
  )
}
