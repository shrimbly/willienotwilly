import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getAllPostSlugs, getPostBySlug } from "@/lib/mdx";
import remarkGfm from "remark-gfm";
import rehypePrettyCode from "rehype-pretty-code";
import Image from "next/image";
import { ComponentProps } from "react";

// Import custom components for MDX
import { ModelChart } from "@/components/charts/ModelChart";
import { MegaChart } from "@/components/charts/MegaChart";
import { LocalVideo } from "@/components/media/LocalVideo";
import { RockVotePrompt } from "@/components/rock-bench/RockVotePrompt";
import { RockVoteTable } from "@/components/rock-bench/RockVoteTable";
import { getRockBenchData } from "@/lib/rockBenchData";

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

  return {
    title: post.title,
    description: post.summary,
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

  return (
    <article className="container mx-auto max-w-3xl px-4 py-16">
      <header className="mb-8">
        <time className="text-sm text-muted-foreground">{post.date}</time>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">{post.title}</h1>
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
            ) => (
              <MegaChart data={rockBenchData} {...props} />
            ),
            // Video component
            LocalVideo: (props: ComponentProps<typeof LocalVideo>) => (
              <LocalVideo {...props} />
            ),
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
    </article>
  );
}
