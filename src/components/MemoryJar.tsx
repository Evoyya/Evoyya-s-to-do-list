import { useMemo, type CSSProperties, type KeyboardEvent } from 'react'
import { heartColor, layoutHearts, shortDate, type JarMember, type Memory } from '../lib/memoryJar'

// ТР-13: банка воспоминаний — рисунок по мотивам референса: прозрачная банка
// с «рукописным» сливовым контуром, рифлёная розовая крышка, блики на стекле,
// штрихи сияния по бокам и глянцевые сердечки внутри. viewBox 0 0 340 400.

const INK = 'var(--color-jar-ink)'

// Корпус банки: узкое горлышко, округлые плечи, закруглённое дно
const BODY =
  'M 106 104 C 70 108 40 128 40 168 L 40 346 C 40 376 58 390 88 390 ' +
  'L 252 390 C 282 390 300 376 300 346 L 300 168 C 300 128 270 108 234 104 Z'

// Пухлое сердце в квадрате 100×100, центр — (50, 49)
export const HEART_PATH =
  'M50 88 C 20 68, 6 50, 8 32 C 10 16, 24 8, 36 10 C 44 11, 49 17, 50 22 ' +
  'C 51 17, 56 11, 64 10 C 76 8, 90 16, 92 32 C 94 50, 80 68, 50 88 Z'

// Штрихи сияния слева; справа — зеркально
const SPARKLES = [
  [28, 104, 15, 93],
  [24, 126, 7, 124],
  [28, 148, 15, 156],
]

// Откуда падает новое сердечко: от горлышка банки
const FALL_FROM = 40

const STRIPES = [110, 127, 144, 161, 179, 196, 213, 230]

function onActivate(action: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      action()
    }
  }
}

// Сердечко с датой. Внутренняя группа увеличивается при наведении (index.css)
export function HeartShape({ color, label }: { color: string; label?: string }) {
  return (
    <g>
      <path
        className="jar-heart-shape"
        d={HEART_PATH}
        fill={color}
        stroke={INK}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      {/* Глянцевый блик на левой половинке */}
      <path
        d="M 20 34 C 19 25, 25 19, 33 19"
        fill="none"
        stroke="#fff"
        strokeWidth={6}
        strokeLinecap="round"
        opacity={0.95}
      />
      <circle cx={19} cy={42} r={3} fill="#fff" opacity={0.9} />
      {label && (
        <text
          x={50}
          y={55}
          textAnchor="middle"
          fontSize={19}
          fontWeight={700}
          fill={INK}
          style={{ fontFamily: "ui-rounded, 'SF Pro Rounded', 'Nunito', system-ui, sans-serif" }}
        >
          {label}
        </text>
      )}
    </g>
  )
}

export function MemoryJar({
  memories,
  members,
  onOpen,
  onLid,
  falling,
  shaking,
  className = '',
}: {
  // Уже отобранные для банки (до 30), старые первыми — они лежат внизу
  memories: Memory[]
  members: JarMember[]
  onOpen?: (memory: Memory) => void
  onLid?: () => void
  // Только что положенные сердечки — падают сверху в банку
  falling?: ReadonlySet<string>
  // Банку встряхивают — она покачивается
  shaking?: boolean
  className?: string
}) {
  const places = useMemo(() => layoutHearts(memories.map((m) => m.id)), [memories])

  return (
    <svg
      viewBox="0 0 340 400"
      className={`${className} ${shaking ? 'jar-shake' : ''}`}
      role="group"
      aria-label="Банка воспоминаний"
    >
      <defs>
        <clipPath id="jar-inside">
          <path d={BODY} />
        </clipPath>
        <linearGradient id="jar-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="var(--color-jar-pink-soft)" />
        </linearGradient>
      </defs>

      {/* Стекло */}
      <path d={BODY} fill="url(#jar-glass)" />
      {/* Линия дна */}
      <path
        d="M 54 364 C 56 375 68 380 88 380 L 252 380 C 272 380 284 375 286 364"
        fill="none"
        stroke={INK}
        strokeWidth={2.5}
        strokeLinecap="round"
        opacity={0.55}
      />

      {/* Сердечки */}
      <g clipPath="url(#jar-inside)">
        {memories.map((m, i) => {
          const p = places[i]
          if (!p) return null
          const label = m.title
            ? `${shortDate(m.memory_date)}, ${m.title}`
            : shortDate(m.memory_date)
          // Слои: место в куче → падение сверху → поворот → увеличение при наведении → размер
          return (
            <g
              key={m.id}
              className="jar-heart"
              transform={`translate(${p.x} ${p.y})`}
              role="button"
              tabIndex={onOpen ? 0 : -1}
              aria-label={`Воспоминание ${label}`}
              onClick={onOpen && (() => onOpen(m))}
              onKeyDown={onOpen && onActivate(() => onOpen(m))}
            >
              <g
                className={falling?.has(m.id) ? 'jar-heart-fall' : undefined}
                style={{ '--fall': `${FALL_FROM - p.y}px` } as CSSProperties}
              >
                <g transform={`rotate(${p.rotate})`}>
                  <g className="jar-heart-hover">
                    <g transform={`scale(${p.size / 100}) translate(-50 -49)`}>
                      <HeartShape
                        color={heartColor(m.author_id, members)}
                        label={shortDate(m.memory_date)}
                      />
                    </g>
                  </g>
                </g>
              </g>
            </g>
          )
        })}
      </g>

      {/* Блики на стекле поверх сердечек */}
      <g stroke="#fff" strokeLinecap="round" fill="none" pointerEvents="none">
        <path d="M 55 186 L 55 300" strokeWidth={8} opacity={0.9} />
        <path d="M 55 316 L 55 332" strokeWidth={8} opacity={0.9} />
        <path d="M 286 296 L 286 334" strokeWidth={4} opacity={0.7} />
      </g>

      {/* Контур банки */}
      <path
        d={BODY}
        fill="none"
        stroke={INK}
        strokeWidth={4.5}
        strokeLinejoin="round"
        pointerEvents="none"
      />

      {/* Горлышко */}
      <rect
        x={100}
        y={88}
        width={140}
        height={18}
        rx={7}
        fill="#fff"
        stroke={INK}
        strokeWidth={4}
        pointerEvents="none"
      />

      {/* Крышка: нажатие открывает список всех воспоминаний */}
      <g
        className="jar-lid"
        role="button"
        tabIndex={onLid ? 0 : -1}
        aria-label="Открыть список воспоминаний"
        onClick={onLid}
        onKeyDown={onLid && onActivate(onLid)}
      >
        <rect
          className="jar-lid-shape"
          x={92}
          y={34}
          width={156}
          height={58}
          rx={14}
          fill="var(--color-jar-lid)"
          stroke={INK}
          strokeWidth={4.5}
        />
        <rect x={102} y={41} width={136} height={8} rx={4} fill="#fff" opacity={0.75} />
        {STRIPES.map((x) => (
          <line
            key={x}
            x1={x}
            y1={58}
            x2={x}
            y2={82}
            stroke={INK}
            strokeWidth={4}
            strokeLinecap="round"
          />
        ))}
      </g>

      {/* Штрихи сияния */}
      <g stroke={INK} strokeWidth={4} strokeLinecap="round" pointerEvents="none">
        {SPARKLES.map(([x1, y1, x2, y2]) => (
          <g key={y1}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} />
            <line x1={340 - x1} y1={y1} x2={340 - x2} y2={y2} />
          </g>
        ))}
      </g>
    </svg>
  )
}
