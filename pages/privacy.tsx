import React from 'react'
import { legalDocuments } from '@/lib/legal-docs'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">{legalDocuments.privacy.title}</h1>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
          {legalDocuments.privacy.content}
        </p>
      </div>
    </div>
  )
}
