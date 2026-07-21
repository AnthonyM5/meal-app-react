import { Button } from '@pawplate/ui/button'
import { LogOut, PawPrint } from 'lucide-react'
import { Link, Outlet, useNavigate } from 'react-router'
import { supabase } from '../lib/supabase'

export function AppShell() {
  const navigate = useNavigate()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col">
      <header className="flex items-center justify-between border-b bg-card px-4 py-3">
        <Link to="/dogs" className="flex items-center gap-2">
          <PawPrint className="h-5 w-5 text-primary" />
          <span className="font-display text-lg font-semibold">PawPlate</span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Sign out"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </header>
      <main className="flex-1 px-4 py-4">
        <Outlet />
      </main>
    </div>
  )
}
