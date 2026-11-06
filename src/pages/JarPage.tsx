import { useRef, useState } from 'react'
import { Avatar } from '../components/Avatar'
import {
  JarDialog,
  JarSharePanel,
  MemoryForm,
  MemoryList,
  MemoryView,
} from '../components/JarDialogs'
import { JarScene } from '../components/JarScene'
import { jarButton } from '../components/jarStyles'
import { useMemoryJar } from '../hooks/useMemoryJar'
import { jarMemberName, pickRandom, type Jar } from '../lib/memoryJar'

// Длительность покачивания банки (анимация jar-shake в index.css)
const SHAKE_MS = 700

// Какое окно открыто. fromList — воспоминание открыли из списка под крышкой
type Open =
  | { kind: 'add' }
  | { kind: 'view'; id: string; fromList: boolean }
  | { kind: 'edit'; id: string; fromList: boolean }
  | { kind: 'list' }
  | { kind: 'share' }
  | null

// ТР-13: вкладка «Банка» — общая с девушкой банка воспоминаний.
// Светлый стиль вкладки задаёт Layout (класс jar-theme на main).
export function JarPage() {
  const { data: jar, isPending, error } = useMemoryJar()

  if (isPending) {
    return <p className="py-10 text-center text-sm text-jar-ink-muted">Открываем банку…</p>
  }
  if (error) {
    return (
      <p className="py-10 text-center text-sm text-jar-ink-muted">
        Не удалось открыть банку: {error.message}
      </p>
    )
  }

  return <JarView jar={jar} />
}

// Банка с кнопками и окнами (отдельно от загрузки — её показывает и образец /jar-demo)
export function JarView({ jar }: { jar: Jar }) {
  const [open, setOpen] = useState<Open>(null)
  const [shaking, setShaking] = useState(false)
  const lastShaken = useRef<string | null>(null)

  // «Встряхнуть»: банка покачивается, потом открывается случайное воспоминание
  // из всех (не только из видимых 30); то же не выпадает два раза подряд
  const shake = () => {
    const memory = pickRandom(jar.memories, lastShaken.current)
    if (!memory) return
    lastShaken.current = memory.id
    const show = () => setOpen({ kind: 'view', id: memory.id, fromList: false })
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return show()
    setShaking(true)
    setTimeout(() => {
      setShaking(false)
      show()
    }, SHAKE_MS)
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4">
      <button
        type="button"
        onClick={() => setOpen({ kind: 'share' })}
        className={`${jarButton.secondary} flex items-center gap-2 self-end py-1.5 pl-1.5`}
      >
        <span className="flex -space-x-2">
          {jar.members.map((m) => (
            <Avatar
              key={m.user_id}
              name={jarMemberName(m)}
              url={m.profile?.avatar_url}
              className="size-6 text-xs ring-2 ring-white"
            />
          ))}
        </span>
        {jar.members.length < 2 ? 'Пригласить' : 'Наша банка'}
      </button>

      <JarScene
        jarId={jar.id}
        memories={jar.memories}
        members={jar.members}
        onOpen={(m) => setOpen({ kind: 'view', id: m.id, fromList: false })}
        onLid={() => setOpen({ kind: 'list' })}
        shaking={shaking}
      />

      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => setOpen({ kind: 'add' })}
          className={jarButton.primary}
        >
          Добавить воспоминание
        </button>
        <button
          type="button"
          onClick={shake}
          disabled={jar.memories.length === 0 || shaking}
          className={jarButton.secondary}
        >
          Встряхнуть
        </button>
      </div>

      {open && <JarWindow jar={jar} open={open} setOpen={setOpen} />}
    </div>
  )
}

function JarWindow({
  jar,
  open,
  setOpen,
}: {
  jar: Jar
  open: NonNullable<Open>
  setOpen: (open: Open) => void
}) {
  const close = () => setOpen(null)
  const toList = () => setOpen({ kind: 'list' })

  if (open.kind === 'add') {
    return (
      <JarDialog label="Новое воспоминание" onClose={close}>
        <MemoryForm jar={jar} onDone={close} onCancel={close} />
      </JarDialog>
    )
  }

  if (open.kind === 'list') {
    return (
      <JarDialog label="Все воспоминания" onClose={close}>
        <MemoryList
          jar={jar}
          onOpen={(m) => setOpen({ kind: 'view', id: m.id, fromList: true })}
          onClose={close}
        />
      </JarDialog>
    )
  }

  if (open.kind === 'share') {
    return (
      <JarDialog label="Участники банки" onClose={close}>
        <JarSharePanel jar={jar} onClose={close} />
      </JarDialog>
    )
  }

  // Воспоминание могли удалить (в том числе со второго устройства) — окно закрывается
  const memory = jar.memories.find((m) => m.id === open.id)
  if (!memory) return null
  const back = open.fromList ? toList : close

  return (
    <JarDialog label={memory.title || 'Воспоминание'} onClose={close}>
      {open.kind === 'edit' ? (
        <MemoryForm
          jar={jar}
          memory={memory}
          onDone={() => setOpen({ ...open, kind: 'view' })}
          onCancel={() => setOpen({ ...open, kind: 'view' })}
        />
      ) : (
        <MemoryView
          jar={jar}
          memory={memory}
          onEdit={() => setOpen({ ...open, kind: 'edit' })}
          onDeleted={back}
          onBack={open.fromList ? toList : undefined}
          onClose={close}
        />
      )}
    </JarDialog>
  )
}
