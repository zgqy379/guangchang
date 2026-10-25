// 公司参数模型：字段与词典词条一一对应，缺省值取自词典 default
import { entry } from './dictionary'

export interface CompanyParams {
  annualBaseSalary: number
  salaryStructure: number
  equityValue: number
  offworkTime: number
  socialInsuranceBaseRatio: string
}

function sliderDefault(id: string): number {
  const e = entry(id)
  if (e.input.type !== 'slider') throw new Error(`${id} 不是滑杆词条`)
  return e.input.default
}

function selectDefault(id: string): string {
  const e = entry(id)
  if (e.input.type !== 'select') throw new Error(`${id} 不是下拉词条`)
  return String(e.input.default)
}

export const defaultParams = (): CompanyParams => {
  const structure = entry('salary_structure').input
  return {
    annualBaseSalary: sliderDefault('annual_base_salary'),
    salaryStructure:
      structure.type === 'select' ? (structure.default as number) : 12,
    equityValue: sliderDefault('equity_value'),
    offworkTime: sliderDefault('offwork_time'),
    socialInsuranceBaseRatio: selectDefault('social_insurance_base_ratio'),
  }
}

// 总包 = base × (months / 12)；增量层 = 多出来的月份（project.md 5.1 薪资结构）
export const totalPackage = (p: CompanyParams) =>
  p.annualBaseSalary * (p.salaryStructure / 12)
export const incrementPackage = (p: CompanyParams) =>
  p.annualBaseSalary * ((p.salaryStructure - 12) / 12)

// 钞票山几何换算（附录A：百元钞 155×77×0.1mm，50 张一沓高 5mm）
export const BILL = { w: 0.155, d: 0.077, stackH: 0.005, yuanPerStack: 5000 }
export const yuanToStacks = (yuan: number) => Math.max(0, Math.floor(yuan / BILL.yuanPerStack))
// 感知缩放：真实比例下 15 万年薪只有 15cm 高，在米级场景中不可感知。
// 水平等比放大 MOUNTAIN_SCALE 倍（公司间比例严格保持）；
// 高度另做感知增强（数据可视化惯例，见场景内声明）。
export const MOUNTAIN_SCALE = 2.5
export const MOUNTAIN_HEIGHT_SCALE = 16

export interface StackPos {
  pos: [number, number, number]
  layer: number
}

// 层叠布局：每层固定 3×3=9 沓、逐层居中 + 锥度收缩 → 金额差直接变成"高度差"，
// 轮廓是真金字塔而非方柱。
// （旧版 ceil(sqrt(N)) 恒有 ceil(sqrt(N))²≥N，任何金额都只堆一层，
//  15万不可见、100万是一块平铺地毯——2026-10-25 审查修复）
export function layerLayout(stacks: number, startLayer = 0): StackPos[] {
  const COLS = 3
  const ROWS = 3
  const out: StackPos[] = []
  let remaining = stacks
  let layer = startLayer
  while (remaining > 0) {
    const n = Math.min(COLS * ROWS, remaining)
    const usedCols = Math.min(COLS, n)
    const usedRows = Math.min(ROWS, Math.ceil(n / COLS))
    const cx = ((usedCols - 1) / 2) * BILL.w
    const cz = ((usedRows - 1) / 2) * BILL.d
    const taper = Math.max(0.5, 1 - layer * 0.045)
    let placed = 0
    for (let x = 0; x < usedCols && placed < n; x++)
      for (let z = 0; z < ROWS && placed < n; z++) {
        out.push({
          pos: [
            (x * BILL.w - cx) * taper,
            (layer + 0.5) * BILL.stackH,
            (z * BILL.d - cz) * taper,
          ],
          layer,
        })
        placed++
      }
    remaining -= placed
    layer++
  }
  return out
}
