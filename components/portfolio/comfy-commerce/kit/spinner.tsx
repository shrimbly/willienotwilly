import { cn } from "@/lib/utils";

/** Ported from web/src/components/ui/Spinner.tsx: a 16px ring, its top in accent. */
export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "inline-block size-4 animate-spin rounded-full border-[1.5px] border-(--line-strong) border-t-(--accent)",
        className,
      )}
    />
  );
}
