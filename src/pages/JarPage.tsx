import { JarScene } from '../components/JarScene'
import { useMemoryJar } from '../hooks/useMemoryJar'

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

  return (
    <div className="mx-auto max-w-md">
      <JarScene jarId={jar.id} memories={jar.memories} members={jar.members} />
    </div>
  )
}
