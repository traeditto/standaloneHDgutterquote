import { Mountain } from "lucide-react"

type BrandMarkProps = {
  name: string
  logo?: string
  compact?: boolean
}

export function BrandMark({ name, logo, compact = false }: BrandMarkProps) {
  return (
    <div className="brand-mark">
      <div className="brand-mark__icon">
        {logo ? (
          // Uploaded logos are stored as a local data URL in this template.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={`${name} logo`} />
        ) : (
          <Mountain size={compact ? 20 : 24} strokeWidth={2.4} />
        )}
      </div>
      {!compact && (
        <span>
          {name.split(" ").slice(0, -1).join(" ") || name}{" "}
          {name.split(" ").length > 1 && <strong>{name.split(" ").at(-1)}</strong>}
        </span>
      )}
    </div>
  )
}
