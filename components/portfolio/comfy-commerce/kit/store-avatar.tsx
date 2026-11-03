import { cn } from "@/lib/utils";

import { Store } from "./icons";

/**
 * Ported from web/src/components/ui/StoreAvatar.tsx, fallback branch only: the
 * Shopify-green tile with the store glyph the product draws when it cannot
 * fetch the storefront's favicon. The real store's favicon is a remote file,
 * so the port always draws the fallback.
 */
export function StoreAvatar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("flex size-6 shrink-0 items-center justify-center rounded-[6px] bg-[#5e8e3e] text-white", className)}
    >
      <Store size={14} />
    </span>
  );
}
