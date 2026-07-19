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
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'

export function SignupScreen() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (password !== confirm) {
      toast.error('Passwords do not match')
      return
    }
    setSubmitting(true)
    const { data, error } = await supabase.auth.signUp({ email, password })
    setSubmitting(false)
    if (error) {
      toast.error(error.message)
      return
    }
    if (data.session) {
      navigate('/dogs', { replace: true })
    } else {
      // Email confirmation is enabled on the project — no session until the
      // link is clicked.
      toast.success('Check your email to confirm your account, then sign in.')
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <PawPrint className="mb-2 h-8 w-8 text-primary" />
          <CardTitle className="font-display text-2xl">
            Create account
          </CardTitle>
          <CardDescription>Track your dog&apos;s nutrition</CardDescription>
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
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign up
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-primary underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
