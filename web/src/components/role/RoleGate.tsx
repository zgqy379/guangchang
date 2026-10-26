// 首屏角色选择（v1.4 · 双角色体系）
//
// 规格来源：docs/design/role-flow-visual-v1.md §2 + role-flow-spec-v1.md §2
// 关键约束：
//   · 首屏**零 3D 资产、零 WebGL 上下文**（纯 DOM + CSS + 内联 SVG）
//     —— 首屏最大风险是"打开即崩"，不是"不够炫"；three.js 进 bundle 就 600KB gzip
//   · 两张角色卡用**五重编码**区分（形状/预览内容/冷暖光/色相/文字），
//     去掉任意两重仍可辨识（WCAG 1.4.1 非颜色编码）
//   · 「直接逛招聘街区」是**默认焦点**（Tab 序第一位 / Enter 直达）——
//     角色选择不是"3D 之前的一道门"，而是"3D 里的一个岔路口"
//   · 玻璃浮层垫实底（--ui-glass-underlay），否则浅色主题压最亮天幕时
//     次级文字掉到 4.48:1
import { useEffect, useRef, useState } from 'react'

export type Role = 'candidate' | 'hr'

interface Props {
  /** 选择角色后回调 */
  onPick: (role: Role) => void
  /** 「直接逛招聘街区」出口（默认焦点） */
  onEnterStreet: () => void
  /** 是否记住上次选择（回访用户直接落到对应分支） */
  remembered?: Role | null
  onDismissRemembered?: () => void
}

/** 求职者侧：冷色 · 环形语法（轨道 + 节点） */
function CandidateNiche() {
  return (
    <svg viewBox="0 0 320 200" className="gc-niche__svg" aria-hidden="true">
      <defs>
        <radialGradient id="gc-cand-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#16C0B6" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#16C0B6" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* 影棚背板：与 HR 龛共用同一套光学参数，靠前景发光体区分冷暖 */}
      <rect width="320" height="200" fill="#0B0E1A" />
      <rect width="320" height="200" fill="url(#gc-cand-glow)" />
      {/* 环形轨道（形状编码 1：环） */}
      <ellipse cx="160" cy="104" rx="62" ry="26" fill="none" stroke="#16C0B6" strokeWidth="1.4" opacity="0.75" />
      <ellipse cx="160" cy="104" rx="44" ry="18" fill="none" stroke="#16C0B6" strokeWidth="1" opacity="0.45" />
      {/* 人形剪影：与 HR 龛共用同一条 path → 同一世界的暗示 */}
      <g fill="#e8eef4" opacity="0.92">
        <circle cx="160" cy="72" r="13" />
        <rect x="151" y="88" width="18" height="42" rx="8" />
        <rect x="153" y="128" width="6" height="26" rx="3" />
        <rect x="161" y="128" width="6" height="26" rx="3" />
      </g>
      {/* 数据粒子（形状编码 2：环绕粒子 vs 碑体） */}
      {[
        [110, 88], [206, 96], [134, 122], [188, 70], [98, 108], [220, 116],
        [152, 58], [172, 134], [120, 70], [200, 84], [140, 106], [182, 116],
        [104, 96], [214, 74], [162, 46], [146, 140], [126, 56], [196, 132],
      ].map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r="2"
          fill="#16C0B6"
          opacity={0.5 + (i % 4) * 0.12}
          className="gc-niche__particle"
          style={{ animationDelay: `${(i % 8) * 0.13}s` }}
        />
      ))}
      {/* 作品玻璃卡（矩形 = 作品） */}
      <g opacity="0.85">
        <rect x="70" y="96" width="26" height="18" rx="2" fill="#cfe4f2" opacity="0.55" />
        <rect x="226" y="88" width="26" height="18" rx="2" fill="#cfe4f2" opacity="0.45" />
        <rect x="152" y="150" width="26" height="18" rx="2" fill="#cfe4f2" opacity="0.38" />
      </g>
      {/* 接触阴影：让人形落地而非悬浮 */}
      <ellipse cx="160" cy="156" rx="26" ry="6" fill="#000" opacity="0.42" />
    </svg>
  )
}

/** HR 侧：暖色 · 立柱语法（碑体 + 光条） */
function HrNiche() {
  return (
    <svg viewBox="0 0 320 200" className="gc-niche__svg" aria-hidden="true">
      <defs>
        <radialGradient id="gc-hr-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#d98e32" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#d98e32" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="200" fill="#0B0E1A" />
      <rect width="320" height="200" fill="url(#gc-hr-glow)" />
      {/* 参数碑缩影（形状编码 1：立柱 + 灯条） */}
      <rect x="196" y="62" width="18" height="92" rx="2" fill="#3d4650" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect
          key={i}
          x="214"
          y={72 + i * 15}
          width="3"
          height="9"
          fill={i < 3 ? '#58e39b' : '#233028'}
        />
      ))}
      {/* 头顶下班日月 */}
      <circle cx="205" cy="50" r="7" fill="#ffd4b0" />
      {/* 人形剪影：与求职者侧共用同一条 path */}
      <g fill="#e8eef4" opacity="0.92">
        <circle cx="130" cy="72" r="13" />
        <rect x="121" y="88" width="18" height="42" rx="8" />
        <rect x="123" y="128" width="6" height="26" rx="3" />
        <rect x="131" y="128" width="6" height="26" rx="3" />
      </g>
      {/* 钞票山缩影（形状编码 2：层叠体 vs 粒子） */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect
          key={i}
          x={54 + i * 2}
          y={146 - i * 12}
          width={44 - i * 4}
          height="9"
          rx="1"
          fill="#d98e32"
          opacity={0.85 - i * 0.06}
          transform={`rotate(${i % 2 === 0 ? -0.6 : 0.6} ${76 + i * 2} ${146 - i * 12})`}
        />
      ))}
      <ellipse cx="130" cy="156" rx="26" ry="6" fill="#000" opacity="0.42" />
    </svg>
  )
}

