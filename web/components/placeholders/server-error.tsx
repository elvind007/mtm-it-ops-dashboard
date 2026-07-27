import type { ReactNode } from "react"
import { ServerCrash } from "lucide-react"

import { PlaceholderState } from "@/components/placeholders/placeholder-state"

interface ServerErrorProps {
  title?: string
  description?: string
  action?: ReactNode
  className?: string
}

export function ServerError({
  title = "Something went wrong",
  description = "The server could not load this data. Please try again.",
  action,
  className,
}: ServerErrorProps) {
  return (
    <PlaceholderState
      icon={ServerCrash}
      title={title}
      description={description}
      action={action}
      className={className}
      tone="destructive"
      role="alert"
    />
  )
}
