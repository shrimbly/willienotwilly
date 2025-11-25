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

  return <Blog7 posts={formattedPosts} />;
}
