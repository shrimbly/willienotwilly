import { Blog7 } from "@/components/blog7";
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
    <Blog7
      tagline="Things I'm working on"
      heading="Willie Falloon"
      description="I'm Willie, I work in advertising as 'the tech guy'. Lately I'm most interested in radiance fields, image editing models, agentic coding tools, and large language models. This is just a place where I document personal projects and experiments."
      buttonText="View all articles"
      buttonUrl="/blog"
      posts={formattedPosts}
    />
  );
}
