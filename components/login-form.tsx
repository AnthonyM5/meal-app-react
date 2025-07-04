"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
      className="w-full bg-[#2b725e] hover:bg-[#235e4c] text-white py-6 text-lg font-medium rounded-lg h-[60px]"
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
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-white">Welcome back</h1>
          <p className="text-lg text-gray-400">Sign in to your account</p>
        </div>
        <div className="flex justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-white">Welcome back</h1>
        <p className="text-lg text-gray-400">Sign in to your account</p>
      </div>

      <form action={formAction} className="space-y-6" suppressHydrationWarning>
        {state?.error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-700 px-4 py-3 rounded">{state.error}</div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-gray-300">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              className="bg-[#1c1c1c] border-gray-800 text-white placeholder:text-gray-500"
              suppressHydrationWarning
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-gray-300">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              className="bg-[#1c1c1c] border-gray-800 text-white"
            />
          </div>
        </div>

        <SubmitButton />

        <div className="text-center text-gray-400">
          Don't have an account?{" "}
          <Link href="/auth/sign-up" className="text-white hover:underline">
            Sign up
          </Link>
        </div>
      </form>
    </div>
  )
}
