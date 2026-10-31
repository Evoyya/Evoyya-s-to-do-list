import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Иконки приложения из public/icon.svg: npm run icons.
// Безопасный отступ для круглых и скруглённых иконок уже заложен в самом SVG,
// поэтому генератор своих отступов не добавляет.
const noPadding = { padding: 0, resizeOptions: { background: '#202124' } }

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    apple: { ...minimal2023Preset.apple, ...noPadding },
    maskable: { ...minimal2023Preset.maskable, ...noPadding },
  },
  images: ['public/icon.svg'],
})
