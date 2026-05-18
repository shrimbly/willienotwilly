"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { BlurFade } from "@/components/ui/blur-fade";
import { AwardsView } from "@/components/awards-view";
import { assetUrl } from "@/lib/asset-url";
import {
  categoryFilters,
  type PortfolioFilter,
  type Project,
  type ProjectCategory,
} from "@/lib/portfolio";

type FilterValue = PortfolioFilter;

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/portfolio/${project.slug}`} className="group block">
      <article className="flex flex-col">
        <div
          className={
            "squircle relative aspect-[5/4] w-full overflow-hidden rounded-[44px] border border-border/70 transition-colors duration-300 group-hover:border-border sm:rounded-[52px] " +
            (project.inset
              ? "bg-[linear-gradient(135deg,#EEEEEE_0%,#FFFFFF_100%)]"
              : "bg-card")
          }
        >
          {!project.inset && (
            <div
              className={`absolute inset-0 h-full w-full ${project.placeholderClass}`}
              aria-hidden="true"
            />
          )}
          {project.video ? (
            project.inset ? (
              <div className="absolute inset-2 flex items-center justify-center sm:inset-3">
                <video
                  className="block h-auto max-h-full w-auto max-w-full rounded-xl object-cover shadow-lg shadow-black/10 sm:rounded-2xl"
                  src={assetUrl(project.video)}
                  width={project.imageWidth ?? 1600}
                  height={project.imageHeight ?? 900}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-hidden="true"
                />
              </div>
            ) : (
              <video
                className="absolute inset-0 h-full w-full object-cover"
                src={assetUrl(project.video)}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-hidden="true"
              />
            )
          ) : project.image ? (
            project.inset ? (
              <div className="absolute inset-2 flex items-center justify-center sm:inset-3">
                <Image
                  src={assetUrl(project.image)}
                  alt={project.imageAlt ?? project.title}
                  width={project.imageWidth ?? 1600}
                  height={project.imageHeight ?? 900}
                  sizes="(min-width: 1024px) 560px, 100vw"
                  className="h-auto max-h-full w-auto max-w-full rounded-xl object-contain shadow-lg shadow-black/10 sm:rounded-2xl"
                />
              </div>
            ) : (
              <Image
                src={assetUrl(project.image)}
                alt={project.imageAlt ?? project.title}
                fill
                sizes="(min-width: 1024px) 560px, 100vw"
                className="object-cover"
              />
            )
          ) : (
            <div
              className="absolute inset-0 opacity-[0.18] mix-blend-overlay"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
              }}
              aria-hidden="true"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0 opacity-100 transition-opacity duration-300 sm:opacity-0 sm:group-hover:opacity-100" />
          <div className="absolute inset-x-0 bottom-0 flex translate-y-0 items-end justify-between gap-4 p-5 opacity-100 transition-all duration-300 sm:translate-y-1 sm:p-6 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-medium tracking-tight text-white sm:text-2xl">
                {project.title}
              </h2>
              <span className="font-mono text-[11px] uppercase tracking-widest text-white/75">
                {project.year} · {project.meta}
              </span>
            </div>
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-white/90 text-foreground">
              <ArrowUpRight className="size-4" />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

const sectionOrder: { category: ProjectCategory; label: string }[] = [
  { category: "personal", label: "Personal" },
  { category: "professional", label: "Professional" },
];

export function PortfolioGrid({ projects }: { projects: Project[] }) {
  const [filter, setFilter] = useState<FilterValue>("all");

  const sections = useMemo(
    () =>
      sectionOrder
        .map((s) => ({
          ...s,
          projects: projects.filter((p) => p.category === s.category),
        }))
        .filter(
          (s) =>
            s.projects.length > 0 &&
            (filter === "all" || filter === s.category),
        ),
    [filter, projects],
  );

  return (
    <div className="flex flex-col gap-8 sm:gap-12">
      <BlurFade delay={80} duration={600}>
        <div className="flex flex-wrap gap-1.5 sm:gap-3">
          {categoryFilters.map((f) => {
            const active = filter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                aria-pressed={active}
                className={
                  "relative isolate inline-flex items-center gap-2 overflow-hidden rounded-full border px-3 py-2 text-sm font-medium transition-[color,border-color] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] sm:px-5 sm:py-2.5 " +
                  "before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:rounded-full before:bg-foreground before:opacity-0 before:blur-2xl before:transition-[opacity,filter] before:duration-700 before:ease-[cubic-bezier(0.22,1,0.36,1)] " +
                  (f.value === "all" ? "mr-1.5 sm:mr-5 " : "") +
                  (active
                    ? "border-foreground bg-foreground text-background before:opacity-100 before:blur-none"
                    : "border-border bg-card text-foreground hover:border-foreground/40 hover:text-background hover:before:opacity-100 hover:before:blur-none")
                }
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </BlurFade>

      <div key={filter}>
        {filter === "awards" ? (
          <AwardsView />
        ) : (
          <div className="flex flex-col gap-24 sm:gap-32">
            {sections.map((section, sectionIdx) => (
              <section
                key={section.category}
                className="flex flex-col gap-10 sm:gap-12"
              >
                <BlurFade delay={120 + sectionIdx * 60} duration={600}>
                  <div className="flex items-center gap-6">
                    <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                      {section.label}
                    </span>
                    <span
                      aria-hidden="true"
                      className="h-px flex-1 bg-border/70"
                    />
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      {String(section.projects.length).padStart(2, "0")}
                    </span>
                  </div>
                </BlurFade>

                <div className="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 sm:gap-y-20">
                  {section.projects.map((project, i) => (
                    <BlurFade
                      key={project.slug}
                      delay={160 + sectionIdx * 60 + i * 70}
                      duration={750}
                      yOffset={18}
                    >
                      <ProjectCard project={project} />
                    </BlurFade>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
