"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"

export type ToastTone = "info" | "success" | "warning" | "error"

export type ToastInput = {
  title?: string
  message: string
  tone?: ToastTone
}

type ToastItem = ToastInput & { id: number; tone: ToastTone }

type ToastContextValue = {
  push: (toast: ToastInput) => number
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const value = useContext(ToastContext)
  if (!value) throw new Error("useToast must be used within <ToastProvider>")
  return value
}

const AUTO_DISMISS_MS: Record<ToastTone, number | null> = {
  info: 5000,
  success: 5000,
  warning: null,
  error: null,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((toast) => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++
      const tone = input.tone ?? "info"
      setToasts((list) => [...list, { ...input, tone, id }])
      const ms = AUTO_DISMISS_MS[tone]
      if (ms !== null) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), ms),
        )
      }
      return id
    },
    [dismiss],
  )

  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((timer) => clearTimeout(timer))
      pending.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={{ push, dismiss }}>
      {children}
      <div className="ui-toasts">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`ui-toast ui-toast-${toast.tone}`}
            role={toast.tone === "error" ? "alert" : "status"}
          >
            <div className="ui-toast-copy">
              {toast.title && <span className="ui-toast-title">{toast.title}</span>}
              <span className="ui-toast-message">{toast.message}</span>
            </div>
            <button
              type="button"
              className="ui-toast-close"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
