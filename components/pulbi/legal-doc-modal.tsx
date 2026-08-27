'use client'

import { X } from 'lucide-react'

export function LegalDocModal({
  open,
  title,
  content,
  onClose,
}: {
  open: boolean
  title: string
  content: string
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex h-[88vh] w-full max-w-lg flex-col rounded-[2rem] border border-border bg-card p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-primary">Yasal</p>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="no-scrollbar flex-1 overflow-y-auto rounded-2xl border border-border/70 bg-background/70 p-4 text-sm leading-7 text-foreground">
          <div className="whitespace-pre-wrap">{content}</div>
        </div>
      </div>
    </div>
  )
}
