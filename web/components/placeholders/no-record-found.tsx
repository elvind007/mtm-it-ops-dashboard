import type { ReactNode } from "react"
import { FileSearch } from "lucide-react"

import { PlaceholderState } from "@/components/placeholders/placeholder-state"

interface NoRecordFoundProps {
  title?: string
  description?: string
  action?: ReactNode
  className?: string
}

export function NoRecordFound({
  title = "No records found",
  description = "There are no records to display yet.",
  action,
  className,
}: NoRecordFoundProps) {
  return (
    <PlaceholderState
      icon={FileSearch}
      title={title}
      description={description}
      action={action}
      className={className}
    />
  )
}
