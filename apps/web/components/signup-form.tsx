"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { signUp } from "@/lib/actions"

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
          Signing up...
        </>
      ) : (
        "Sign Up"
      )}
    </Button>
  )
}

export default function SignUpForm() {
  // Initialize with null as the initial state
  const [state, formAction] = useActionState(signUp, null)

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      {state?.success && (
        <div className="rounded-md border border-primary/50 bg-primary/10 px-4 py-3 text-sm text-primary">
          {state.success}
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

      <div className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/auth/login"
          className="font-semibold text-primary hover:underline"
        >
          Log in
        </Link>
      </div>
    </form>
  )
}
