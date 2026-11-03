import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { IconBox } from "./icons";

/**
 * Ported from web/src/components/ui/EmptyState.tsx: a dashed card with an
 * icon tile, an 18px title, a line of ink-soft and an optional action. The
 * product fades it up (fadeRise); a demo can wrap it in motion if it wants.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  body: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-(--line-strong) px-6 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-xl border border-(--line) bg-(--surface-2) text-(--ink-faint)">
          <IconBox>{icon}</IconBox>
        </div>
      )}
      <p className="text-lg font-medium">{title}</p>
      <p className="mt-2 max-w-xs text-sm text-(--ink-soft)">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
