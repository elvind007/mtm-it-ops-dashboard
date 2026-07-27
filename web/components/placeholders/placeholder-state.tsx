import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { cn } from "@/lib/utils"

interface PlaceholderStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
  className?: string
  tone?: "default" | "destructive" | "primary"
  role?: "status" | "alert"
}

export function PlaceholderState({
  icon: Icon,
  title,
  description,
  action,
  className,
  tone = "default",
  role = "status",
}: PlaceholderStateProps) {
  return (
    <Empty
      className={cn("min-h-64 border bg-background p-8", className)}
      role={role}
    >
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className={cn(
            "size-12 rounded-xl",
            tone === "destructive" && "bg-destructive/10 text-destructive",
            tone === "primary" && "bg-primary/10 text-primary",
          )}
        >
          <Icon className="size-6" aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  )
}
