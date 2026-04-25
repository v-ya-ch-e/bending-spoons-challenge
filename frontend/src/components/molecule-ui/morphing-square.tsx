"use client"

import { cn } from "@/lib/utils"

type MorphingSquareProps = {
  className?: string
}

export function MorphingSquare({ className }: MorphingSquareProps) {
  return (
    <div
      className={cn(
        "relative isolate flex size-[4.25rem] items-center justify-center",
        className
      )}
      aria-hidden
    >
      <span className="morph-square-core size-11 bg-primary shadow-sm ring-1 ring-primary/25" />
    </div>
  )
}

export function MorphingSquareDemo() {
  return <MorphingSquare />
}
