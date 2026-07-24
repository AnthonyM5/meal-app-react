"use client"

import GoogleSignInButton from "@/components/google-sign-in-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { signIn } from "@/lib/actions"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { useActionState, useEffect, useState } from "react"
import { useFormStatus } from "react-dom"

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      disabled={pending}
      size="lg"
      className="w-full text-base font-semibold"
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Signing in...
        </>
      ) : (
        "Sign In"
      )}
    </Button>
  )
}

export default function LoginForm() {
  const [state, formAction] = useActionState(signIn, null)
  const [isClient, setIsClient] = useState(false)

  // Ensure component only renders on client to avoid hydration issues
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Don't handle redirect here - let the server action handle it
  // This prevents race conditions and double redirects

  if (!isClient) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-6" suppressHydrationWarning>
      {state?.error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-foreground"
          >
            Email
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            suppressHydrationWarning
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-foreground"
          >
            Password
          </label>
          <Input id="password" name="password" type="password" required />
        </div>
      </div>

      <SubmitButton />

      <div className="flex items-center space-x-2">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">OR</span>
        <Separator className="flex-1" />
      </div>

      <GoogleSignInButton />

      <div className="text-center text-sm text-muted-foreground">
        Don't have an account?{" "}
        <Link
          href="/auth/sign-up"
          className="font-semibold text-primary hover:underline"
        >
          Sign up
        </Link>
      </div>
    </form>
  )
}
