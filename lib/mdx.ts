import fs from "fs";
import path from "path";
import matter from "gray-matter";

const postsDirectory = path.join(process.cwd(), "app/blog/posts");

export interface PostMetadata {
  title: string;
  date: string;
  summary: string;
  slug: string;
  image?: string;
  publishedTime?: string;
  keywords?: string[];
  unlisted?: boolean;
}

export interface Post extends PostMetadata {
  content: string;
}

export function getAllPosts(): PostMetadata[] {
  // Check if posts directory exists
  if (!fs.existsSync(postsDirectory)) {
    return [];
  }

  const fileNames = fs.readdirSync(postsDirectory);
  const allPostsData = fileNames
    .filter((fileName) => fileName.endsWith(".mdx"))
    .map((fileName) => {
      const slug = fileName.replace(/\.mdx$/, "");
      const fullPath = path.join(postsDirectory, fileName);
      const fileContents = fs.readFileSync(fullPath, "utf8");
      const { data } = matter(fileContents);

      return {
        slug,
        title: data.title || "",
        date: data.date || "",
        summary: data.summary || "",
        image: data.image,
        publishedTime: data.publishedTime,
        keywords: data.keywords,
        unlisted: data.unlisted || false,
      };
    })
    .filter((post) => !post.unlisted);

  // Sort posts by publishedTime (most recent first)
  return allPostsData.sort((a, b) => {
    const dateA = a.publishedTime ? new Date(a.publishedTime).getTime() : 0;
    const dateB = b.publishedTime ? new Date(b.publishedTime).getTime() : 0;
    return dateB - dateA;
  });
}

export function getPostBySlug(slug: string): Post | null {
  try {
    const fullPath = path.join(postsDirectory, `${slug}.mdx`);
    const fileContents = fs.readFileSync(fullPath, "utf8");
    const { data, content } = matter(fileContents);

    return {
      slug,
      title: data.title || "",
      date: data.date || "",
      summary: data.summary || "",
      image: data.image,
      publishedTime: data.publishedTime,
      keywords: data.keywords,
      content,
    };
  } catch {
    return null;
  }
}

export function getAllPostSlugs(): string[] {
  if (!fs.existsSync(postsDirectory)) {
    return [];
  }

  const fileNames = fs.readdirSync(postsDirectory);
  return fileNames
    .filter((fileName) => fileName.endsWith(".mdx"))
    .map((fileName) => fileName.replace(/\.mdx$/, ""));
}
