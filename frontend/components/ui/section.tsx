import type { HTMLAttributes, ReactNode } from "react"

export function Container({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`ui-container ${className}`.trim()} {...rest}>
      {children}
    </div>
  )
}

export type SectionProps = HTMLAttributes<HTMLElement> & {
  title?: string
  lede?: string
  children: ReactNode
}

export function Section({ title, lede, className = "", children, ...rest }: SectionProps) {
  return (
    <section className={`ui-section ${className}`.trim()} {...rest}>
      {(title || lede) && (
        <header className="ui-section-head">
          {title && <h2 className="ui-section-title">{title}</h2>}
          {lede && <p className="ui-section-lede">{lede}</p>}
        </header>
      )}
      {children}
    </section>
  )
}
