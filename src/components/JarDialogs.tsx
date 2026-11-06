import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import {
  useAddMemory,
  useDeleteMemory,
  useRemoveJarMember,
  useShareJar,
  useUpdateMemory,
} from '../hooks/useMemoryJar'
import {
  BODY_MAX,
  cleanDraft,
  draftError,
  groupByMonth,
  heartColor,
  jarMemberName,
  localDateKey,
  longDate,
  shortDate,
  TITLE_MAX,
  type Jar,
  type Memory,
  type MemoryDraft,
} from '../lib/memoryJar'
import { Avatar } from './Avatar'
import { HEART_PATH } from './MemoryJar'
import { jarButton, jarField as field } from './jarStyles'
import { useToast } from './Toast'

// ТР-13: окна банки воспоминаний — в светлом бело-розовом стиле вкладки

// Оболочка окна: светлая карточка поверх затемнения
export function JarDialog({
  label,
  onClose,
  children,
}: {
  label: string
  onClose: () => void
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    // Поле с data-autofocus (текст воспоминания) — сразу с курсором, иначе фокус на окне
    ;(dialog.querySelector<HTMLElement>('[data-autofocus]') ?? dialog).focus()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      tabIndex={-1}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose()
      }}
      className="jar-theme m-auto max-h-[88dvh] w-[min(26rem,calc(100%-2rem))] overflow-y-auto rounded-3xl border border-jar-line p-0 shadow-2xl shadow-jar-ink/20 outline-none backdrop:bg-jar-ink/35"
    >
      <div className="flex flex-col gap-4 p-5">{children}</div>
    </dialog>
  )
}

// Маленькое сердечко цвета автора (список, заголовок окна)
export function TinyHeart({ color, className = 'size-5' }: { color: string; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={`shrink-0 ${className}`} aria-hidden="true">
      <path
        d={HEART_PATH}
        fill={color}
        stroke="var(--color-jar-ink)"
        strokeWidth={8}
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ------------------------------------------------------------
// Добавление и правка
// ------------------------------------------------------------

export function MemoryForm({
  jar,
  memory,
  onDone,
  onCancel,
}: {
  jar: Jar
  // Есть — правка своего воспоминания; нет — новое
  memory?: Memory
  onDone: (id: string) => void
  onCancel: () => void
}) {
  const today = localDateKey()
  const [draft, setDraft] = useState<MemoryDraft>({
    title: memory?.title ?? '',
    body: memory?.body ?? '',
    memory_date: memory?.memory_date ?? today,
  })
  const [touched, setTouched] = useState(false)
  const addMemory = useAddMemory()
  const updateMemory = useUpdateMemory()
  const error = draftError(draft, today)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (error) return
    const clean = cleanDraft(draft)
    if (memory) {
      updateMemory.mutate({ id: memory.id, patch: clean })
      onDone(memory.id)
    } else {
      const id = crypto.randomUUID()
      addMemory.mutate({ ...clean, id, jar_id: jar.id })
      onDone(id)
    }
  }

  const left = BODY_MAX - draft.body.length

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">
        {memory ? 'Изменить воспоминание' : 'Новое воспоминание'}
      </h2>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-jar-ink-muted">Название (необязательно)</span>
        <input
          value={draft.title ?? ''}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          maxLength={TITLE_MAX}
          placeholder="Например, «Первый снег»"
          className={field}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-jar-ink-muted">Что запомнилось</span>
        <textarea
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          maxLength={BODY_MAX}
          rows={4}
          data-autofocus
          placeholder="Одно-два предложения"
          className={`${field} resize-none`}
        />
        <span
          className={`self-end text-xs ${left <= 20 ? 'text-jar-rose' : 'text-jar-ink-muted'}`}
          aria-live="polite"
        >
          Осталось {left}
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-jar-ink-muted">Дата</span>
        <input
          type="date"
          value={draft.memory_date}
          max={today}
          onChange={(e) => setDraft({ ...draft, memory_date: e.target.value })}
          className={field}
        />
      </label>

      {touched && error && <p className="text-sm text-jar-rose">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className={jarButton.quiet}>
          Отмена
        </button>
        <button type="submit" disabled={!draft.body.trim()} className={jarButton.primary}>
          {memory ? 'Сохранить' : 'Положить в банку'}
        </button>
      </div>
    </form>
  )
}

// ------------------------------------------------------------
// Окно воспоминания
// ------------------------------------------------------------

export function MemoryView({
  jar,
  memory,
  onEdit,
  onDeleted,
  onBack,
  onClose,
}: {
  jar: Jar
  memory: Memory
  onEdit: () => void
  onDeleted: () => void
  // Открыто из списка под крышкой — можно вернуться к нему
  onBack?: () => void
  onClose: () => void
}) {
  const { session } = useAuth()
  const isAuthor = memory.author_id === session?.user.id
  const author = jar.members.find((m) => m.user_id === memory.author_id)
  const deleteMemory = useDeleteMemory()
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <div className="-mx-2 -mb-2 flex items-center justify-between">
        {onBack ? (
          <button type="button" onClick={onBack} className={jarButton.quiet}>
            ← К списку
          </button>
        ) : (
          <span />
        )}
        <button type="button" onClick={onClose} className={jarButton.quiet}>
          Закрыть
        </button>
      </div>

      <div className="flex items-start gap-3">
        <TinyHeart color={heartColor(memory.author_id, jar.members)} className="mt-0.5 size-8" />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold break-words">{memory.title || 'Воспоминание'}</h2>
          <p className="text-sm text-jar-ink-muted">{longDate(memory.memory_date)}</p>
        </div>
      </div>

      <p className="text-base leading-relaxed break-words whitespace-pre-wrap">{memory.body}</p>

      <div className="flex items-center gap-2 border-t border-jar-line pt-3 text-sm text-jar-ink-muted">
        {author ? (
          <>
            <Avatar
              name={jarMemberName(author)}
              url={author.profile?.avatar_url}
              className="size-6 text-xs"
            />
            <span className="min-w-0 truncate">
              {jarMemberName(author)}
              {isAuthor && ' (вы)'}
            </span>
          </>
        ) : (
          <span>{isAuthor ? 'Вы' : 'Участник, который вышел из банки'}</span>
        )}
      </div>

      {isAuthor &&
        (confirming ? (
          <div className="flex flex-col gap-2 rounded-2xl bg-jar-pink-soft p-3">
            <p className="text-sm">Удалить воспоминание навсегда?</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className={jarButton.quiet}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteMemory.mutate(memory.id)
                  onDeleted()
                }}
                className={jarButton.primary}
              >
                Удалить
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfirming(true)} className={jarButton.quiet}>
              Удалить
            </button>
            <button type="button" onClick={onEdit} className={jarButton.secondary}>
              Изменить
            </button>
          </div>
        ))}
    </div>
  )
}

