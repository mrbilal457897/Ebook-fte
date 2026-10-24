"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import gsap from "gsap"
import { prefersReducedMotion } from "@/lib/motion-preference"

import GenerateShell from "@/components/generate/generate-shell"

type Provider = "gemini" | "openai" | "anthropic"

type Credential = {
  credentialId: string
  provider: Provider
  createdAt: string
  isActive: boolean
}

const PROVIDERS: { id: Provider; label: string; where: string }[] = [
  { id: "gemini", label: "Google Gemini", where: "aistudio.google.com/apikey" },
  { id: "openai", label: "OpenAI", where: "platform.openai.com/api-keys" },
  { id: "anthropic", label: "Anthropic", where: "console.anthropic.com/settings/keys" },
]

/**
 * Settings — model keys (BYOK) and plan (billing).
 *
 * This is the screen that makes BYOK reachable at all: before it, a customer
 * could read that a BYOK provider was "active" but had no way to connect a key.
 *
 * The key is write-only by design. It goes out once, is sealed server-side with
 * AES-256-GCM, and is never returned — so the list below shows only provider,
 * date added, and which one is active.
 */
export default function SettingsPage() {
  const rootRef = useRef<HTMLDivElement>(null)

  const [credentials, setCredentials] = useState<Credential[]>([])
  const [provider, setProvider] = useState<Provider>("gemini")
  const [apiKey, setApiKey] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/model-credentials")
      if (res.status === 401) {
        window.location.href = "/signin"
        return
      }
      const body = await res.json()
      setCredentials(body.credentials ?? [])
    } catch {
      setError("Could not load your saved keys. Refresh to try again.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.from(".app-panel > *", {
        opacity: 0,
        y: 12,
        duration: 0.3,
        stagger: 0.05,
        ease: "power2.out",
      })
    }, root)
    return () => ctx.revert()
  }, [])

  async function saveKey(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch("/api/model-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.message ?? "That key could not be saved.")
        return
      }
      setApiKey("")
      setNotice("Key saved and set as your active model. It is encrypted at rest.")
      await load()
    } catch {
      setError("Could not reach the server. Your key was not sent.")
    } finally {
      setSaving(false)
    }
  }

  async function activate(credentialId: string | null) {
    setError(null)
    setNotice(null)
    try {
      const res = await fetch("/api/model-credentials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentialId }),
      })
      if (!res.ok) {
        setError(res.status === 404 ? "That key is no longer available." : "Could not switch keys.")
        return
      }
      setNotice(credentialId ? "Active key switched." : "Now using our platform key.")
      await load()
    } catch {
      setError("Could not reach the server.")
    }
  }

  async function remove(credentialId: string) {
    setError(null)
    setNotice(null)
    try {
      const res = await fetch("/api/model-credentials", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentialId }),
      })
      if (!res.ok) {
        setError("Could not delete that key.")
        return
      }
      setNotice("Key deleted.")
      await load()
    } catch {
      setError("Could not reach the server.")
    }
  }

  const active = credentials.find((c) => c.isActive) ?? null

  return (
    <GenerateShell>
      <div ref={rootRef} className="app-panel">
        <header className="app-head">
          <h1 className="app-title">Settings</h1>
          <a className="btn-secondary" href="/generate">
            Back to writing
          </a>
        </header>

        <section className="banner is-info">
          <strong>Your key, your account.</strong> When you connect a provider key, your generations
          run on it and are billed to you directly by that provider. We store it encrypted and never
          show it back to you.
        </section>

        <form className="field" onSubmit={saveKey}>
          <label className="field-label" htmlFor="byok-provider">
            Provider
          </label>
          <select
            id="byok-provider"
            className="field-input"
            value={provider}
            onChange={(e) => setProvider(e.target.value as Provider)}
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>

          <label className="field-label" htmlFor="byok-key">
            API key
          </label>
          <input
            id="byok-key"
            className="field-input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={PROVIDERS.find((p) => p.id === provider)?.where}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <p className="field-error">{error ?? ""}</p>

          <button className="btn-primary" type="submit" disabled={saving || apiKey.trim() === ""}>
            {saving ? "Saving…" : "Save and use this key"}
          </button>
          {saving || apiKey.trim() === "" ? (
            <span className="upgrade-prompt-status">Paste a key to enable this.</span>
          ) : null}
        </form>

        {notice ? <p className="banner is-warn">{notice}</p> : null}

        <section className="field">
          <h2 className="app-title">Saved keys</h2>
          {loading ? (
            <p className="auth-subtitle">Loading...</p>
          ) : credentials.length === 0 ? (
            <p className="auth-subtitle">
              No keys connected yet — you are generating on our platform key, which has a small free
              allowance.
            </p>
          ) : (
            <ul className="credential-list">
              {credentials.map((c) => (
                <li key={c.credentialId} className="credential-card">
                  <span className="credential-provider">
                    {PROVIDERS.find((p) => p.id === c.provider)?.label ?? c.provider}
                  </span>
                  <span className="credential-date">
                    Added {new Date(c.createdAt).toLocaleDateString()}
                  </span>
                  {c.isActive ? (
                    <span className="allowance-pill">
                      <span className="dot" />
                      Active
                    </span>
                  ) : (
                    <button
                      className="btn-secondary"
                      onClick={() => activate(c.credentialId)}
                      type="button"
                    >
                      Use this
                    </button>
                  )}
                  <button
                    className="btn-secondary"
                    onClick={() => remove(c.credentialId)}
                    type="button"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
          {active ? (
            <button className="btn-secondary" onClick={() => activate(null)} type="button">
              Switch back to our platform key
            </button>
          ) : null}
        </section>
      </div>
    </GenerateShell>
  )
}
