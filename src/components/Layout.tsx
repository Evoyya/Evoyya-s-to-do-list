import { NavLink, Outlet } from 'react-router'
import { useAuth } from '../auth/AuthProvider'

const navItems = [
  { to: '/', label: 'Доска', end: true },
  { to: '/archive', label: 'Архив', end: false },
  { to: '/labels', label: 'Ярлыки', end: false },
]

export function Layout() {
  const { session, signOut } = useAuth()
  const meta = session?.user.user_metadata ?? {}
  const name: string = meta.full_name ?? meta.name ?? session?.user.email ?? ''
  const avatarUrl: string | undefined = meta.avatar_url

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-border/40 bg-surface/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
        <span className="py-3 text-lg font-medium">Task-менеджер</span>

        <nav className="flex gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-full px-3 py-1.5 text-sm transition-colors ${
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

        <div className="ml-auto flex items-center gap-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              title={name}
              referrerPolicy="no-referrer"
              className="size-8 rounded-full"
            />
          ) : (
            <span
              title={name}
              className="flex size-8 items-center justify-center rounded-full bg-accent/30 text-sm"
            >
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-full px-3 py-1.5 text-sm text-text-muted hover:bg-surface-raised hover:text-text"
          >
            Выйти
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
    </div>
  )
}
