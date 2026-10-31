import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { AuthProvider } from './auth/AuthProvider'
import { RequireAuth } from './auth/RequireAuth'
import { Layout } from './components/Layout'
import { ToastProvider } from './components/Toast'
import './index.css'
import { persistOptions, queryClient } from './lib/queryClient'
import { BoardPage } from './pages/BoardPage'

// Доска загружается сразу, остальные страницы — когда на них перейдут:
// так приложение открывается быстрее
const router = createBrowserRouter([
  {
    path: '/login',
    lazy: async () => ({ Component: (await import('./pages/LoginPage')).LoginPage }),
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <BoardPage /> },
          {
            path: 'archive',
            lazy: async () => ({ Component: (await import('./pages/ArchivePage')).ArchivePage }),
          },
          {
            path: 'labels',
            lazy: async () => ({ Component: (await import('./pages/LabelsPage')).LabelsPage }),
          },
          {
            path: 'stats',
            lazy: async () => ({ Component: (await import('./pages/StatsPage')).StatsPage }),
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
)
