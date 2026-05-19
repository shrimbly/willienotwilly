import { Blog7 } from "@/components/blog7";
import { SiteFooter } from "@/components/ui/site-footer";
import { getAllPosts } from "@/lib/mdx";
import { siteConfig } from "@/lib/site";

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
        heading={siteConfig.name}
        description={siteConfig.home.description}
        posts={formattedPosts}
      />
      <SiteFooter variant="fixed" />
    </>
  );
}
