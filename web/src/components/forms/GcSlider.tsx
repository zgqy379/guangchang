// 玻璃滑杆控件（P1 词典双端化）
//
// 玻璃浮层垫实底（--ui-glass-underlay + --ui-glass-fill），卡片内禁用 muted 色，
// 按最坏背景验算对比度（见 project.md v1.4-4 / lessons §10.1）。
import { useState } from 'react'
import './GcSlider.css'

interface GcSliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  format?: 'plain' | 'wan-yuan' | 'clock-hour'
  unit?: string
  onChange: (v: number) => void
}

export function GcSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  unit,
  onChange,
}: GcSliderProps) {
  const [dragging, setDragging] = useState(false)

  const formatted = (v: number): string => {
    if (format === 'wan-yuan') {
      const w = v / 10000
      return w >= 1 ? `${w % 1 === 0 ? w : w.toFixed(1)} 万` : `${v} 元`
    }
    if (format === 'clock-hour') {
      const h = Math.floor(v)
      const m = Math.round((v - h) * 60)
      return `${String(h % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }
    return `${v}${unit ?? ''}`
  }

  return (
    <label className="gc-slider">
      <span className="gc-slider-label">
        {label}
        <span className="gc-slider-value">{formatted(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onMouseDown={() => setDragging(true)}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`gc-slider-track${dragging ? ' gc-slider-track--active' : ''}`}
      />
    </label>
  )
}
