"use client"

import { useState } from "react"
import Link from "next/link"
import type { ReactNode } from "react"
import Logo from "@/components/brand/logo"

export type NavbarLink = { label: string; href: string }

export type NavbarProps = {
  brand?: NavbarLink
  links?: NavbarLink[]
  current?: string
  actions?: ReactNode
  homeHref?: string
}

export function Navbar({ brand, links = [], current, actions, homeHref = "/" }: NavbarProps) {
  const [open, setOpen] = useState(false)
  const brandLink = brand ?? { label: "E-book FTE", href: homeHref }
  const menuId = "ui-navbar-menu"

  return (
    <header className="ui-navbar">
      <div className="ui-container">
        <div className="ui-navbar-inner">
          <Link href={brandLink.href} className="ui-navbar-brand">
            <span className="ui-navbar-mark" aria-hidden="true"><Logo size={24} /></span>
            <span>{brandLink.label}</span>
          </Link>

          <nav className="ui-navbar-links" aria-label="Main">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="ui-navbar-link"
                aria-current={current === link.href ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {actions && <div className="ui-navbar-actions">{actions}</div>}

          {links.length > 0 && (
            <button
              type="button"
              className="ui-navbar-toggle"
              aria-expanded={open}
              aria-controls={menuId}
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          )}
        </div>

        {open && links.length > 0 && (
          <nav className="ui-navbar-menu" id={menuId} aria-label="Main">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="ui-navbar-link"
                aria-current={current === link.href ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  )
}
