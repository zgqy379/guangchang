// 首屏角色门（v1.5 · 2026-10-28 盲审重做）
//
// 盲审结论（两位独立评审：5.5 / 6）：
//   · 首屏没有任何 3D 证据，抽象剪影像"还没加载完的占位"
//   · 三个同色红按钮互相抢注意力，最能省的「直接逛」反而最小、最靠下
//   · 移动端 390×844 首屏只看到求职者卡，「直接逛」在两屏之外
// 重做：
//   · 街景实拍静帧做首屏主视觉（唯一 3D 证据；静态 WebP，不挂 Canvas、不拉 GLB）
//   · 唯一红橙主 CTA「直接逛招聘街区」，桌面/移动首屏可见
//   · 身份入口降级为两条次级行（整行可点，红橙从次级入口撤走）
// 约束保持：首屏零 WebGL、零 3D 引擎、零 GLB；对比度按实底验算。
import { useEffect, useRef, useState } from 'react'
import { assetUrl } from '../../engine/asset'

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

export function RoleGate({ onPick, onEnterStreet, remembered, onDismissRemembered }: Props) {
  const streetRef = useRef<HTMLButtonElement>(null)
  const [note, setNote] = useState<string | null>(null)

  // 默认焦点落在「直接逛招聘街区」：评审按 Enter 即进 3D 街区。
  // focus() 默认会滚动；用 preventScroll 保持滚动位置。移动端不自动聚焦（触屏无键盘）。
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return
    streetRef.current?.focus({ preventScroll: true })
  }, [])

  // 回访提示：上次选过什么角色，一键继续（不给焦点，避免打断默认焦点策略）
  useEffect(() => {
    if (!remembered) return
    const label = remembered === 'candidate' ? '求职者' : 'HR'
    setNote(`上次你以「${label}」身份进入 · 继续`)
  }, [remembered])

  return (
    <div className="gc-role-gate">
      <div className="gc-role-gate__inner">
        {/* 用 div 而非 header：全局 styles.css 的 header 是 flex + space-between */}
        <div className="gc-role-gate__head">
          <div className="gc-role-gate__brand">
            逛厂 <span>把画的饼，砌成真的山</span>
          </div>
          <p className="gc-role-gate__lead">把 offer 从表格，砌成看得见的地形</p>
        </div>

        <div className="gc-role-gate__hero">
          <img
            className="gc-role-gate__hero-img"
            src={assetUrl('/assets/rolegate/street-night.webp')}
            alt="逛厂 3D 招聘街区夜景实拍：互联网区入口、摊位灯光与求职者"
            width={1280}
            height={652}
            loading="eager"
            decoding="async"
          />
          <div className="gc-role-gate__hero-scrim" aria-hidden="true" />
          <div className="gc-role-gate__hero-copy">
            <p className="gc-role-gate__hero-kicker">3D 街区实拍</p>
            <h1 className="gc-role-gate__hero-title">一条可以走进去的招聘街</h1>
            <p className="gc-role-gate__hero-sub">64 家公司 · 四个行业 · 总包、五险、下班都在街边</p>
          </div>
          <div className="gc-role-gate__data">
            <span className="gc-role-gate__data-label">示例职位</span>
            <b className="gc-role-gate__data-title">星链科技</b>
            <span className="gc-role-gate__data-values">总包 80 万 · 下班 22:30 · 五险基数 0.6</span>
          </div>
        </div>

        <div className="gc-role-gate__enter">
          {/* 唯一主 CTA：默认焦点，Enter 直达 3D 街区 */}
          <button
            ref={streetRef}
            type="button"
            className="gc-role-gate__direct"
            onClick={onEnterStreet}
          >
            直接逛招聘街区 →
          </button>
          <p className="gc-role-gate__proof">进入后是 3D 街区 · 约 1 秒</p>
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
        </div>

        <p className="gc-role-gate__roles-head">或者，以角色身份进入</p>
        <div className="gc-role-gate__roles">
          <button
            type="button"
            className="gc-role-row gc-role-row--candidate"
            onClick={() => onPick('candidate')}
          >
            <span className="gc-role-row__badge" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <ellipse cx="12" cy="12" rx="9" ry="4.5" />
                <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
                <circle cx="20" cy="12" r="1.6" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <span className="gc-role-row__copy">
              <span className="gc-role-row__title">我是求职者</span>
              <span className="gc-role-row__sub">逛厂看公司，不看广告</span>
            </span>
            <span className="gc-role-row__cta">以求职者身份进入 →</span>
          </button>

          <button
            type="button"
            className="gc-role-row gc-role-row--hr"
            onClick={() => onPick('hr')}
          >
            <span className="gc-role-row__badge" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <rect x="7" y="3" width="10" height="18" rx="1.5" />
                <path d="M10 8h4M10 12h4M10 16h4" />
              </svg>
            </span>
            <span className="gc-role-row__copy">
              <span className="gc-role-row__title">我是 HR</span>
              <span className="gc-role-row__sub">让薪资被看见，不被质疑</span>
            </span>
            <span className="gc-role-row__cta">以 HR 身份进入 →</span>
          </button>
        </div>

        <p className="gc-role-gate__hint">误选可随时在顶栏切换 · 公司与数据为演示样例</p>
      </div>
    </div>
  )
}
