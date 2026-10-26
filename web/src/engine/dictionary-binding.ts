// 词典 id ↔ 运行时字段绑定层（P1 词典双端化）
//
// 把词典词条绑定到 CompanyParams 的 camelCase 字段，删除 HRPanel.tsx 里的
// 手工 FIELD_BY_ID 硬编码。词典加一条 implemented 词条 → 零前端代码自动出现控件。
//
// bind 优先级：input.bind 显式声明 > 缺省等于词条 id（snake_case 需转 camelCase）
import { DictEntry, DictInput } from './dictionary'
import { hrDictionary, candidateDictionary } from './dictionary'

export type { DictEntry }

/** 词典 id → 运行时字段名（camelCase）。缺省 = id。 */
export function bindField(e: DictEntry): string {
  return (e.input as { bind?: string }).bind ?? e.id
}

/** 按 side 取"可编辑词条"（排除 readonly），并给出字段名 */
export function editableEntries(side: 'hr' | 'candidate'): { entry: DictEntry; field: string }[] {
  const dict = side === 'candidate' ? candidateDictionary : hrDictionary
  return dict.entries
    .filter((e) => e.implementation === 'implemented')
    .map((e) => ({ entry: e, field: bindField(e) }))
}

/** 从参数对象按词典读值（自动处理 slider/select/toggle/readonly） */
export function readValue(e: DictEntry, values: Record<string, unknown>): unknown {
  const field = bindField(e)
  const raw = values[field]
  if (raw === undefined || raw === null) return e.input.type === 'select' ? e.input.default : undefined
  const input = e.input as DictInput & { default?: unknown }
  if (input.type === 'select') {
    const opt = input.options?.find((o) => String(o.value) === String(raw))
    return opt?.label ?? raw
  }
  return raw
}

/** 写值：返回不可变 patch（字段名为 bind 结果）。 */
export function makePatch(e: DictEntry, raw: unknown): Record<string, unknown> {
  const field = bindField(e)
  const input = e.input as DictInput & { default?: unknown }
  let value: unknown = raw
  if (input.type === 'select') {
    const opt = input.options?.find((o) => String(o.value) === String(raw))
    value = opt?.value ?? raw
  } else if (input.type === 'slider') {
    value = Number(raw)
    if (Number.isNaN(value)) value = input.default ?? 0
  } else if (input.type === 'toggle') {
    value = Boolean(raw)
  }
  return { [field]: value }
}
