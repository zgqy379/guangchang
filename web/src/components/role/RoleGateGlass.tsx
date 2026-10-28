// 首屏角色门 · 液态玻璃版（?gate=glass 预览）
//
// 与 RoleGate 并列的选择性入口：默认门保持不变，本组件只在 URL 带
// ?gate=glass 时挂载，供美术方向实测 / 盲审。避免在方向未过审前
// 动线上默认首屏。
//
// 首屏仍是零 WebGL、零 3D 引擎挂载、零 GLB：主视觉是 R14 场景的
// 静态 WebP（1920×1080，约 79KB），玻璃面板是纯 DOM/CSS。
import { useEffect, useRef, useState } from 'react'
import { assetUrl } from '../../engine/asset'
import type { Role } from './RoleGate'

interface Props {
  onPick: (role: Role) => void
  onEnterStreet: () => void
  remembered?: Role | null
  onDismissRemembered?: () => void
}

const HERO = '/assets/rolegate/street-bluehour.webp'

export function RoleGateGlass({ onPick, onEnterStreet, remembered, onDismissRemembered }: Props) {
  const ctaRef = useRef<HTMLButtonElement>(null)
  const [note, setNote] = useState<string | null>(null)

  // 默认焦点落在唯一主 CTA（评审按 Enter 即进街区）；触屏不自动聚焦。
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return
    ctaRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    if (!remembered) return
    setNote(`上次以「${remembered === 'candidate' ? '求职者' : 'HR'}」身份进入`)
  }, [remembered])

  return (
    <div className="gc-glass-gate">
      <div className="gg-bg">
        <img
          className="gg-bg-img"
          src={assetUrl(HERO)}
          alt="逛厂 R14 3D 招聘街区：蓝调时分的互联网区入口、路灯与中央信标"
          width={1920}
          height={1080}
          loading="eager"
          decoding="async"
        />
        <img className="gg-bloom" src={assetUrl(HERO)} alt="" aria-hidden="true" />
      </div>
      <div className="gg-vignette" aria-hidden="true" />

      <div className="gg-top">
        <div className="gg-glass gg-glass--dark gg-brand">
          <span className="cn">逛厂</span>
          <span className="en">GUǍNGCHǍNG</span>
        </div>
        <div className="gg-glass gg-glass--dark gg-issue">
          <span className="hi">FIELD SURVEY 01</span>
          <span className="dot" aria-hidden="true" />
          <span className="hide-sm">R14 / 2026</span>
        </div>
      </div>

      <section className="gg-glass gg-glass--dark gg-console" aria-labelledby="gc-glass-gate-title">
        <div className="gg-kicker">
          <i className="sq" aria-hidden="true" />
          参数空间化招聘 <span className="dim">/ OFFER AS TERRAIN</span>
        </div>
        <h1 id="gc-glass-gate-title">
          把 offer
          <br />
          读成地形<span className="stop" aria-hidden="true" />
        </h1>
        <p className="gg-deck">64 家公司的招聘街区。总包、五险、下班时间，全部砌成可以走进去的地形。</p>

        <div className="gg-data">
          <div>
            <b>64</b>
            <span>家公司</span>
          </div>
          <div>
            <b>4</b>
            <span>个行业</span>
          </div>
          <div>
            <b className="red">0</b>
            <span>个首屏 3D 资产</span>
          </div>
        </div>

        <div className="gg-cta-row">
          <button ref={ctaRef} type="button" className="gg-cta" onClick={onEnterStreet}>
            进入街区 <span className="arr" aria-hidden="true">→</span>
          </button>
          <div className="gg-note">
            无需登录
            <br />
            演示数据
          </div>
        </div>

        {note && (
          <button
            type="button"
            className="gg-remember"
            onClick={() => {
              if (remembered) onPick(remembered)
              onDismissRemembered?.()
            }}
          >
            {note} · 继续
          </button>
        )}

        <div className="gg-roles">
          <button
            type="button"
            className="gg-role"
            onClick={() => onPick('candidate')}
            aria-label="以求职者身份进入"
          >
            <span className="num">01</span>
            <span className="name">求职者</span>
            <span className="desc">逛厂看公司，不看广告</span>
            <span className="arrow" aria-hidden="true">→</span>
          </button>
          <button
            type="button"
            className="gg-role"
            onClick={() => onPick('hr')}
            aria-label="以 HR 身份进入"
          >
            <span className="num">02</span>
            <span className="name">HR</span>
            <span className="desc">让薪资被看见，不被质疑</span>
            <span className="arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </section>

      <div className="gg-spacer" aria-hidden="true" />
      <div className="gg-glass gg-glass--dark gg-plate">
        <i className="red-dot" aria-hidden="true" />
        <span>图 01 / R14 街区 / 蓝调 19:10</span>
      </div>
      <div className="gg-glass gg-glass--dark gg-foot">公司与薪资为虚构演示数据 · 3FO4K4VY3D07</div>
    </div>
  )
}
