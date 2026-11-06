import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import {
  deleteMemory,
  fetchJar,
  insertMemory,
  JAR_KEY,
  removeJarMember,
  shareJar,
  updateMemory,
  type Jar,
  type MemoryDraft,
  type NewMemory,
} from '../lib/memoryJar'

export { JAR_KEY }

// ТР-13: банка пользователя с участниками и всеми воспоминаниями
export function useMemoryJar() {
  return useQuery({ queryKey: JAR_KEY, queryFn: fetchJar })
}

// Изменение сразу видно в банке; при ошибке сервера банка откатывается
function useOptimisticJar<TVars>(
  mutationFn: (vars: TVars) => Promise<void>,
  apply: (jar: Jar, vars: TVars) => Jar,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: JAR_KEY })
      const previous = queryClient.getQueryData<Jar>(JAR_KEY)
      if (previous) queryClient.setQueryData<Jar>(JAR_KEY, apply(previous, vars))
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(JAR_KEY, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: JAR_KEY }),
  })
}

export function useAddMemory() {
  const { session } = useAuth()
  return useOptimisticJar<NewMemory>(insertMemory, (jar, memory) => {
    const now = new Date().toISOString()
    return {
      ...jar,
      memories: [
        ...jar.memories,
        { ...memory, author_id: session?.user.id ?? null, created_at: now, updated_at: now },
      ],
    }
  })
}

export function useUpdateMemory() {
  return useOptimisticJar<{ id: string; patch: MemoryDraft }>(
    ({ id, patch }) => updateMemory(id, patch),
    (jar, { id, patch }) => ({
      ...jar,
      memories: jar.memories.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }),
  )
}

export function useDeleteMemory() {
  return useOptimisticJar<string>(deleteMemory, (jar, id) => ({
    ...jar,
    memories: jar.memories.filter((m) => m.id !== id),
  }))
}

// Новый участник появится после ответа сервера: его профиль заранее неизвестен
export function useShareJar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: shareJar,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: JAR_KEY }),
    // Ошибку («ещё не входил», «уже есть своя банка») показывает само окно
    meta: { silent: true },
  })
}

// Вышедший сам получает новую пустую банку при перечитывании (ensure_my_jar)
export function useRemoveJarMember() {
  return useOptimisticJar<{ jarId: string; userId: string }>(
    ({ jarId, userId }) => removeJarMember(jarId, userId),
    (jar, { userId }) => ({ ...jar, members: jar.members.filter((m) => m.user_id !== userId) }),
  )
}
