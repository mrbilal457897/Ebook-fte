"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import AuthShell from "@/components/auth/auth-shell"
import { linkCurrentSession } from "@/lib/auth/client-link"

function useTenantSlug() {
  const params = useSearchParams()
  return params.get("tenant") ?? "example-press"
}

function SignupForm() {
  const router = useRouter()
  const tenantSlug = useTenantSlug()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  async function onEmailSignup(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setBusy(true)
    try {
      const { authClient } = await import("@/lib/auth/client")
      const { error } = await authClient.signUp.email({
        name,
        email,
        password,
      })
      if (error) {
        setError(error.message || "Sign-up failed")
        return
      }
      await linkCurrentSession(tenantSlug)
      router.replace("/generate")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign-up failed — try again."
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  async function onGoogle() {
    setError("")
    setBusy(true)
    try {
      const { authClient } = await import("@/lib/auth/client")
      const res = await authClient.signIn.social({
        provider: "google",
        callbackURL: `/generate?tenant=${encodeURIComponent(tenantSlug)}`,
      })
      if (res?.error) {
        setError(res.error.message || "Google sign-in failed")
        setBusy(false)
      }
      // If redirecting, busy remains true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Google sign-in failed — try again."
      setError(msg)
      setBusy(false)
    }
  }

  return (
    <>
      <h1 className="auth-title">Start your first book</h1>
      <p className="auth-subtitle">
        Sign up to {tenantSlug === "example-press" ? "Example Press" : tenantSlug} and get 3 free
        generations as a welcome.
      </p>

      <form className="field" onSubmit={onEmailSignup}>
        <label className="field-label" htmlFor="signup-name">
          Name
        </label>
        <input
          id="signup-name"
          className="field-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <label className="field-label" htmlFor="signup-email">
          Email
        </label>
        <input
          id="signup-email"
          type="email"
          className="field-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />

        <label className="field-label" htmlFor="signup-password">
          Password
        </label>
        <input
          id="signup-password"
          type="password"
          className="field-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />

        <div className="field-error" role="alert">
          {error}
        </div>

        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? "Creating your account…" : "Sign up"}
        </button>
      </form>

      <div className="divider">or</div>

      <button className="btn-secondary" type="button" onClick={onGoogle}>
        Continue with Google
      </button>
    </>
  )
}

export default function SignupPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <SignupForm />
      </Suspense>
    </AuthShell>
  )
}
