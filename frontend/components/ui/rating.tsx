export type RatingProps = {
  value: number
  max?: number
  onChange?: (value: number) => void
  name?: string
  showValue?: boolean
  className?: string
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      className={`ui-rating-star${filled ? " is-on" : ""}`}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 3.2l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />
    </svg>
  )
}

export function Rating({
  value,
  max = 5,
  onChange,
  name = "rating",
  showValue = false,
  className = "",
}: RatingProps) {
  const stars = Array.from({ length: max }, (_, i) => i + 1)

  if (!onChange) {
    const label = `${value} out of ${max} stars`
    return (
      <span className={`ui-rating ${className}`.trim()} role="img" aria-label={label}>
        {stars.map((star) => (
          <Star key={star} filled={star <= value} />
        ))}
        {showValue && <span className="ui-rating-value">{label}</span>}
      </span>
    )
  }

  return (
    <span className={`ui-rating ${className}`.trim()} role="radiogroup" aria-label="Rating">
      {stars.map((star) => (
        <span className="ui-rating-inputs" key={star}>
          <input
            type="radio"
            id={`${name}-${star}`}
            name={name}
            value={star}
            checked={value === star}
            onChange={() => onChange(star)}
            aria-label={`${star} out of ${max} stars`}
          />
          <label htmlFor={`${name}-${star}`}>
            <Star filled={star <= value} />
          </label>
        </span>
      ))}
      {showValue && (
        <span className="ui-rating-value">
          {value} out of {max}
        </span>
      )}
    </span>
  )
}
