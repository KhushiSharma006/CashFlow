import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/expenses', label: 'Expenses' },
  { to: '/income', label: 'Income' },
  { to: '/budgets', label: 'Budgets' },
  { to: '/recurring', label: 'Recurring' },
]

export default function Layout({ children }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const initials = (user?.user_metadata?.full_name || user?.email || '?')
    .trim()
    .charAt(0)
    .toUpperCase()

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-20 bg-paper/95 backdrop-blur border-b border-line">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-display text-2xl font-semibold tracking-tight text-ink">
              CashFlow
            </span>
            <span className="hidden sm:inline-block font-mono text-[11px] uppercase tracking-widest text-ink-soft border border-line rounded-full px-2 py-0.5">
              personal ledger
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-ink text-paper-raised'
                      : 'text-ink-soft hover:text-ink hover:bg-paper-raised'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-ink text-paper-raised font-display text-sm flex items-center justify-center">
                {initials}
              </div>
              <button
                onClick={handleSignOut}
                className="text-sm font-medium text-ink-soft hover:text-rust transition-colors"
              >
                Sign out
              </button>
            </div>
            <button
              className="md:hidden text-ink"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
        <div className="perf-divider" />

        {menuOpen && (
          <nav className="md:hidden max-w-6xl mx-auto px-5 py-3 flex flex-col gap-1 border-b border-line bg-paper">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-md text-sm font-medium ${
                    isActive ? 'bg-ink text-paper-raised' : 'text-ink-soft hover:bg-paper-raised'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <button
              onClick={handleSignOut}
              className="text-left px-3 py-2 text-sm font-medium text-rust"
            >
              Sign out
            </button>
          </nav>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-5 py-8">{children}</main>
    </div>
  )
}
