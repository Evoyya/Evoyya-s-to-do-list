import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useCreateLabel, useMyLabels } from '../hooks/useLabels'
import { freeColor, labelProblem, makeLabel, type Label } from '../lib/labels'
import { ColorDot, ColorPicker } from './ColorPicker'

// ТР-9: на общей заметке у создателя есть ярлык, которого нет у этого пользователя.
// Ярлык не показывается, а здесь предлагается завести такой же у себя.
export function MissingLabels({ missing }: { missing: Label[] }) {
  if (missing.length === 0) return null
  return (
    <ul className="flex flex-col gap-2">
      {missing.map((label) => (
        <MissingLabel key={label.id} label={label} />
      ))}
    </ul>
  )
}

function MissingLabel({ label }: { label: Label }) {
  const { session } = useAuth()
  const mine = useMyLabels()
  const createLabel = useCreateLabel()
  // Цвет создателя, если он у пользователя свободен; иначе нужно выбрать другой
  const taken = mine.find((l) => l.color === label.color)
  const [picking, setPicking] = useState(false)
  const [color, setColor] = useState(() => (taken ? freeColor(mine) : label.color))
  const problem = labelProblem(mine, label.name, color)

  const create = () => {
    if (problem) return
    createLabel.mutate(makeLabel(session!.user.id, label.name, color))
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-dashed border-border/60 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <ColorDot color={label.color} />
        <span className="min-w-0 flex-1">
          У создателя есть ярлык «{label.name}», у вас такого нет
          {taken && (
            <span className="text-text-muted">. Его цвет у вас занят ярлыком «{taken.name}»</span>
          )}
        </span>
        {taken && !picking ? (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="rounded-full bg-accent/20 px-3 py-1 font-medium text-accent hover:bg-accent/30"
          >
            Выбрать цвет и создать
          </button>
        ) : (
          !picking && (
            <button
              type="button"
              onClick={create}
              className="rounded-full bg-accent/20 px-3 py-1 font-medium text-accent hover:bg-accent/30"
            >
              Создать такой же
            </button>
          )
        )}
      </div>
      {picking && (
        <>
          <ColorPicker value={color} onChange={setColor} others={mine} />
          {problem && <p className="text-red-400">{problem}</p>}
          <div className="flex justify-end gap-1">
            <button
              type="button"
              onClick={() => setPicking(false)}
              className="rounded-full px-3 py-1 text-text-muted hover:bg-surface-raised"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={create}
              disabled={!!problem}
              className="rounded-full bg-accent/20 px-3 py-1 font-medium text-accent hover:bg-accent/30 disabled:opacity-40"
            >
              Создать
            </button>
          </div>
        </>
      )}
    </li>
  )
}
