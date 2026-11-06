import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { JarView } from './JarPage'
import type { JarMember, Memory } from '../lib/memoryJar'

// Только в режиме разработки: банка с придуманными воспоминаниями без входа,
// чтобы сверять рисунок с референсом. /jar-demo?n=30
const members: JarMember[] = [
  { jar_id: 'demo', user_id: 'a', role: 'owner', profile: null },
  { jar_id: 'demo', user_id: 'b', role: 'editor', profile: null },
]

function demoMemories(n: number): Memory[] {
  return Array.from({ length: n }, (_, i) => {
    const day = new Date(2026, 0, 1 + i * 9)
    const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
    return {
      id: `demo-${i}`,
      jar_id: 'demo',
      author_id: i % 3 === 0 ? 'b' : 'a',
      title: i % 4 === 0 ? 'Первый снег' : null,
      body: `Воспоминание ${i + 1}: гуляли до ночи и смеялись над всем подряд.`,
      memory_date: date,
      created_at: `${date}T12:00:00Z`,
      updated_at: `${date}T12:00:00Z`,
    }
  })
}

export function JarDemoPage() {
  const [params] = useSearchParams()
  const [memories, setMemories] = useState(() => demoMemories(Number(params.get('n') ?? 24)))

  // Как будто второй участник только что положил воспоминание: сердечко падает
  const drop = () => {
    const now = new Date()
    const date = now.toISOString().slice(0, 10)
    setMemories((list) => [
      ...list,
      {
        id: 'drop-' + now.getTime(),
        jar_id: 'demo',
        author_id: 'b',
        title: 'Сегодня',
        body: 'Тестовое сердечко из образца.',
        memory_date: date,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
    ])
  }

  return (
    <div className="jar-theme min-h-dvh px-4 pt-6">
      <JarView jar={{ id: 'demo', members, memories }} />
      <button type="button" onClick={drop} className="mx-auto mt-6 block text-xs underline">
        Уронить тестовое сердечко
      </button>
    </div>
  )
}
