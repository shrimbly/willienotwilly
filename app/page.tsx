import { Blog7 } from "@/components/blog7";
import { SiteFooter } from "@/components/ui/site-footer";
import { getAllPosts } from "@/lib/mdx";

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
        description="This is a place to document personal projects and experiments. Lately I'm most interested in radiance fields, image editing models, agentic coding tools, and large language models."
        posts={formattedPosts}
      />
      <SiteFooter variant="fixed" />
    </>
  );
}
