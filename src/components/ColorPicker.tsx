import { HexColorInput, HexColorPicker } from 'react-colorful'
import { normalizeHex, readableText } from '../lib/color'
import { PALETTE, PALETTE_COLORS, type Label } from '../lib/labels'

// ТР-6: цвет ярлыка — из палитры или любой свой. Цвета чужих ярлыков недоступны.
export function ColorPicker({
  value,
  onChange,
  others,
}: {
  value: string
  onChange: (color: string) => void
  // Остальные ярлыки пользователя: их цвета заняты
  others: Label[]
}) {
  const takenBy = new Map(others.map((l) => [l.color, l.name]))

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-surface p-3">
      {/* Два ряда по 12, как в Google Календаре; на телефоне три ряда по 8 */}
      <div
        role="radiogroup"
        aria-label="Палитра"
        className="grid w-fit grid-cols-8 gap-2 sm:grid-cols-12"
      >
        {PALETTE_COLORS.map(({ color, name }) => {
          const owner = takenBy.get(color)
          const selected = color === value
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={owner ? `${name}, занят ярлыком «${owner}»` : name}
              title={owner ? `${name} — занят ярлыком «${owner}»` : name}
              disabled={!!owner}
              onClick={() => onChange(color)}
              style={{ backgroundColor: color, color: readableText(color).text }}
              className={`flex size-7 items-center justify-center rounded-full border-2 text-sm disabled:cursor-not-allowed disabled:opacity-30 sm:size-8 ${
                selected ? 'border-text' : 'border-transparent hover:border-text-muted'
              }`}
            >
              {selected && '✓'}
            </button>
          )
        })}
      </div>

      <details className="group" open={!PALETTE.includes(value)}>
        <summary className="cursor-pointer text-sm text-text-muted select-none hover:text-text">
          Свой цвет
        </summary>
        <div className="mt-3 flex flex-col gap-2">
          <HexColorPicker
            color={value}
            onChange={(color) => onChange(normalizeHex(color))}
            style={{ width: '100%', maxWidth: '18rem', height: '9rem' }}
          />
          <label className="flex items-center gap-2 text-sm text-text-muted">
            HEX
            <HexColorInput
              color={value}
              onChange={(color) => onChange(normalizeHex(color))}
              prefixed
              aria-label="Код цвета"
              className="w-24 rounded border border-border/60 bg-surface-raised px-2 py-1 font-mono text-base text-text outline-none focus:border-accent"
            />
          </label>
        </div>
      </details>
    </div>
  )
}

// Кружок цвета ярлыка
export function ColorDot({ color, className = 'size-3' }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full ${className}`}
      style={{ backgroundColor: color }}
    />
  )
}
