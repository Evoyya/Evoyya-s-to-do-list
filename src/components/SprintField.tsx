import type { Sprint } from '../lib/sprints'
import { SprintIcon } from './SprintIcon'

const optionClass = 'bg-[#2d2e30] text-[#e8eaed]'

// ТР-12: спринт задачи и её номер в нём. Нативные select: на iPhone — системный список.
// sprints — только действующие спринты; завершённые к выбору не предлагаются.
export function SprintField({
  sprints,
  sprintId,
  number,
  choices,
  onChange,
}: {
  sprints: Sprint[]
  sprintId: string | null
  // Номер задачи; null — в конец (для новой задачи)
  number: number | null
  // Сколько номеров можно выбрать (1…choices)
  choices: number
  onChange: (sprintId: string | null, number: number | null) => void
}) {
  const current = sprints.find((s) => s.id === sprintId)
  return (
    <div className="flex flex-wrap items-center gap-2 px-1 text-sm">
      <label className="flex items-center gap-2 rounded-full bg-surface py-1 pr-1 pl-3">
        {current ? (
          <SprintIcon shape={current.shape} number={number ?? choices} className="size-5" />
        ) : (
          <span className="text-text-muted">Спринт</span>
        )}
        <select
          value={sprintId ?? ''}
          onChange={(e) => onChange(e.target.value || null, null)}
          aria-label="Спринт"
          className="max-w-48 cursor-pointer truncate bg-transparent pr-1 text-text outline-none"
        >
          <option value="" className={optionClass}>
            Без спринта
          </option>
          {sprints.map((s) => (
            <option key={s.id} value={s.id} className={optionClass}>
              {s.title}
            </option>
          ))}
        </select>
      </label>
      {current && choices > 1 && (
        <label className="flex items-center gap-1 rounded-full bg-surface py-1 pr-1 pl-3 text-text-muted">
          №
          <select
            value={number ?? choices}
            onChange={(e) => onChange(sprintId, Number(e.target.value))}
            aria-label="Номер в спринте"
            className="cursor-pointer bg-transparent pr-1 text-text outline-none"
          >
            {Array.from({ length: choices }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n} className={optionClass}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}
