import Link from "next/link"
import type { ReactNode } from "react"
import Logo from "@/components/brand/logo"

export type FooterColumn = {
  heading: string
  links: { label: string; href: string }[]
}

export type FooterProps = {
  tagline?: string
  columns?: FooterColumn[]
  base?: ReactNode
  homeHref?: string
}

export function Footer({ tagline, columns = [], base, homeHref = "/?tenant=example-press" }: FooterProps) {
  return (
    <footer className="ui-footer">
      <div className="ui-container">
        <div className="ui-footer-grid">
          <div className="ui-footer-brand">
            <Link href={homeHref} className="ui-navbar-brand" style={{ marginRight: 0 }}>
              <Logo size={24} />
              <span>E-book FTE</span>
            </Link>
            {tagline && <p className="ui-footer-tag">{tagline}</p>}
          </div>

          {columns.map((column) => (
            <div className="ui-footer-col" key={column.heading}>
              <h3 className="ui-footer-heading">{column.heading}</h3>
              {column.links.map((link) => (
                <Link key={link.href} href={link.href} className="ui-footer-link">
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        {base && <div className="ui-footer-base">{base}</div>}
      </div>
    </footer>
  )
}
