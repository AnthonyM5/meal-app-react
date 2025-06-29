'use client'

import { GuestModeButton } from '@/components/guest-mode-button'
import LoginForm from '@/components/login-form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Loader2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import * as React from 'react'

function LoadingSpinner() {
  return (
    <div className="flex justify-center p-4">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  )
}

function LoginPageContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  return (
    <>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error === 'auth_required'
              ? 'Please sign in to access this page'
              : 'An error occurred. Please try again.'}
          </AlertDescription>
        </Alert>
      )}
      <LoginForm />
      <div className="flex items-center space-x-2">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">OR</span>
        <Separator className="flex-1" />
      </div>
      <GuestModeButton />
    </>
  )
}

export default function LoginPage() {
  return (
    <div className="container mx-auto flex h-screen w-screen flex-col items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome Back</CardTitle>
          <CardDescription>Sign in to your account to continue</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <React.Suspense fallback={<LoadingSpinner />}>
            <LoginPageContent />
          </React.Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
