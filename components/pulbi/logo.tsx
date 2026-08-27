import { cn } from '@/lib/utils'

export function PulbiMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative flex items-center justify-center rounded-full',
        className,
      )}
      aria-hidden="true"
    >
      <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl" />
      <div className="absolute inset-0 rounded-full border border-primary/40" />
      <div className="absolute inset-[18%] rounded-full border border-amber/40" />
      <div className="relative h-[30%] w-[30%] rounded-full bg-primary shadow-[0_0_24px_var(--color-primary)]" />
      <span className="absolute right-[22%] top-[24%] h-1.5 w-1.5 rounded-full bg-amber shadow-[0_0_10px_var(--color-amber)]" />
    </div>
  )
}

export function PulbiWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'font-semibold tracking-tight text-foreground',
        className,
      )}
    >
      Pulbi
    </span>
  )
}
