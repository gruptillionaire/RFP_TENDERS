import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        // Status variants
        success:
          "border-transparent bg-success text-success-foreground [a&]:hover:bg-success/90",
        warning:
          "border-transparent bg-warning text-warning-foreground [a&]:hover:bg-warning/90",
        info:
          "border-transparent bg-info text-info-foreground [a&]:hover:bg-info/90",
        neutral:
          "border-transparent bg-muted text-muted-foreground [a&]:hover:bg-muted/90",
        // Category pill variants
        teal:
          "border-transparent bg-pill-teal text-pill-teal-foreground [a&]:hover:bg-pill-teal/80",
        blue:
          "border-transparent bg-pill-blue text-pill-blue-foreground [a&]:hover:bg-pill-blue/80",
        purple:
          "border-transparent bg-pill-purple text-pill-purple-foreground [a&]:hover:bg-pill-purple/80",
        pink:
          "border-transparent bg-pill-pink text-pill-pink-foreground [a&]:hover:bg-pill-pink/80",
        orange:
          "border-transparent bg-pill-orange text-pill-orange-foreground [a&]:hover:bg-pill-orange/80",
        yellow:
          "border-transparent bg-pill-yellow text-pill-yellow-foreground [a&]:hover:bg-pill-yellow/80",
        green:
          "border-transparent bg-pill-green text-pill-green-foreground [a&]:hover:bg-pill-green/80",
        cyan:
          "border-transparent bg-pill-cyan text-pill-cyan-foreground [a&]:hover:bg-pill-cyan/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
