// 三家虚构演示公司（docs/demo-script.md，project.md 9.7）
// 演示真实公司的负面参数有法律风险，一律虚构
import { CompanyParams, defaultParams } from '../engine/params'

export interface FictionalCompany {
  id: string
  name: string
  tagline: string
  params: CompanyParams
}

export const fictionalCompanies: FictionalCompany[] = [
  {
    id: 'nebula',
    name: '不眠星云科技',
    tagline: '高薪卷王 · 山是真高——但你抬头看看几点了',
    params: { annualBaseSalary: 500000, salaryStructure: 14, equityValue: 0, offworkTime: 23 },
  },
  {
    id: 'slowhill',
    name: '慢山文旅',
    tagline: '低薪清闲 · 山只到小腿——但你每天看到的都是夕阳',
    params: { annualBaseSalary: 150000, salaryStructure: 12, equityValue: 0, offworkTime: 18 },
  },
  {
    id: 'chasing',
    name: '追光新创',
    tagline: '画饼大师 · 他说值两百万，规则只让它显出这么大',
    params: { annualBaseSalary: 180000, salaryStructure: 12, equityValue: 2000000, offworkTime: 21 },
  },
  {
    id: 'custom',
    name: '自定义',
    tagline: '自己拖滑杆，砌自己的山',
    params: defaultParams(),
  },
]

export const companyById = (id: string) =>
  fictionalCompanies.find((c) => c.id === id) ?? fictionalCompanies[3]
