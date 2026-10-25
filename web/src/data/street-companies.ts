// 招聘街区数据：四大领域 × 每街两侧 16 个摊位 = 64 lot
// 参数范围按行业差异化（词典字段），确定性伪随机保证构建稳定（录屏一致）
import type { CompanyParams } from '../engine/params'

export type Industry = 'internet' | 'finance' | 'manufacturing' | 'culture'

export interface Lot {
  id: string
  name: string
  industry: Industry
  industryLabel: string
  tagline: string
  params: CompanyParams
  hrIndex: number // HR 形象池索引（生成完成后替换占位形象）
}

export const INDUSTRIES: Record<Industry, { label: string; color: string }> = {
  internet: { label: '互联网区', color: '#4a9eff' },
  finance: { label: '金融区', color: '#d4a72c' },
  manufacturing: { label: '智造区', color: '#f0883e' },
  culture: { label: '文创区', color: '#c678dd' },
}

const NAMES: Record<Industry, string[]> = {
  internet: [
    '星链科技', '码上互联', '云梯数据', '量子跳动', '蜂鸟出行', '光年引擎',
    '白泽智能', '深瞳视觉', '灵犀大模型', '极光工作室', '驰云网络', '墨算科技',
    '灯塔云服', '拾贝信息', '千帆中台', '逆熵实验室',
  ],
  finance: [
    '恒岳资本', '金汇信托', '明泽证券', '鼎丰银行', '澜山基金', '砥柱保险',
    '弈算量化', '白银票据', '正合租赁', '观澜投资', '中衡征信', '穗禾财务',
    '铁马保理', '远见资管', '九章精算', '泉眼支付',
  ],
  manufacturing: [
    '铸峰智能', '精工雷达', '重明机器', '铁脊重工', '启明电驱', '磐石材料',
    '星火焊研', '山水数控', '巨浪液压', '衡器智造', '烛龙动力', '熔锻未来',
    '齿轮矩阵', '钢铠机器', '风谷能源', '匠芯工艺',
  ],
  culture: [
    '拾光文创', '漫野动画', '纸鸢出版', '山鸣音乐', '浮岛游戏', '墨白设计',
    '星野影业', '胶片公社', '折子戏剧', '青瓷手作', '词云文案', '画中世界',
    '声波播客', '像素诗人', '故事商店', '白日梦工厂',
  ],
}

const TAGLINES: Record<Industry, string[]> = {
  internet: ['扁平管理 · 下午茶', '技术驱动 · 少开会', '期权给力 · 节奏快', '大牛带教 · 成长快'],
  finance: ['平台大 · 起点高', '证书补贴 · 晋升清晰', '业绩导向 · 奖金猛', '稳定体面 · 加班多'],
  manufacturing: ['宿舍食堂 · 离家近', '技能等级·工资挂钩', '五险按全额缴', '师傅带徒 · 手艺稳'],
  culture: ['弹性上班 · 不打卡', '作品署名 · 有成就感', '猫和咖啡都有', '项目奖金 · 灵感自由'],
}

// 确定性伪随机
function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

const RANGE: Record<Industry, { base: [number, number]; struct: number[]; equity: [number, number]; off: [number, number]; ratio: string[] }> = {
  internet: { base: [260000, 800000], struct: [13, 14, 14, 15, 16], equity: [0, 1200000], off: [20, 24], ratio: ['full', 'full', '0.8', '0.8', '0.6'] },
  finance: { base: [180000, 600000], struct: [13, 14, 14, 16], equity: [0, 800000], off: [19, 23], ratio: ['full', 'full', '0.8'] },
  manufacturing: { base: [120000, 300000], struct: [12, 12, 13, 14], equity: [0, 150000], off: [17.5, 20], ratio: ['full', 'full', 'full', '0.8'] },
  culture: { base: [100000, 280000], struct: [12, 12, 13], equity: [0, 200000], off: [18, 21], ratio: ['full', 'full', '0.8', '0.6'] },
}

function buildLots(): Lot[] {
  const out: Lot[] = []
  ;(Object.keys(NAMES) as Industry[]).forEach((industry, ii) => {
    const r = seeded(1000 + ii * 97)
    NAMES[industry].forEach((name, i) => {
      const rg = RANGE[industry]
      const base = Math.round((rg.base[0] + r() * (rg.base[1] - rg.base[0])) / 10000) * 10000
      const struct = rg.struct[Math.floor(r() * rg.struct.length)]
      const equity = Math.round((rg.equity[0] + r() * (rg.equity[1] - rg.equity[0])) / 10000) * 10000
      const off = Math.round((rg.off[0] + r() * (rg.off[1] - rg.off[0])) * 2) / 2
      const ratio = rg.ratio[Math.floor(r() * rg.ratio.length)]
      out.push({
        id: `${industry}-${i}`,
        name,
        industry,
        industryLabel: INDUSTRIES[industry].label,
        tagline: TAGLINES[industry][i % TAGLINES[industry].length],
        params: {
          annualBaseSalary: base,
          salaryStructure: struct,
          equityValue: equity,
          offworkTime: off,
          socialInsuranceBaseRatio: ratio,
        },
        hrIndex: (i + ii * 3) % 10,
      })
    })
  })
  return out
}

export const STREET_LOTS: Lot[] = buildLots()

// 街区布局：十字路口在原点，四条街沿 ±X/±Z 延伸；每街两侧各 8 lot（共 64）
// side ±1 = 道路两侧；slot 0..7 从路口向外
export interface LotPlacement {
  lot: Lot
  position: [number, number, number] // 摊位中心（HR 站位）
  rotationY: number // 面向道路
  axis: 'x' | 'z'
  side: 1 | -1
}

const SLOT_GAP = 4.2
const LOT_OFFSET = 7.4 // 摊位中心到街道中心线的距离

export function placeLots(): LotPlacement[] {
  const placed: LotPlacement[] = []
  const dirs: { axis: 'x' | 'z'; sign: 1 | -1; industry: Industry }[] = [
    { axis: 'x', sign: 1, industry: 'internet' }, // → +X
    { axis: 'x', sign: -1, industry: 'finance' }, // → -X
    { axis: 'z', sign: 1, industry: 'manufacturing' }, // → +Z
    { axis: 'z', sign: -1, industry: 'culture' }, // → -Z
  ]
  const byIndustry: Record<Industry, Lot[]> = {
    internet: STREET_LOTS.filter((l) => l.industry === 'internet'),
    finance: STREET_LOTS.filter((l) => l.industry === 'finance'),
    manufacturing: STREET_LOTS.filter((l) => l.industry === 'manufacturing'),
    culture: STREET_LOTS.filter((l) => l.industry === 'culture'),
  }
  dirs.forEach(({ axis, sign, industry }) => {
    const lots = byIndustry[industry]
    // 前 8 个在 side+1，后 8 个在 side-1
    lots.forEach((lot, i) => {
      const side: 1 | -1 = i < 8 ? 1 : -1
      const slot = i % 8
      const along = 10 + slot * SLOT_GAP
      const across = side * LOT_OFFSET
      const position: [number, number, number] =
        axis === 'x' ? [sign * along, 0, across] : [across, 0, sign * along]
      // 面向道路中心线（模型默认面向 +Z）
      const rotationY = axis === 'x' ? (side > 0 ? Math.PI : 0) : side > 0 ? -Math.PI / 2 : Math.PI / 2
      placed.push({ lot, position, rotationY, axis, side })
    })
  })
  return placed
}

export const STREET_BOUNDS = 42 // 漫游 clamp ±42m
