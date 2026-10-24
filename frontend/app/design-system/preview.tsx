"use client"

import { useState } from "react"
import type { FormEvent } from "react"
import {
  Accordion,
  Avatar,
  Badge,
  Button,
  Card,
  Container,
  Footer,
  Input,
  Modal,
  Navbar,
  PricingCard,
  Rating,
  Section,
  Select,
  Skeleton,
  SkeletonText,
  Textarea,
  useToast,
} from "@/components/ui"

const NAV_LINKS = [
  { label: "Home", href: "/?tenant=example-press" },
  { label: "Settings", href: "/settings" },
  { label: "Sign in", href: "/signin?tenant=example-press" },
]

const POSTER_SWATCHES = [
  { name: "Paper", value: "#FFF6E6" },
  { name: "Ink", value: "#111111" },
  { name: "Blue", value: "#2B2BFF" },
  { name: "Coral", value: "#FF5A36" },
  { name: "Yellow", value: "#FFD23F" },
  { name: "Mint", value: "#3DDC97" },
]

const ACCORDION_ITEMS = [
  {
    id: "what",
    title: "What is this component?",
    content:
      "An accordion row with a real heading, aria-expanded, aria-controls and a region label. The panel stays in the DOM but is inert while collapsed, so screen readers never meet hidden text.",
  },
  {
    id: "keyboard",
    title: "How does it behave with a keyboard?",
    content:
      "The whole row is one tab stop. Enter or Space toggles it, focus stays where you left it, and the focus ring is drawn inside the row so it never gets clipped by the card's overflow.",
  },
  {
    id: "motion",
    title: "What happens with reduced motion?",
    content:
      "The height transition is switched off entirely — the panel simply opens in its final state. Nothing is left half-animated.",
  },
]

const PRICING_PLANS = [
  {
    name: "Free",
    description: "Everything you need to prepare your first book.",
    price: "$0",
    period: "to start",
    features: ["3 books start to finish", "Cover concepts and revisions", "EPUB / MOBI / print PDF"],
    cta: "Start writing free",
    highlighted: true,
    badge: "Free tier",
  },
]

type FormValues = { email: string; feedback: string; plan: string }

function validate(values: FormValues) {
  const errors: Partial<Record<keyof FormValues, string>> = {}
  if (!values.email) {
    errors.email = "Email is required."
  } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email)) {
    errors.email = "Enter a valid email address."
  }
  if (!values.feedback.trim()) {
    errors.feedback = "Tell us something — at least 10 characters."
  } else if (values.feedback.trim().length < 10) {
    errors.feedback = `Add ${10 - values.feedback.trim().length} more characters.`
  }
  if (!values.plan) errors.plan = "Pick a plan to continue."
  return errors
}

