"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

import AuthShell from "@/components/auth/auth-shell"
import { linkCurrentSession } from "@/lib/auth/client-link"

function useTenantSlug() {
  const params = useSearchParams()
  return params.get("tenant") ?? "example-press"
}

function SigninForm() {
  const router = useRouter()
  const tenantSlug = useTenantSlug()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function linkIfSignedIn() {
      const { authClient } = await import("@/lib/auth/client")
      const session = await authClient.getSession()
      if (cancelled || !session?.data?.user) return
      await linkCurrentSession(tenantSlug)
      router.replace("/generate")
    }
    void linkIfSignedIn()
    return () => {
      cancelled = true
    }
  }, [router, tenantSlug])

  async function onEmailSignin(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setBusy(true)
    try {
      const { authClient } = await import("@/lib/auth/client")
      const { error } = await authClient.signIn.email({ email, password })
      if (error) {
        setError(error.message || "Sign-in failed")
        return
      }
      await linkCurrentSession(tenantSlug)
      router.replace("/generate")
    } catch {
      setError("Sign-in failed — try again.")
    } finally {
      setBusy(false)
    }
  }

  async function onGoogle() {
    setError("")
    const { authClient } = await import("@/lib/auth/client")
    await authClient.signIn.social({
      provider: "google",
      callbackURL: `/signin?tenant=${encodeURIComponent(tenantSlug)}`,
    })
  }

  return (
    <>
      <h1 className="auth-title">Welcome back</h1>
      <p className="auth-subtitle">Pick up where you left off.</p>

      <form className="field" onSubmit={onEmailSignin}>
        <label className="field-label" htmlFor="signin-email">
          Email
        </label>
        <input
          id="signin-email"
          type="email"
          className="field-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />

        <label className="field-label" htmlFor="signin-password">
          Password
        </label>
        <input
          id="signin-password"
          type="password"
          className="field-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />

        <div className="field-error" role="alert">
          {error}
        </div>

        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="divider">or</div>

      <button className="btn-secondary" type="button" onClick={onGoogle}>
        Continue with Google
      </button>

      <p className="auth-subtitle">
        New here?{" "}
        <Link href={`/signup?tenant=${encodeURIComponent(tenantSlug)}`}>Create an account</Link>
      </p>
    </>
  )
}

export default function SigninPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <SigninForm />
      </Suspense>
    </AuthShell>
  )
}
