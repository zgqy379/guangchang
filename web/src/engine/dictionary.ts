// 参数空间化词典引擎：词典 JSON 是唯一事实源，
// HR 面板表单与场景映射规则都从这里读（project.md 5.5 词典即引擎）

export interface SliderInput {
  type: 'slider'
  min: number
  max: number
  step: number
  default: number
  unit?: string
  format?: 'plain' | 'wan-yuan' | 'clock-hour'
}
export interface SelectInput {
  type: 'select'
  options: { value: string | number; label: string }[]
  default: string | number
}
export interface ToggleInput {
  type: 'toggle'
  default: boolean
}
export interface ReadonlyInput {
  type: 'readonly'
  source?: string
}
export type DictInput = SliderInput | SelectInput | ToggleInput | ReadonlyInput

export interface AntiGamingRule {
  rule: string
  params?: Record<string, unknown>
}

export interface DictEntry {
  id: string
  label: string
  side: 'hr' | 'candidate'
  priority: 'P0' | 'P1' | 'vision'
  implementation?: 'implemented' | 'planned'
  perception: string
  input: DictInput
  mapping: { type: string; params?: Record<string, any> }
  antiGaming?: AntiGamingRule[]
}

export interface DictionaryFile {
  dictionary: string
  version: string
  entries: DictEntry[]
}

import hrJson from '../../../dictionary/hr-dictionary.json'
import candJson from '../../../dictionary/candidate-dictionary.json'

export const hrDictionary = hrJson as unknown as DictionaryFile
export const candidateDictionary = candJson as unknown as DictionaryFile

export function entry(id: string): DictEntry {
  const e = hrDictionary.entries.find((e) => e.id === id)
  if (!e) throw new Error(`词典缺词条: ${id}`)
  return e
}

export function antiGamingParams(id: string, index: number): Record<string, any> {
  return entry(id).antiGaming?.[index]?.params ?? {}
}

export function formatValue(input: DictInput, value: unknown): string {
  if (input.type === 'slider') {
    const v = value as number
    if (input.format === 'wan-yuan') {
      const w = v / 10000
      return w >= 1 ? `${w % 1 === 0 ? w : w.toFixed(1)} 万` : `${v} 元`
    }
    if (input.format === 'clock-hour') {
      const h = Math.floor(v)
      const m = Math.round((v - h) * 60)
      return `${String(h % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }
    return `${v}${input.unit ?? ''}`
  }
  if (input.type === 'select') {
    return input.options.find((o) => o.value === value)?.label ?? String(value)
  }
  return String(value)
}
