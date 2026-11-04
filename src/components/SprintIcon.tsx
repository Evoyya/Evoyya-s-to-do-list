import type { SprintShape } from '../lib/sprints'
import { shapeLabel } from '../lib/sprints'

// ТР-12: фигуры спринтов в квадрате 24×24. textY — где поместить номер, чтобы он
// оказался в самой широкой части фигуры.
const SHAPE_PATHS: Record<SprintShape, { d: string; textY: number; fontSize: number }> = {
  circle: { d: 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20Z', textY: 12, fontSize: 10 },
  square: {
    d: 'M5.5 2.5h13a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3h-13a3 3 0 0 1-3-3v-13a3 3 0 0 1 3-3Z',
    textY: 12,
    fontSize: 10,
  },
  triangle: { d: 'M12 2.5 22.5 20.5h-21Z', textY: 15, fontSize: 8.5 },
  diamond: { d: 'M12 1.5 22.5 12 12 22.5 1.5 12Z', textY: 12, fontSize: 9 },
  hexagon: { d: 'M12 1.5l9.5 5.25v10.5L12 22.5l-9.5-5.25V6.75Z', textY: 12, fontSize: 10 },
  star: {
    // «Толстая» звезда: в узкой середине обычной звезды номер не читается
    d: 'M12 1.6 15.76 7.62 22.65 9.34 18.09 14.78 18.58 21.86 12 19.2 5.42 21.86 5.91 14.78 1.35 9.34 8.24 7.62Z',
    textY: 13.6,
    fontSize: 8.5,
  },
  heart: {
    d: 'M12 21.5S2.5 15.6 2.5 9.3A5.2 5.2 0 0 1 12 6.3a5.2 5.2 0 0 1 9.5 3c0 6.3-9.5 12.2-9.5 12.2Z',
    textY: 12.2,
    fontSize: 8.5,
  },
  shield: {
    d: 'M12 1.8 20.5 5v6.3c0 5.3-3.6 9.3-8.5 10.9-4.9-1.6-8.5-5.6-8.5-10.9V5Z',
    textY: 11.5,
    fontSize: 9.5,
  },
}

// Фигура спринта; с number — номер задачи внутри фигуры.
// filled — тёмная подложка, чтобы фигура читалась на карточке любого цвета.
export function SprintIcon({
  shape,
  number,
  filled = false,
  className = 'size-[18px]',
  title,
}: {
  shape: SprintShape
  number?: number | null
  filled?: boolean
  className?: string
  title?: string
}) {
  const { d, textY, fontSize } = SHAPE_PATHS[shape]
  const label = title ?? (number ? `${shapeLabel(shape)}, задача № ${number}` : shapeLabel(shape))
  // Двузначный номер чуть мельче, чтобы поместился в фигуру
  const size = number && number >= 10 ? fontSize * 0.82 : fontSize
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      role="img"
      aria-label={label}
      strokeLinejoin="round"
    >
      <title>{label}</title>
      <path
        d={d}
        fill={filled ? 'rgb(0 0 0 / 0.45)' : 'none'}
        stroke={filled ? '#e8eaed' : 'currentColor'}
        strokeWidth={filled ? 1.3 : 1.8}
      />
      {number != null && (
        <text
          x="12"
          y={textY}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={size}
          fontWeight={600}
          fill={filled ? '#e8eaed' : 'currentColor'}
        >
          {number}
        </text>
      )}
    </svg>
  )
}

// Выбор фигуры: занятые действующими спринтами недоступны
export function ShapePicker({
  value,
  free,
  onChange,
}: {
  value: SprintShape | null
  free: SprintShape[]
  onChange: (shape: SprintShape) => void
}) {
  return (
    <div role="radiogroup" aria-label="Иконка спринта" className="flex flex-wrap gap-1">
      {(Object.keys(SHAPE_PATHS) as SprintShape[]).map((shape) => {
        const taken = !free.includes(shape)
        const selected = value === shape
        return (
          <button
            key={shape}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={taken}
            onClick={() => onChange(shape)}
            title={taken ? `${shapeLabel(shape)} — занята другим спринтом` : shapeLabel(shape)}
            className={`flex size-10 items-center justify-center rounded-full transition-colors ${
              selected
                ? 'bg-accent/20 text-accent'
                : 'text-text-muted hover:bg-surface hover:text-text'
            } disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent`}
          >
            <SprintIcon shape={shape} className="size-6" />
          </button>
        )
      })}
    </div>
  )
}
