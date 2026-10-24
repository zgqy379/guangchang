// 公司参数模型：字段与词典词条一一对应，缺省值取自词典 default
import { entry } from './dictionary'

export interface CompanyParams {
  annualBaseSalary: number
  salaryStructure: number
  equityValue: number
  offworkTime: number
}

function sliderDefault(id: string): number {
  const e = entry(id)
  if (e.input.type !== 'slider') throw new Error(`${id} 不是滑杆词条`)
  return e.input.default
}

export const defaultParams = (): CompanyParams => {
  const structure = entry('salary_structure').input
  return {
    annualBaseSalary: sliderDefault('annual_base_salary'),
    salaryStructure:
      structure.type === 'select' ? (structure.default as number) : 12,
    equityValue: sliderDefault('equity_value'),
    offworkTime: sliderDefault('offwork_time'),
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
