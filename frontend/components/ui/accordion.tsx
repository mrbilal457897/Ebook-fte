"use client"

import { useId, useState } from "react"
import type { ReactNode } from "react"

export type AccordionItem = {
  id?: string
  title: string
  content: ReactNode
}

export type AccordionProps = {
  items: AccordionItem[]
  defaultOpen?: string[]
  className?: string
}

export function Accordion({ items, defaultOpen = [], className = "" }: AccordionProps) {
  const baseId = useId()
  const [open, setOpen] = useState<string[]>(defaultOpen)

  function toggle(key: string) {
    setOpen((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    )
  }

  return (
    <div className={`ui-accordion ${className}`.trim()}>
      {items.map((item, index) => {
        const key = item.id ?? String(index)
        const isOpen = open.includes(key)
        const triggerId = `${baseId}-${key}-trigger`
        const panelId = `${baseId}-${key}-panel`
        return (
          <div className="ui-accordion-item" key={key}>
            <h3 style={{ margin: 0 }}>
              <button
                type="button"
                id={triggerId}
                className="ui-accordion-trigger"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(key)}
              >
                <span>{item.title}</span>
                <span className="ui-accordion-marker" aria-hidden="true" />
              </button>
            </h3>
            <div
              className={`ui-accordion-panel${isOpen ? " is-open" : ""}`}
              id={panelId}
              role="region"
              aria-labelledby={triggerId}
              inert={!isOpen}
            >
              <div>
                <div className="ui-accordion-answer">{item.content}</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
