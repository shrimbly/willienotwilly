import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Post {
  id: string;
  title: string;
  summary: string;
  label: string;
  author: string;
  published: string;
  url: string;
  image: string;
}

interface Blog7Props {
  tagline?: string;
  heading: string;
  description: string;
  buttonText?: string;
  buttonUrl?: string;
  posts: Post[];
}

function Blog7({
  tagline,
  heading = "Willie Falloon",
  description = "I'm Willie, I work in advertising as 'the tech guy'. Lately I'm most interested in radiance fields, image editing models, agentic coding tools, and large language models. This is just a place where I document personal projects and experiments.",
  buttonText,
  buttonUrl,
  posts = [],
}: Blog7Props) {
  return (
    <section className="pt-16 pb-32 sm:pt-24 sm:pb-36 lg:pt-32 lg:pb-40">
      <div className="container mx-auto flex flex-col gap-10 px-4 sm:gap-12 lg:gap-16 lg:px-16">
        <div>
          {tagline && (
            <Badge variant="secondary" className="mb-4 sm:mb-6">
              {tagline}
            </Badge>
          )}
          <h1 className="mb-3 text-pretty text-2xl font-semibold sm:text-3xl md:mb-4 md:text-4xl lg:mb-6 lg:max-w-3xl lg:text-5xl">
            {heading}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed sm:text-base lg:max-w-2xl lg:text-lg">
            {description}
          </p>
          {buttonText && buttonUrl && (
            <Button variant="link" className="mt-6 w-full sm:w-auto" asChild>
              <a href={buttonUrl} target="_blank">
                {buttonText}
                <ArrowRight className="ml-2 size-4" />
              </a>
            </Button>
          )}
        </div>
        <div className="w-full max-w-3xl">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={post.url}
              className="group flex flex-col gap-1 py-4 border-b border-border/60 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-4 transition-colors hover:border-border"
            >
              <span className="text-xs text-muted-foreground sm:text-sm sm:whitespace-nowrap">
                {post.published}
              </span>
              <span className="text-base font-medium group-hover:text-primary transition-colors sm:text-lg">
                {post.title}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export { Blog7 };
