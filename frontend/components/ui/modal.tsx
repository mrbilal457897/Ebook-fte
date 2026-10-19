"use client"

import { useEffect, useId, useRef } from "react"
import { createPortal } from "react-dom"
import type { ReactNode } from "react"

export type ModalProps = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  actions?: ReactNode
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({ open, onClose, title, children, actions }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return

    restoreRef.current = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    dialogRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose()
        return
      }
      if (event.key !== "Tab") return
      const dialog = dialogRef.current
      if (!dialog) return
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (focusables.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previousOverflow
      restoreRef.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="ui-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="ui-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={dialogRef}
      >
        <h2 className="ui-modal-title" id={titleId}>
          {title}
        </h2>
        <div className="ui-modal-body">{children}</div>
        {actions && <div className="ui-modal-actions">{actions}</div>}
      </div>
    </div>,
    document.body,
  )
}