export function RoleGate({ onPick, onEnterStreet, remembered, onDismissRemembered }: Props) {
  const streetRef = useRef<HTMLButtonElement>(null)
  const [note, setNote] = useState<string | null>(null)

  // 默认焦点落在「直接逛招聘街区」：评审按 Enter 即进 3D 街区
  // 注意：focus() 默认会滚动元素到可视区。移动端首屏内容高于视口（两卡竖排），
  // 无条件 focus 会把页面滚到出口按钮、导致顶部标题被推出视口（实测 scrollTop=463）。
  // → 用 preventScroll 保持滚动位置不变；移动端干脆不自动聚焦（触屏无键盘）。
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return
    streetRef.current?.focus({ preventScroll: true })
  }, [])

  // 回访提示：上次选过什么角色，一键继续（但不给它焦点，避免打断默认焦点策略）
  useEffect(() => {
    if (!remembered) return
    const label = remembered === 'candidate' ? '求职者' : 'HR'
    setNote(`上次你以「${label}」身份进入 · 继续`)
  }, [remembered])

  return (
    <div className="gc-role-gate">
      <div className="gc-role-gate__inner">
        {/* 用 div 而非 header：全局 styles.css 的 header 规则是 flex + space-between，
            会把标题与副标题推到左右两端 */}
        <div className="gc-role-gate__head">
          <div className="gc-role-gate__brand">
            逛厂 <span>把画的饼，砌成真的山</span>
          </div>
          <p className="gc-role-gate__lead">
            参数空间化 3D 求职招聘街区 · 64 个招聘摊位 · 参数全部变成看得见的实物
          </p>
        </div>

        <div className="gc-role-cards">
          <button
            type="button"
            className="gc-role-card gc-role-card--candidate"
            onClick={() => onPick('candidate')}
          >
            <div className="gc-role-card__niche">
              <CandidateNiche />
            </div>
            <div className="gc-role-card__body">
              <div className="gc-role-card__badge" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                  <ellipse cx="12" cy="12" rx="9" ry="4.5" />
                  <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
                  <circle cx="20" cy="12" r="1.6" fill="currentColor" stroke="none" />
                </svg>
              </div>
              <h2 className="gc-role-card__title">我是求职者</h2>
              <p className="gc-role-card__sub">逛厂看公司，不看广告</p>
              <ul className="gc-role-card__points">
                <li>上传照片，生成属于你的 3D 形象</li>
                <li>作品集悬浮在身边，走近就能细看</li>
                <li>参数全部具象化：山有多高、月亮多晚</li>
              </ul>
              <span className="gc-role-card__cta">以求职者身份进入</span>
            </div>
          </button>

          <button
            type="button"
            className="gc-role-card gc-role-card--hr"
            onClick={() => onPick('hr')}
          >
            <div className="gc-role-card__niche">
              <HrNiche />
            </div>
            <div className="gc-role-card__body">
              <div className="gc-role-card__badge" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                  <rect x="7" y="3" width="10" height="18" rx="1.5" />
                  <path d="M10 8h4M10 12h4M10 16h4" />
                </svg>
              </div>
              <h2 className="gc-role-card__title">我是 HR</h2>
              <p className="gc-role-card__sub">让参数被看见，不被质疑</p>
              <ul className="gc-role-card__points">
                <li>上传办公空间照片，生成可漫游的 3D 空间</li>
                <li>薪资参数 3D 具象化，环绕在你身边</li>
                <li>求职者能直接进来看你的真实空间</li>
              </ul>
              <span className="gc-role-card__cta">以 HR 身份进入</span>
            </div>
          </button>
        </div>

        <div className="gc-role-gate__foot">
          {/* 默认焦点：Enter 直达 3D 街区。角色选择是岔路口，不是门禁 */}
          <button
            ref={streetRef}
            type="button"
            className="gc-role-gate__direct"
            onClick={onEnterStreet}
          >
            直接逛招聘街区 →
          </button>
          {note && (
            <button
              type="button"
              className="gc-role-gate__remember"
              onClick={() => {
                if (remembered) onPick(remembered)
                onDismissRemembered?.()
              }}
            >
              {note}
            </button>
          )}
          <p className="gc-role-gate__hint">
            首次进入约 1 秒 · 进入后是 3D 街区，64 个招聘摊位任你走
          </p>
        </div>
      </div>
    </div>
  )
}
