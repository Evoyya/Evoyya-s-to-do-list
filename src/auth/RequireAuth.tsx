import { Navigate, Outlet, useLocation } from 'react-router'
import { FullScreenMessage } from '../components/FullScreenMessage'
import { useAuth } from './AuthProvider'

// Пропускает к вложенным страницам только вошедшего пользователя
export function RequireAuth() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenMessage text="Загрузка…" />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}
