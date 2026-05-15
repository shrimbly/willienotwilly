import type { Metadata } from "next";

import { SiteFooter } from "@/components/ui/site-footer";
import { BlurFade } from "@/components/ui/blur-fade";
import { PortfolioGrid } from "@/components/portfolio-grid";
import { projects } from "@/lib/portfolio";

export const metadata: Metadata = {
  title: "Portfolio",
  description:
    "Selected projects by Willie Falloon — AI tooling, 3D Gaussian Splatting, creative software, and product leadership.",
};

export default function PortfolioPage() {
  return (
    <>
      <section className="pt-12 pb-32 sm:pt-16 sm:pb-36 lg:pt-20 lg:pb-40">
        <div className="container mx-auto flex flex-col gap-14 px-4 sm:gap-20 lg:gap-24 lg:px-16">
          <BlurFade delay={0} duration={500} yOffset={6}>
            <p className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Portfolio
            </p>
          </BlurFade>

          <header className="flex flex-col gap-10">
            <BlurFade delay={80}>
              <h1 className="text-pretty text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Willie Falloon
              </h1>
            </BlurFade>
            <BlurFade delay={160}>
              <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                I&rsquo;m a product designer and a builder. When I have an
                idea, I build the software to bring it to life.
              </p>
            </BlurFade>
          </header>

          <PortfolioGrid projects={projects} />
        </div>
      </section>
      <SiteFooter variant="fixed" />
    </>
  );
}