export function DesignSystemPreview() {
  const { push } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [rating, setRating] = useState(3)
  const [values, setValues] = useState<FormValues>({ email: "", feedback: "", plan: "" })
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({})
  const [submitted, setSubmitted] = useState(false)

  function update(field: keyof FormValues, value: string) {
    const next = { ...values, [field]: value }
    setValues(next)
    if (submitted) setErrors(validate(next))
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    const found = validate(values)
    setErrors(found)
    if (Object.keys(found).length === 0) {
      push({
        title: "Validation passed",
        message: "Nothing was sent anywhere — this is an internal preview.",
        tone: "success",
      })
    }
  }

  return (
    <>
      <Navbar
        links={NAV_LINKS}
        actions={
          <>
            <Button variant="ghost" size="sm">
              Skip
            </Button>
            <Button variant="primary" size="sm">
              Get started
            </Button>
          </>
        }
      />

      <Container>
        <div className="ds-page">
          <header className="ds-head">
            <h1 className="ds-title">Design system</h1>
            <p className="ds-lede">
              Sticker-poster system: Bricolage Grotesque display/body, DM Mono labels, thick ink
              outlines, solid fills, and hard offset shadows. Tab through the page to inspect focus
              states; resize from 360px to desktop to check responsive behaviour.
            </p>
            <p className="ds-note">
              Internal preview route. Not linked from anywhere in the product.
            </p>
          </header>

          <section className="ds-palette" aria-label="Sticker poster colour palette">
            {POSTER_SWATCHES.map((swatch) => (
              <div key={swatch.name} className="ds-swatch">
                <span className="ds-swatch-chip" style={{ background: swatch.value }} />
                <span className="ds-label">{swatch.name}</span>
                <code>{swatch.value}</code>
              </div>
            ))}
          </section>

          <Section
            title="Buttons"
            lede="Four variants, exactly three sizes, all states."
            className="ds-section"
          >
            <div className="ds-group">
              <div className="ds-block">
                <span className="ds-label">Variants (md)</span>
                <div className="ds-row">
                  <Button variant="primary">Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="destructive">Destructive</Button>
                  <Button variant="destructive" solid>
                    Destructive confirm
                  </Button>
                </div>
              </div>
              <div className="ds-block">
                <span className="ds-label">Sizes (primary)</span>
                <div className="ds-row">
                  <Button size="sm">Small</Button>
                  <Button size="md">Medium</Button>
                  <Button size="lg">Large</Button>
                </div>
              </div>
              <div className="ds-block">
                <span className="ds-label">States</span>
                <div className="ds-row">
                  <Button variant="primary" disabled>
                    Disabled
                  </Button>
                  <Button variant="primary" loading>
                    Saving
                  </Button>
                  <Button variant="secondary" disabled>
                    Disabled
                  </Button>
                  <Button variant="secondary" loading>
                    Loading
                  </Button>
                  <Button variant="ghost" disabled>
                    Disabled
                  </Button>
                </div>
              </div>
              <p className="ds-note">
                Hover, active and focus states apply to every variant. On a touch device the
                smallest button keeps a 44px hit area.
              </p>
            </div>
          </Section>

          <Section
            title="Form fields"
            lede="Input, textarea and select with inline validation. Error space is reserved, so messages never shift the layout."
          >
            <div className="ds-group">
              <form className="ds-form" onSubmit={onSubmit} noValidate>
                <Input
                  label="Email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  value={values.email}
                  error={errors.email}
                  hint="We never share this."
                  onChange={(event) => update("email", event.target.value)}
                />
                <Select
                  label="Plan"
                  required
                  value={values.plan}
                  error={errors.plan}
                  onChange={(event) => update("plan", event.target.value)}
                >
                  <option value="">Choose a plan…</option>
                  <option value="starter">Starter — free</option>
                </Select>
                <Textarea
                  label="Feedback"
                  rows={3}
                  required
                  placeholder="What should we improve?"
                  value={values.feedback}
                  error={errors.feedback}
                  hint="At least 10 characters."
                  onChange={(event) => update("feedback", event.target.value)}
                />
                <div className="ds-form-actions">
                  <Button type="submit" variant="primary">
                    Validate
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setValues({ email: "", feedback: "", plan: "" })
                      setErrors({})
                      setSubmitted(false)
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </form>
            </div>
          </Section>

          <Section title="Cards" lede="Solid paper surfaces, thick ink outlines, and hard offset shadows.">
            <div className="ds-grid">
              <Card>
                <span className="ds-label">Default</span>
                <p className="ds-note">White fill, 2.5px ink border, 26px radius, 7px offset shadow.</p>
                <Button size="sm" variant="secondary">
                  Select
                </Button>
              </Card>
              <Card selected>
                <span className="ds-label">Selected</span>
                <p className="ds-note">Accent border. Text colour never changes.</p>
                <Badge tone="accent">Selected</Badge>
              </Card>
              <Card raised>
                <span className="ds-label">Raised</span>
                <p className="ds-note">Solid white surface with the shared offset elevation.</p>
              </Card>
            </div>
          </Section>

          <Section title="Badges" lede="Mono labels on white pills; colour remains legible with ink text.">
            <div className="ds-group">
              <div className="ds-block">
                <span className="ds-label">Status</span>
                <div className="ds-row">
                  <Badge tone="neutral">Draft</Badge>
                  <Badge tone="warning" dot>
                    In progress
                  </Badge>
                  <Badge tone="success" dot>
                    Live
                  </Badge>
                  <Badge tone="danger">Rejected</Badge>
                </div>
              </div>
              <div className="ds-block">
                <span className="ds-label">Decorative</span>
                <div className="ds-row">
                  <Badge tone="accent">New</Badge>
                  <Badge tone="neutral">Beta</Badge>
                </div>
              </div>
            </div>
          </Section>

          <Section
            title="Accordion"
            lede="Single tab stop per row, aria-expanded, inert while closed."
          >
            <Accordion items={ACCORDION_ITEMS} defaultOpen={["what"]} />
          </Section>

          <Section
            title="Modal"
            lede="Escape closes, focus is trapped, and focus lands on the dialog — never on a destructive button."
          >
            <div className="ds-group">
              <div className="ds-row">
                <Button variant="primary" onClick={() => setModalOpen(true)}>
                  Open confirmation dialog
                </Button>
              </div>
              <p className="ds-note">
                The backdrop click and Escape both close it; focus returns to the button that opened
                it.
              </p>
            </div>
          </Section>

          <Section
            title="Toasts"
            lede="Success and info auto-dismiss; warnings and errors stay until dismissed."
          >
            <div className="ds-group">
              <div className="ds-row">
                <Button
                  variant="secondary"
                  onClick={() =>
                    push({ title: "Saved", message: "Your changes are stored.", tone: "success" })
                  }
                >
                  Success toast
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    push({
                      title: "Heads up",
                      message: "The free tier resets monthly.",
                      tone: "warning",
                    })
                  }
                >
                  Warning toast
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    push({
                      title: "Generation failed",
                      message: "The model rejected the request. Try again.",
                      tone: "error",
                    })
                  }
                >
                  Error toast
                </Button>
              </div>
              <p className="ds-note">
                All live regions: success and warning announce politely, errors announce as alerts.
              </p>
            </div>
          </Section>

          <Section
            title="Skeletons and avatars"
            lede="Flat loading placeholders pulse gently, and sit still under reduced motion."
          >
            <div className="ds-group">
              <div className="ds-skeleton-row">
                <Skeleton width="56px" height="56px" radius="var(--radius-pill)" />
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <SkeletonText lines={3} />
                </div>
              </div>
              <div className="ds-row">
                <Avatar name="Ada Byron" size="sm" />
                <Avatar name="Ada Byron" />
                <Avatar name="Ada Byron" size="lg" />
                <Avatar name="Press House" />
              </div>
            </div>
          </Section>

          <Section
            title="Rating"
            lede="Read-only for display; interactive uses native radios, so arrow keys work for free."
          >
            <div className="ds-group">
              <div className="ds-block">
                <span className="ds-label">Read-only</span>
                <div className="ds-row">
                  <Rating value={4} showValue />
                  <Rating value={2} showValue />
                </div>
              </div>
              <div className="ds-block">
                <span className="ds-label">Interactive (click or arrow keys)</span>
                <Rating value={rating} onChange={setRating} name="ds-rating" showValue />
              </div>
            </div>
          </Section>

          <Section title="Pricing card" lede="The card primitive plus price, features and one CTA.">
            <div className="ds-grid">
              {PRICING_PLANS.map((plan) => (
                <PricingCard key={plan.name} {...plan} />
              ))}
            </div>
          </Section>
        </div>
      </Container>

      <Footer
        tagline="E-book FTE — an AI publishing team that writes, covers, formats and prepares your book, with your approval before anything goes live."
        columns={[
          {
            heading: "Product",
            links: [
              { label: "Home", href: "/?tenant=example-press" },
              { label: "Settings", href: "/settings" },
              { label: "Sign in", href: "/signin?tenant=example-press" },
            ],
          },
          {
            heading: "Company",
            links: [
              { label: "Features", href: "#features" },
              { label: "Pricing", href: "#pricing" },
              { label: "FAQ", href: "#faq" },
            ],
          },
        ]}
        homeHref="/?tenant=example-press"
        base={
          <>
            <span>Internal design-system preview.</span>
            <span>Built on the sticker-poster tokens.</span>
          </>
        }
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Publish this book?"
        actions={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" solid onClick={() => setModalOpen(false)}>
              Yes, publish
            </Button>
          </>
        }
      >
        This sends the finished package live to the platform. It is irreversible from inside the app
        — you can unpublish later, but the listing will already exist.
      </Modal>
    </>
  )
}
