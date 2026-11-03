import { cn } from "@/lib/utils";

// Ported from web/src/components/ui/StatusChip.tsx and the StagingState union
// in packages/shared/src/staging.ts (the review gate's states).

/** Where a staged result stands. publish only ever moves approved -> published. */
export type StagingState =
  | "pending" // freshly staged, awaiting a person
  | "approved" // approved; ready to publish, not yet live
  | "publishing" // the store write is in flight
  | "published" // live on the storefront
  | "rejected" // rejected; will not publish
  | "failed"; // the publish errored; retryable

export const STATUS_STYLES: Record<StagingState, { label: string; className: string; dot: string }> = {
  pending: { label: "Pending", className: "bg-(--warn-soft) text-(--warn)", dot: "bg-(--warn)" },
  approved: { label: "Approved", className: "bg-(--success-soft) text-(--success)", dot: "bg-(--success)" },
  publishing: { label: "Publishing…", className: "bg-(--surface-2) text-(--ink-soft)", dot: "bg-(--ink-soft) animate-pulse" },
  published: { label: "Published", className: "bg-(--success-soft) text-(--success)", dot: "bg-(--success)" },
  rejected: { label: "Rejected", className: "bg-(--surface-2) text-(--ink-faint)", dot: "bg-(--ink-faint)" },
  failed: { label: "Failed", className: "bg-(--danger-soft) text-(--danger)", dot: "bg-(--danger)" },
};

/** A staged result's state: a 24px rounded-lg chip with a 10px dot, in the state's tone. */
export function StatusChip({ state, className }: { state: StagingState; className?: string }) {
  const style = STATUS_STYLES[state];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-2 rounded-lg px-2 text-sm font-medium whitespace-nowrap",
        "transition-colors duration-200 motion-reduce:transition-none",
        style.className,
        className,
      )}
    >
      <span aria-hidden className={cn("size-2.5 rounded-full", style.dot)} />
      {style.label}
    </span>
  );
}
