import { defineConfig } from 'vitest/config'

// Unit-тесты чистой логики (без браузера и без сети): npm test
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Клиент Supabase создаётся при импорте модулей — ему нужны хоть какие-то адрес и ключ
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'test-key',
    },
  },
})
