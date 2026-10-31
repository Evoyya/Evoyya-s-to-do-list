import { NavLink, Outlet } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { useRealtimeSync } from '../hooks/useRealtimeSync'
import { Avatar } from './Avatar'
import { LogoutIcon } from './icons'
import { MutationErrorBanner } from './MutationErrorBanner'
import { UpdatePrompt } from './UpdatePrompt'

const navItems = [
  { to: '/', label: 'Доска', end: true },
  { to: '/archive', label: 'Архив', end: false },
  { to: '/labels', label: 'Ярлыки', end: false },
  { to: '/stats', label: 'Статистика', end: false },
]

export function Layout() {
  const { session, signOut } = useAuth()
  const meta = session?.user.user_metadata ?? {}
  const name: string = meta.full_name ?? meta.name ?? session?.user.email ?? ''
  const avatarUrl: string | undefined = meta.avatar_url
  const online = useRealtimeSync(session!.user.id)

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/40 bg-page/60 px-3 pt-[env(safe-area-inset-top)] backdrop-blur sm:gap-4 sm:px-4">
        {/* На телефоне название скрыто, чтобы шапка помещалась в ширину экрана */}
        <span className="hidden py-3 text-lg font-medium sm:inline">Task-менеджер</span>

        <nav className="flex gap-0.5 py-2 sm:gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-full px-2 py-1.5 text-sm transition-colors sm:px-3 ${
                  isActive
                    ? 'bg-accent/20 text-accent'
                    : 'text-text-muted hover:bg-surface-raised hover:text-text'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          <Avatar name={name} url={avatarUrl} />
          <button
            type="button"
            onClick={() => void signOut()}
            title="Выйти"
            aria-label="Выйти"
            className="flex items-center rounded-full p-2 text-sm text-text-muted hover:bg-surface-raised hover:text-text sm:px-3 sm:py-1.5"
          >
            {/* На телефоне только значок, чтобы шапка поместилась */}
            <span className="sm:hidden">
              <LogoutIcon />
            </span>
            <span className="hidden sm:inline">Выйти</span>
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {!online && (
          <div
            role="status"
            className="mx-auto mb-4 max-w-xl rounded-lg border border-[#fbbc04]/40 bg-[#fbbc04]/10 px-4 py-2 text-center text-sm"
          >
            Нет связи. Изменения с других устройств появятся, когда соединение восстановится.
          </div>
        )}
        <UpdatePrompt />
        <MutationErrorBanner />
        <Outlet />
      </main>
    </div>
  )
}
