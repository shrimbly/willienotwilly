import { promises as fs } from "node:fs";
import path from "node:path";
import { compile } from "@mdx-js/mdx";
import { NextRequest, NextResponse } from "next/server";
import remarkGfm from "remark-gfm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const postsDirectory = path.resolve(process.cwd(), "app/blog/posts");
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const maxMarkdownBytes = 2 * 1024 * 1024;

function unavailable() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

function postPath(slug: string) {
  if (!slugPattern.test(slug)) return null;

  const filePath = path.resolve(postsDirectory, `${slug}.mdx`);
  if (!filePath.startsWith(`${postsDirectory}${path.sep}`)) return null;

  return filePath;
}

function splitFrontmatter(source: string) {
  const match = source.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  if (!match) return null;

  return {
    frontmatter: match[0],
    markdown: source.slice(match[0].length),
  };
}

function errorResponse(error: unknown) {
  if ((error as NodeJS.ErrnoException).code === "ENOENT") {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  console.error("Unable to update MDX post", error);
  return NextResponse.json(
    { error: "Unable to update the post" },
    { status: 500 }
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (process.env.NODE_ENV !== "development") return unavailable();

  const { slug } = await params;
  const filePath = postPath(slug);
  if (!filePath) {
    return NextResponse.json({ error: "Invalid post slug" }, { status: 400 });
  }

  try {
    const fileStat = await fs.lstat(filePath);
    if (!fileStat.isFile() || fileStat.isSymbolicLink()) return unavailable();

    const source = await fs.readFile(filePath, "utf8");
    const post = splitFrontmatter(source);
    if (!post) {
      return NextResponse.json(
        { error: "This post does not have valid frontmatter" },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { markdown: post.markdown, mtimeMs: fileStat.mtimeMs },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (process.env.NODE_ENV !== "development") return unavailable();

  const requestOrigin = request.headers.get("origin");
  const requestHost = request.headers.get("host");
  if (requestOrigin && requestHost) {
    try {
      if (new URL(requestOrigin).host !== requestHost) {
        return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
    }
  }

  const { slug } = await params;
  const filePath = postPath(slug);
  if (!filePath) {
    return NextResponse.json({ error: "Invalid post slug" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { markdown, expectedMtimeMs } = body as {
    markdown?: unknown;
    expectedMtimeMs?: unknown;
  };

  if (typeof markdown !== "string") {
    return NextResponse.json({ error: "Markdown must be a string" }, { status: 400 });
  }
  if (Buffer.byteLength(markdown, "utf8") > maxMarkdownBytes) {
    return NextResponse.json({ error: "Markdown is too large" }, { status: 413 });
  }
  if (typeof expectedMtimeMs !== "number" || !Number.isFinite(expectedMtimeMs)) {
    return NextResponse.json(
      { error: "The source revision is required" },
      { status: 400 }
    );
  }

  try {
    await compile(markdown, { remarkPlugins: [remarkGfm] });
  } catch (validationError) {
    const reason =
      validationError instanceof Error
        ? validationError.message.split("\n")[0]
        : "The edited content is not valid MDX";
    return NextResponse.json(
      { error: `Invalid MDX: ${reason}` },
      { status: 422 }
    );
  }

  const temporaryPath = path.join(
    postsDirectory,
    `.${slug}.${process.pid}.${Date.now()}.tmp`
  );

  try {
    const fileStat = await fs.lstat(filePath);
    if (!fileStat.isFile() || fileStat.isSymbolicLink()) return unavailable();

    if (Math.abs(fileStat.mtimeMs - expectedMtimeMs) > 0.5) {
      return NextResponse.json(
        { error: "The source file changed after the editor was opened" },
        { status: 409 }
      );
    }

    const source = await fs.readFile(filePath, "utf8");
    const post = splitFrontmatter(source);
    if (!post) {
      return NextResponse.json(
        { error: "This post does not have valid frontmatter" },
        { status: 422 }
      );
    }

    await fs.writeFile(temporaryPath, `${post.frontmatter}${markdown}`, {
      encoding: "utf8",
      mode: fileStat.mode,
    });
    await fs.rename(temporaryPath, filePath);
    const updatedStat = await fs.stat(filePath);

    return NextResponse.json(
      { ok: true, mtimeMs: updatedStat.mtimeMs },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    await fs.unlink(temporaryPath).catch(() => undefined);
    return errorResponse(error);
  }
}
