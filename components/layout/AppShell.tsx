'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface NavLink {
  href: string
  label: string
}

interface Props {
  user: { full_name: string; role: 'student' | 'parent' }
  navLinks: NavLink[]
  children: React.ReactNode
}

export function AppShell({ user, navLinks, children }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const initial = user.full_name?.[0]?.toUpperCase() ?? '?'

  const NavItems = () => (
    <>
      <nav className="flex flex-col gap-1 flex-1">
        {navLinks.map(link => {
          const active = pathname === link.href || pathname.startsWith(link.href + '/')
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setDrawerOpen(false)}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted hover:bg-surface-raised hover:text-text-primary'
              }`}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-border">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary/30 text-primary text-sm font-bold flex items-center justify-center shrink-0">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{user.full_name}</p>
            <p className="text-xs text-muted capitalize">{user.role}</p>
          </div>
        </div>
        <Link
          href="/auth/change-password"
          onClick={() => setDrawerOpen(false)}
          className="block px-4 py-2 text-sm text-muted hover:text-text-primary hover:bg-surface-raised rounded-lg transition-colors"
        >
          Change Password
        </Link>
        <button
          onClick={handleLogout}
          className="w-full text-left px-4 py-2 text-sm text-danger hover:bg-danger/10 rounded-lg transition-colors"
        >
          Logout
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile top navbar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-surface border-b border-border flex items-center justify-between px-4 h-14">
        <span className="font-bold text-text-primary tracking-tight">GATE Prep</span>
        <button
          onClick={() => setDrawerOpen(o => !o)}
          className="p-2 text-muted hover:text-text-primary"
          aria-label="Toggle menu"
        >
          {drawerOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-30" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute top-14 left-0 bottom-0 w-64 bg-surface flex flex-col p-4 gap-1"
            onClick={e => e.stopPropagation()}
          >
            <NavItems />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed top-0 left-0 bottom-0 w-60 bg-surface border-r border-border flex-col p-4 gap-1 z-20">
        <div className="px-2 mb-6 mt-2">
          <span className="text-lg font-bold text-text-primary tracking-tight">GATE Prep</span>
        </div>
        <NavItems />
      </aside>

      {/* Main content */}
      <main className="lg:pl-60 pt-14 lg:pt-0 min-h-screen">
        {children}
      </main>
    </div>
  )
}
