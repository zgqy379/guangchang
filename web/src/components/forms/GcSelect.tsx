// 玻璃下拉框控件（P1 词典双端化）
import './GcSelect.css'

interface GcSelectOption {
  value: string | number
  label: string
}

interface GcSelectProps {
  label: string
  value: string | number
  options: GcSelectOption[]
  onChange: (v: string | number) => void
}

export function GcSelect({ label, value, options, onChange }: GcSelectProps) {
  return (
    <label className="gc-select">
      <span className="gc-select-label">{label}</span>
      <select
        value={String(value)}
        onChange={(e) => onChange(e.target.value as string | number)}
        className="gc-select-native"
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
