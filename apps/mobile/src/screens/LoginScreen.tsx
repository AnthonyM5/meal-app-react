import { Button } from '@pawplate/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@pawplate/ui/card'
import { Input } from '@pawplate/ui/input'
import { Label } from '@pawplate/ui/label'
import { Loader2, PawPrint } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useAuth } from '../auth/AuthProvider'
import { GoogleSignInButton } from '../components/GoogleSignInButton'
import { supabase } from '../lib/supabase'

export function LoginScreen() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session) {
    return <Navigate to="/dogs" replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setSubmitting(false)
    if (error) {
      toast.error(error.message)
      return
    }
    navigate('/dogs', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <PawPrint className="mb-2 h-8 w-8 text-primary" />
          <CardTitle className="font-display text-2xl">PawPlate</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>
          <div className="my-4 flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">OR</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <GoogleSignInButton />
          <p className="mt-4 text-center text-sm text-muted-foreground">
            No account?{' '}
            <Link to="/signup" className="text-primary underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
