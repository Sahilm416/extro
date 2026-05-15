interface ExtroIconProps {
  size?: number
  className?: string
}

export function ExtroIcon({ size = 24, className }: ExtroIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="4.5"
        y="4.5"
        width="70"
        height="70"
        rx="12.6"
        style={{ fill: "currentColor" }}
      />
      <rect
        x="25.5"
        y="25.5"
        width="70"
        height="70"
        rx="12.6"
        style={{ fill: "#CC785C" }}
      />
    </svg>
  )
}
