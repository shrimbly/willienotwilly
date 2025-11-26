import { Blog7 } from "@/components/blog7";
import { getAllPosts } from "@/lib/mdx";
import { Linkedin } from "lucide-react";

export default function Home() {
  const posts = getAllPosts();

  const formattedPosts = posts.map((post) => ({
    id: post.slug,
    title: post.title,
    summary: post.summary,
    label: "",
    author: "",
    published: post.date,
    url: `/${post.slug}`,
    image: "",
  }));

  return (
    <>
      <Blog7
        heading="Willie Falloon"
        description="This is a place to document personal projects and experiments. Lately I'm most interested in radiance fields, image editing models, agentic coding tools, and large language models. "
        posts={formattedPosts}
      />
      <footer className="fixed bottom-0 left-0 right-0 bg-background border-t border-border/70 pt-6 pb-6 font-mono text-sm text-muted-foreground">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap items-center gap-6">
            <span>Willie Falloon - opinions are my own.</span>
            <a
              href="https://x.com/ReflctWillie"
              className="inline-flex items-center gap-1 text-primary hover:underline"
              aria-label="Personal projects on X"
            >
              <span className="font-semibold">𝕏</span>
              <span>- Personal projects</span>
            </a>
            <a
              href="https://www.linkedin.com/in/willie-falloon-961a8a68/"
              className="inline-flex items-center gap-1 text-primary hover:underline"
              aria-label="Dayjob on LinkedIn"
            >
              <Linkedin className="h-4 w-4" />
              <span>- Day job</span>
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
