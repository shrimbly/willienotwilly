import type { Mix } from "@/lib/booth/mix";
import { remixArguments } from "@/lib/booth/mix-demo";
import { cn } from "@/lib/utils";

/**
 * What Save runs: `booth remix stems -s … -b … -m …` (EngineRemixer.swift), re-rendering from the
 * stems the first pass kept, so the voice models don't run again. Values the mix has changed
 * from the saved one stand out. Drawn in the website's install line (`.brew`).
 */
export function RemixCommand({ mix, saved, className }: { mix: Mix; saved: Mix; className?: string }) {
  const args = remixArguments(mix);
  return (
    <p className={cn("flex justify-center", className)}>
      <span className="sr-only">Save runs booth remix stems {args.map((a) => `${a.flag} ${a.value}`).join(" ")}</span>
      <code aria-hidden className="booth-mix-code">
        {/* One run of text: the code box is a flex box, which would trim the spaces between items. */}
        <span>
          booth remix stems
          {args.map((a) => (
            <span key={a.flag} data-changed={a.value !== saved[a.stem] || undefined}>
              {` ${a.flag} ${a.value}`}
            </span>
          ))}
        </span>
      </code>
    </p>
  );
}
