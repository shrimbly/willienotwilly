import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { BlurFade } from "@/components/ui/blur-fade";
import {
  agencyRecognition,
  awardGroups,
  awardsFootnote,
} from "@/lib/awards";

export function AwardsView() {
  return (
    <div className="flex flex-col gap-14 sm:gap-20">
      <BlurFade delay={60} duration={700} yOffset={12}>
        <section className="squircle rounded-[28px] border border-border/70 bg-card p-8 sm:rounded-[32px] sm:p-12">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-4">
            {agencyRecognition.title}
          </p>
          <p className="max-w-3xl text-base leading-relaxed text-foreground sm:text-lg">
            {agencyRecognition.description}
          </p>
        </section>
      </BlurFade>

      <div className="flex flex-col gap-24 sm:gap-32">
        {awardGroups.map((group, gidx) => (
          <BlurFade
            key={group.title}
            delay={120 + gidx * 60}
            duration={700}
            yOffset={14}
          >
            <section className="flex flex-col gap-8 sm:gap-10">
              <div className="flex items-baseline justify-between gap-6">
                <div className="flex items-baseline gap-4 sm:gap-6">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground tabular-nums">
                    {String(gidx + 1).padStart(2, "0")}
                  </span>
                  <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">
                    {group.title}
                  </h2>
                </div>
                {group.projectSlug && (
                  <Link
                    href={`/portfolio/${group.projectSlug}`}
                    className="group inline-flex shrink-0 items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Case study
                    <ArrowUpRight className="size-3 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </Link>
                )}
              </div>

              <div className="flex flex-col">
                {group.awards.map((award, aidx) => (
                  <div
                    key={`${group.title}-${aidx}`}
                    className="flex flex-col gap-1 border-t border-border/50 py-4 last:border-b sm:grid sm:grid-cols-[3.5rem_minmax(9rem,_12rem)_1fr_minmax(0,_18rem)] sm:items-baseline sm:gap-6 sm:py-5"
                  >
                    <span className="font-mono text-xs text-muted-foreground tabular-nums sm:text-sm">
                      {award.year}
                    </span>
                    <span className="text-sm font-medium sm:text-base">
                      {award.show}
                    </span>
                    <span className="flex items-baseline gap-2 text-sm sm:text-base">
                      {award.rank}
                      {award.count && award.count > 1 && (
                        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                          ×{award.count}
                        </span>
                      )}
                    </span>
                    <span className="text-sm text-muted-foreground sm:text-right sm:text-base">
                      {award.category ?? ""}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </BlurFade>
        ))}
      </div>

      <BlurFade delay={120} duration={500}>
        <p className="border-t border-border/40 pt-8 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {awardsFootnote}
        </p>
      </BlurFade>
    </div>
  );
}