// ------------------------------------------------------------
// Список под крышкой
// ------------------------------------------------------------

export function MemoryList({
  jar,
  onOpen,
  onClose,
}: {
  jar: Jar
  onOpen: (memory: Memory) => void
  onClose: () => void
}) {
  const groups = groupByMonth(jar.memories)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Все воспоминания</h2>
        <button type="button" onClick={onClose} className={jarButton.quiet}>
          Закрыть
        </button>
      </div>

      {groups.length === 0 && (
        <p className="py-4 text-center text-sm text-jar-ink-muted">Банка пока пустая</p>
      )}

      {groups.map((group) => (
        <section key={group.month} className="flex flex-col gap-1">
          <h3 className="text-xs font-semibold tracking-wide text-jar-ink-muted uppercase">
            {group.label}
          </h3>
          <ul className="flex flex-col">
            {group.items.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onOpen(m)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-jar-pink-soft"
                >
                  <TinyHeart color={heartColor(m.author_id, jar.members)} />
                  <span className="w-11 shrink-0 text-sm text-jar-ink-muted tabular-nums">
                    {shortDate(m.memory_date)}
                  </span>
                  <span className="min-w-0 truncate text-sm">{m.title || m.body}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

// ------------------------------------------------------------
// Участники банки
// ------------------------------------------------------------

export function JarSharePanel({ jar, onClose }: { jar: Jar; onClose: () => void }) {
  const { session } = useAuth()
  const me = session?.user.id
  const isOwner = jar.members.some((m) => m.user_id === me && m.role === 'owner')
  const shareJar = useShareJar()
  const removeMember = useRemoveJarMember()
  const showToast = useToast()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    setError(null)
    shareJar.mutate(trimmed, {
      onSuccess: () => {
        setEmail('')
        showToast(`Банка теперь общая с ${trimmed}`)
      },
      onError: (err) => setError(err.message),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Наша банка</h2>
        <button type="button" onClick={onClose} className={jarButton.quiet}>
          Закрыть
        </button>
      </div>

      <ul className="flex flex-col gap-3">
        {jar.members.map((m) => (
          <li key={m.user_id} className="flex items-center gap-3">
            <Avatar
              name={jarMemberName(m)}
              url={m.profile?.avatar_url}
              className="size-9 text-sm"
            />
            <TinyHeart color={heartColor(m.user_id, jar.members)} className="size-4" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">
                {jarMemberName(m)}
                {m.user_id === me && <span className="text-jar-ink-muted"> (вы)</span>}
              </p>
              <p className="truncate text-xs text-jar-ink-muted">
                {m.role === 'owner' ? 'Создатель банки' : m.profile?.email}
              </p>
            </div>
            {isOwner && m.role !== 'owner' && (
              <button
                type="button"
                onClick={() => removeMember.mutate({ jarId: jar.id, userId: m.user_id })}
                className={jarButton.quiet}
              >
                Закрыть доступ
              </button>
            )}
            {!isOwner && m.user_id === me && (
              <button
                type="button"
                onClick={() => setConfirmLeave(true)}
                className={jarButton.quiet}
              >
                Выйти
              </button>
            )}
          </li>
        ))}
      </ul>

      {confirmLeave && (
        <div className="flex flex-col gap-2 rounded-2xl bg-jar-pink-soft p-3">
          <p className="text-sm">
            Выйти из общей банки? Ваши воспоминания останутся в ней, а у вас будет новая пустая
            банка.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmLeave(false)}
              className={jarButton.quiet}
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => {
                removeMember.mutate({ jarId: jar.id, userId: me! })
                onClose()
              }}
              className={jarButton.primary}
            >
              Выйти
            </button>
          </div>
        </div>
      )}

      {isOwner && jar.members.length < 2 && (
        <form onSubmit={submit} className="flex flex-col gap-2">
          <p className="text-sm text-jar-ink-muted">
            Пригласите второго человека по email — он должен хотя бы раз войти в приложение.
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError(null)
              }}
              placeholder="Email"
              aria-label="Email второго участника"
              autoComplete="email"
              className={`${field} min-w-0 flex-1`}
            />
            <button
              type="submit"
              disabled={!email.trim() || shareJar.isPending}
              className={jarButton.primary}
            >
              Пригласить
            </button>
          </div>
          {error && <p className="text-sm text-jar-rose">{error}</p>}
        </form>
      )}
    </div>
  )
}
