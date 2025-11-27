import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getAllPostSlugs, getPostBySlug } from "@/lib/mdx";
import remarkGfm from "remark-gfm";
import rehypePrettyCode from "rehype-pretty-code";
import Image from "next/image";
import Link from "next/link";
import * as React from "react";
import { ComponentProps } from "react";
import { Linkedin } from "lucide-react";
import { XIcon } from "@/components/ui/x-icon";
import { SiteFooter } from "@/components/ui/site-footer";
import { SubscribeButton } from "@/components/ui/subscribe-button";

// Import custom components for MDX
import { ModelChart } from "@/components/charts/ModelChart";
import { MegaChart } from "@/components/charts/MegaChart";
import { LocalVideo } from "@/components/media/LocalVideo";
import { GptMiniGallery } from "@/components/media/GptMiniGallery";
import { SuddenJumpsGallery } from "@/components/media/SuddenJumpsGallery";
import { RockVotePrompt } from "@/components/rock-bench/RockVotePrompt";
import { RockVoteTable } from "@/components/rock-bench/RockVoteTable";
import { MobileHeader } from "@/components/ui/mobile-header";
import { getRockBenchData } from "@/lib/rockBenchData";
import { cn } from "@/lib/utils";

type Anchor = {
  href: string;
  label: string;
  level: number;
};

function extractAnchors(content: string): Anchor[] {
  const anchors: Anchor[] = [];
  const htmlHeadingRegex = /<h([2-4])[^>]*id="([^"]+)"[^>]*>(.*?)<\/h\1>/gim;
  let match: RegExpExecArray | null;

  while ((match = htmlHeadingRegex.exec(content))) {
    const [, levelRaw, id, labelRaw] = match;
    const level = Number(levelRaw);
    const label = labelRaw.replace(/<[^>]+>/g, "").trim();
    if (id && label) {
      anchors.push({ href: `#${id}`, label, level });
    }
  }

  if (anchors.length) return anchors;

  const markdownHeadingRegex = /^(#{2,4})\s+(.*)$/gim;
  while ((match = markdownHeadingRegex.exec(content))) {
    const [, hashes, text] = match;
    const level = hashes.length;
    const slug = text
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");
    anchors.push({ href: `#${slug}`, label: text.trim(), level });
  }

  return anchors;
}

type MdxImageProps = Omit<ComponentProps<typeof Image>, "alt" | "src"> & {
  alt?: string;
  src: string;
};

export async function generateStaticParams() {
  const slugs = getAllPostSlugs();
  return slugs.map((slug) => ({
    slug: slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return {
      title: "Post Not Found",
    };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://willienotwilly.com";
  const ogImage = post.image || "/TNTR OG.jpg";

  return {
    title: post.title,
    description: post.summary,
    keywords: post.keywords,
    authors: [{ name: "Willie Falloon", url: siteUrl }],
    creator: "Willie Falloon",
    publisher: "Willie Falloon",
    openGraph: {
      title: post.title,
      description: post.summary,
      type: "article",
      url: `${siteUrl}/${slug}`,
      siteName: "Willie Falloon",
      locale: "en_US",
      publishedTime: post.publishedTime,
      authors: ["Willie Falloon"],
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@ReflctWillie",
      creator: "@ReflctWillie",
      title: post.title,
      description: post.summary,
      images: [ogImage],
    },
    alternates: {
      canonical: `${siteUrl}/${slug}`,
    },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  // Load chart data only when rendering (server-side only)
  const rockBenchData = getRockBenchData();
  const anchors = extractAnchors(post.content);

  return (
    <>
      <MobileHeader anchors={anchors} />
      <article className="container mx-auto px-4 pt-20 pb-16 lg:pt-16 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12">
        <aside className="relative hidden lg:block">
          <nav className="sticky top-24">
            <Link href="/" className="mb-8 block text-xl font-semibold hover:text-primary transition">
              Willie Falloon
            </Link>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Jump ahead
            </p>
            <div className="space-y-2 border-l border-border/60 pl-3 text-sm">
              {anchors.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "block text-muted-foreground transition hover:text-primary",
                    {
                      "pl-2": item.level === 2,
                      "pl-5 text-[13px]": item.level === 3,
                      "pl-8 text-[12px]": item.level === 4,
                    }
                  )}
                >
                  {item.label}
                </a>
              ))}
            </div>
<div className="mt-8 flex gap-3 pl-3">
                              <a
                                href="https://x.com/ReflctWillie"
                                className="text-muted-foreground transition hover:text-primary"
                                aria-label="X"
                              >
                                <XIcon className="h-4 w-4" />
                              </a>
                              <a
                                href="https://www.linkedin.com/in/willie-falloon-961a8a68/"
                                className="text-muted-foreground transition hover:text-primary"
                                aria-label="LinkedIn"
                              >
                                <Linkedin className="h-4 w-4" />
                              </a>
                              <SubscribeButton />
                            </div>
          </nav>
        </aside>
        <div className="lg:max-w-3xl">
          <header className="mb-8">
          <time className="text-sm text-muted-foreground">{post.date}</time>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            {post.title}
          </h1>
          {post.summary && (
            <p className="mt-4 text-lg text-muted-foreground">{post.summary}</p>
          )}
        </header>
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <MDXRemote
            source={post.content}
            components={{
              // Override default img with Next.js Image
              img: (props: MdxImageProps) => {
                const { alt = "", ...rest } = props;
                return (
                  <Image
                    {...rest}
                    alt={alt}
                    width={800}
                    height={600}
                    className="my-8 rounded-lg"
                    sizes="(max-width: 768px) 100vw, 800px"
                  />
                );
              },
              // Custom chart components
              ModelChart: (
                props: Omit<ComponentProps<typeof ModelChart>, "data">
              ) => <ModelChart data={rockBenchData} {...props} />,
              MegaChart: (
                props: Omit<ComponentProps<typeof MegaChart>, "data">
              ) => <MegaChart data={rockBenchData} {...props} />,
              // Video component
              LocalVideo: (props: ComponentProps<typeof LocalVideo>) => (
                <LocalVideo {...props} />
              ),
              GptMiniGallery,
              SuddenJumpsGallery,
              RockVotePrompt,
              RockVoteTable,
            }}
            options={{
              mdxOptions: {
                remarkPlugins: [remarkGfm],
                rehypePlugins: [
                  [
                    rehypePrettyCode,
                    {
                      theme: "github-dark",
                      keepBackground: false,
                    },
                  ],
                ],
              },
            }}
          />
        </div>
        <SiteFooter variant="static" />
        </div>
      </article>
    </>
  );
}
