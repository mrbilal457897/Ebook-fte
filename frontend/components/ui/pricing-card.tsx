import { Badge } from "./badge"
import { Button, ButtonLink } from "./button"

export type PricingCardProps = {
  name: string
  description?: string
  price: string
  period?: string
  features: string[]
  cta: string
  href?: string
  onCta?: () => void
  highlighted?: boolean
  badge?: string
  current?: boolean
}

function Check() {
  return (
    <svg
      className="ui-pricing-check"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 12.5l5.2 5.2L20 7" />
    </svg>
  )
}

export function PricingCard({
  name,
  description,
  price,
  period = "/ month",
  features,
  cta,
  href,
  onCta,
  highlighted,
  badge,
  current,
}: PricingCardProps) {
  const classes = ["ui-card", "ui-pricing", highlighted ? "is-highlighted" : ""]
    .filter(Boolean)
    .join(" ")

  return (
    <div className={classes}>
      {badge && (
        <span className="ui-pricing-badge">
          <Badge tone={highlighted ? "accent" : "neutral"}>{badge}</Badge>
        </span>
      )}
      <div className="ui-pricing-name">{name}</div>
      {description && <p className="ui-pricing-desc">{description}</p>}
      <div className="ui-pricing-price">
        <span className="ui-pricing-amount">{price}</span>
        <span className="ui-pricing-period">{period}</span>
      </div>
      <ul className="ui-pricing-features">
        {features.map((feature) => (
          <li className="ui-pricing-feature" key={feature}>
            <Check />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      {href ? (
        <ButtonLink href={href} size="md" className="ui-pricing-cta" variant="primary">
          {cta}
        </ButtonLink>
      ) : (
        <Button
          size="md"
          variant={highlighted ? "primary" : "secondary"}
          onClick={onCta}
          disabled={current}
          className="ui-pricing-cta"
        >
          {cta}
        </Button>
      )}
    </div>
  )
}
