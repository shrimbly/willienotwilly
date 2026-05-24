import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Plus } from "lucide-react";

import { SiteFooter } from "@/components/ui/site-footer";
import { BlurFade } from "@/components/ui/blur-fade";
import { HeroEmbed } from "@/components/portfolio/hero-embed";
import { assetUrl } from "@/lib/asset-url";
import { projects, getProjectBySlug } from "@/lib/portfolio";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) return { title: "Project" };
  return {
    title: project.title,
    description: project.blurb,
  };
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) notFound();

  const externalReady = project.external && project.href !== "#";
  const isInternalHref = project.href.startsWith("/");
  const ctaLabel = project.ctaLabel ?? "Visit project";

  const CtaLink = ({
    className,
    children,
  }: {
    className: string;
    children: React.ReactNode;
  }) =>
    isInternalHref ? (
      <Link href={project.href} className={className}>
        {children}
      </Link>
    ) : (
      <a
        href={project.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {children}
      </a>
    );

  return (
    <>
      <section className="pt-12 pb-32 sm:pt-16 sm:pb-36 lg:pt-20 lg:pb-40">
        <div className="container mx-auto flex flex-col gap-14 px-4 sm:gap-20 lg:gap-24 lg:px-16">
          <BlurFade delay={0} duration={500} yOffset={6}>
            <Link
              href="/portfolio"
              className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Portfolio
            </Link>
          </BlurFade>

          <header className="flex flex-col gap-10">
            <BlurFade delay={80}>
              <h1 className="text-pretty text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                {project.title}
              </h1>
            </BlurFade>
            <BlurFade delay={240}>
              <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {project.description}
              </p>
            </BlurFade>
            <BlurFade delay={320}>
              <div className="flex flex-wrap items-center gap-x-10 gap-y-6 pt-2">
                {project.stats.map((s) => (
                  <div key={s.label} className="flex flex-col gap-1">
                    <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                      {s.label}
                    </span>
                    <span className="text-sm font-medium sm:text-base">
                      {s.value}
                    </span>
                  </div>
                ))}
                {externalReady && (
                  <CtaLink className="squircle group ml-auto inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium transition-colors hover:border-foreground/40 hover:bg-foreground hover:text-background">
                    {ctaLabel}
                    <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </CtaLink>
                )}
              </div>
            </BlurFade>
          </header>

          <BlurFade delay={120} duration={900} yOffset={20}>
            <div className="flex flex-col gap-3">
              {project.inset && (project.heroImage || project.image) ? (
                <div className="squircle relative w-full overflow-hidden rounded-[32px] border border-border/70 bg-[linear-gradient(135deg,#EEEEEE_0%,#FFFFFF_100%)] p-6 transition-colors duration-300 sm:rounded-[40px] sm:p-12">
                  <Image
                    src={assetUrl(project.heroImage ?? project.image!)}
                    alt={project.imageAlt ?? project.title}
                    width={project.imageWidth ?? 1600}
                    height={project.imageHeight ?? 900}
                    sizes="(min-width: 1024px) 1200px, 100vw"
                    quality={90}
                    className="block h-auto w-full rounded-2xl shadow-xl shadow-black/10 sm:rounded-3xl"
                    priority
                  />
                </div>
              ) : (
                <div className="squircle relative aspect-video w-full overflow-hidden rounded-[32px] border border-border/70 bg-card transition-colors duration-300 sm:rounded-[40px]">
                  <div
                    className={`absolute inset-0 h-full w-full ${project.placeholderClass}`}
                    aria-hidden="true"
                  />
                  {project.heroEmbed ? (
                    <HeroEmbed
                      src={project.heroEmbed}
                      title={`${project.title} — hero video`}
                    />
                  ) : (project.heroVideo || project.video) ? (
                    <video
                      className="absolute inset-0 h-full w-full object-cover"
                      src={assetUrl(project.heroVideo ?? project.video!)}
                      poster={project.heroPoster ? assetUrl(project.heroPoster) : project.poster ? assetUrl(project.poster) : undefined}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      aria-hidden="true"
                    />
                  ) : (project.heroImage || project.image) ? (
                    <Image
                      src={assetUrl(project.heroImage ?? project.image!)}
                      alt={project.imageAlt ?? project.title}
                      fill
                      sizes="(min-width: 1024px) 1200px, 100vw"
                      quality={90}
                      className="object-cover"
                      priority
                    />
                  ) : null}
                </div>
              )}
              {project.heroCredit && (
                <p className="px-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  {project.heroCredit.prefix && (
                    <>
                      {project.heroCredit.prefix}{" "}
                    </>
                  )}
                  <a
                    href={project.heroCredit.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-foreground transition-colors hover:text-primary"
                  >
                    {project.heroCredit.label}
                    <ArrowUpRight className="size-3" />
                  </a>
                </p>
              )}
            </div>
          </BlurFade>

          <div className="flex flex-col gap-20 sm:gap-28">
            {project.highlights.map((h, i) => (
              <BlurFade key={h.title} delay={60} duration={800} yOffset={16}>
                <div className="flex flex-col gap-6">
                  {h.phones && h.phones.length > 0 ? (
                    <div
                      className={`squircle relative w-full overflow-hidden rounded-[28px] border border-border/70 sm:rounded-[32px] ${h.placeholderClass}`}
                    >
                      <div
                        className="grid grid-cols-3 gap-3 p-6 sm:gap-5 sm:p-8 sm:[grid-template-columns:var(--phone-cols)]"
                        style={
                          {
                            ["--phone-cols" as string]: `repeat(${h.phones.length}, minmax(0, 1fr))`,
                          } as React.CSSProperties
                        }
                      >
                        {h.phones.map((p, pidx) => (
                          <div
                            key={pidx}
                            className="squircle relative overflow-hidden rounded-[14px] bg-black/5 sm:rounded-[18px]"
                            style={{ aspectRatio: "9/19.5" }}
                          >
                            <Image
                              src={assetUrl(p.src)}
                              alt={p.alt ?? `${h.title} — ${pidx + 1}`}
                              fill
                              sizes="(min-width: 1024px) 180px, 30vw"
                              className="object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : h.gallery && h.gallery.length > 0 ? (
                    <div
                      className={`squircle relative w-full overflow-hidden rounded-[28px] border border-border/70 sm:rounded-[32px] ${h.placeholderClass}`}
                      style={{ aspectRatio: h.galleryAspect ?? h.aspect ?? "24/9" }}
                    >
                      <div
                        className="absolute inset-0 grid"
                        style={
                          {
                            gridTemplateColumns: `repeat(${h.galleryCols ?? h.gallery.length}, minmax(0, 1fr))`,
                          } as React.CSSProperties
                        }
                      >
                        {h.gallery.map((g, gidx) => (
                          <div
                            key={gidx}
                            className="relative h-full w-full overflow-hidden"
                          >
                            <Image
                              src={assetUrl(g.src)}
                              alt={g.alt ?? `${h.title} — ${gidx + 1}`}
                              fill
                              sizes="(min-width: 1024px) 300px, 50vw"
                              className="object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : h.logos && h.logos.length > 0 ? (
                    <div
                      className="squircle relative w-full overflow-hidden rounded-[28px] border border-border/70 bg-white sm:rounded-[32px]"
                      style={{ aspectRatio: h.aspect ?? "16/9" }}
                    >
                      <div
                        className="absolute inset-0 grid grid-cols-2 sm:grid-cols-[var(--logo-cols)]"
                        style={
                          {
                            ["--logo-cols" as string]: `repeat(${h.logos.length}, minmax(0, 1fr))`,
                          } as React.CSSProperties
                        }
                      >
                        {h.logos.map((logo, lidx) => {
                          const isLastInRowMobile =
                            h.logos!.length % 2 === 1 &&
                            lidx === h.logos!.length - 1;
                          const lastRowStartMobile =
                            h.logos!.length -
                            (h.logos!.length % 2 === 1 ? 1 : 2);
                          const showMobileBorder =
                            lidx < lastRowStartMobile;
                          const showDesktopBorder = lidx < h.logos!.length - 1;
                          return (
                            <div
                              key={lidx}
                              className={
                                "flex flex-col items-center justify-center gap-3 p-8 sm:gap-4 sm:p-12 " +
                                (showDesktopBorder
                                  ? "sm:border-r sm:border-neutral-200 "
                                  : "") +
                                (showMobileBorder
                                  ? "border-b border-neutral-200 sm:border-b-0 "
                                  : "") +
                                (isLastInRowMobile ? "col-span-2 sm:col-span-1" : "")
                              }
                            >
                              {logo.kind === "more" ? (
                                <span
                                  className={`flex items-center justify-center text-neutral-400 ${logo.sizeClass ?? "h-12"}`}
                                >
                                  <Plus
                                    className="h-full w-auto"
                                    strokeWidth={1.5}
                                  />
                                </span>
                              ) : (
                                logo.src && (
                                  <Image
                                    src={assetUrl(logo.src)}
                                    alt={logo.alt}
                                    width={160}
                                    height={80}
                                    className={`max-w-[80%] ${logo.sizeClass ?? "h-12 w-auto"}`}
                                  />
                                )
                              )}
                              <span className="font-mono text-[11px] uppercase tracking-widest text-neutral-500">
                                {logo.alt}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : h.media && h.media.length > 0 ? (
                    <div
                      className="grid grid-cols-1 gap-4 sm:grid-cols-[var(--media-cols)] sm:gap-6"
                      style={
                        {
                          ["--media-cols" as string]: h.media
                            .map((m) => {
                              const [w, hh] = m.aspect
                                .split("/")
                                .map(Number);
                              return `${w / hh}fr`;
                            })
                            .join(" "),
                        } as React.CSSProperties
                      }
                    >
                      {h.media.map((m, idx) => (
                        <div
                          key={idx}
                          className="squircle relative w-full overflow-hidden rounded-[24px] border border-border/70 bg-card sm:rounded-[28px]"
                          style={{ aspectRatio: m.aspect }}
                        >
                          <div
                            className={`absolute inset-0 h-full w-full ${h.placeholderClass}`}
                            aria-hidden="true"
                          />
                          <video
                            className="absolute inset-0 h-full w-full object-cover"
                            src={assetUrl(m.src)}
                            autoPlay
                            muted
                            loop
                            playsInline
                            preload="metadata"
                            aria-label={m.alt ?? h.title}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      className={
                        "squircle relative w-full overflow-hidden rounded-[28px] border border-border/70 sm:rounded-[32px] " +
                        (h.inset
                          ? "bg-[linear-gradient(135deg,#EEEEEE_0%,#FFFFFF_100%)]"
                          : "bg-card")
                      }
                      style={{ aspectRatio: h.inset ? undefined : (h.aspect ?? "16/10") }}
                    >
                      {!h.inset && (
                        <div
                          className={`absolute inset-0 h-full w-full ${h.placeholderClass}`}
                          aria-hidden="true"
                        />
                      )}
                      {h.video ? (
                        <video
                          className="absolute inset-0 h-full w-full object-cover"
                          src={assetUrl(h.video)}
                          poster={h.poster ? assetUrl(h.poster) : undefined}
                          autoPlay
                          muted
                          loop
                          playsInline
                          preload="metadata"
                          aria-label={h.imageAlt ?? h.title}
                        />
                      ) : h.image ? (
                        h.inset ? (
                          <div className="flex w-full items-center justify-center p-10 sm:p-16">
                            <div
                              className={
                                "relative w-full overflow-hidden rounded-2xl shadow-xl shadow-black/10 sm:rounded-3xl " +
                                (h.maxWidthClass ?? "")
                              }
                              style={{ aspectRatio: h.aspect ?? "16/10" }}
                            >
                              <Image
                                src={assetUrl(h.image)}
                                alt={h.imageAlt ?? h.title}
                                fill
                                sizes="(min-width: 1024px) 960px, 100vw"
                                quality={90}
                                className="object-contain"
                              />
                            </div>
                          </div>
                        ) : (
                          <Image
                            src={assetUrl(h.image)}
                            alt={h.imageAlt ?? h.title}
                            fill
                            sizes="(min-width: 1024px) 960px, 100vw"
                            quality={90}
                            className="object-cover"
                          />
                        )
                      ) : (
                        <div
                          className="absolute inset-0 opacity-[0.15] mix-blend-overlay"
                          style={{
                            backgroundImage:
                              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
                          }}
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  )}
                  <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-10">
                    <div className="flex items-baseline gap-4">
                      <span className="font-mono text-xs text-muted-foreground">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <h2 className="text-xl font-medium tracking-tight sm:text-2xl">
                        {h.title}
                      </h2>
                    </div>
                    <p className="max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
                      {h.caption}
                    </p>
                  </div>
                </div>
              </BlurFade>
            ))}
          </div>

          {externalReady && (
            <BlurFade delay={60} duration={700}>
              <div className="flex flex-col items-start gap-6 border-t border-border/60 pt-12 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    {isInternalHref ? "Read more" : "See it live"}
                  </span>
                  <p className="text-lg font-medium tracking-tight sm:text-xl">
                    {project.title}
                  </p>
                </div>
                <CtaLink className="squircle group inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-medium transition-colors hover:border-foreground/40 hover:bg-foreground hover:text-background">
                  {ctaLabel}
                  <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </CtaLink>
              </div>
            </BlurFade>
          )}
        </div>
      </section>
      <SiteFooter variant="fixed" />
    </>
  );
}
