import { useQuery } from '@tanstack/react-query'
import { fetchJar, JAR_KEY } from '../lib/memoryJar'

export { JAR_KEY }

// ТР-13: банка пользователя с участниками и всеми воспоминаниями
export function useMemoryJar() {
  return useQuery({ queryKey: JAR_KEY, queryFn: fetchJar })
}
