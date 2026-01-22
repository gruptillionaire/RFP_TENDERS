import { cn } from "@/lib/utils"
import { ImageIcon } from "lucide-react"

interface IllustrationPlaceholderProps {
  size?: "sm" | "md" | "lg"
  label?: string
  className?: string
}

const sizeClasses = {
  sm: "h-24 w-24",
  md: "h-40 w-40",
  lg: "h-64 w-64",
}

const iconSizes = {
  sm: "size-6",
  md: "size-10",
  lg: "size-16",
}

export function IllustrationPlaceholder({
  size = "md",
  label,
  className,
}: IllustrationPlaceholderProps) {
  return (
    <div
      className={cn(
        "gradient-hero-subtle flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/30",
        sizeClasses[size],
        className
      )}
    >
      <ImageIcon className={cn("text-primary/50", iconSizes[size])} />
      {label && (
        <span className="mt-2 text-xs text-muted-foreground">{label}</span>
      )}
    </div>
  )
}
