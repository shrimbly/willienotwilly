"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  FilePenLine,
  LoaderCircle,
  Save,
  X,
} from "lucide-react";
import type { MDXEditorMethods } from "@mdxeditor/editor";
import { MdxEditor } from "./MdxEditor";

type EditorState = "idle" | "loading" | "saving" | "saved" | "error";

type PostResponse = {
  markdown: string;
  mtimeMs: number;
};

type SaveResponse = {
  ok: true;
  mtimeMs: number;
};

type MdxPostEditorProps = {
  slug: string;
  title: string;
};

async function responseError(response: Response) {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return payload?.error ?? `Request failed (${response.status})`;
}

export function MdxPostEditor({ slug, title }: MdxPostEditorProps) {
  const router = useRouter();
  const editorRef = useRef<MDXEditorMethods>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [editorState, setEditorState] = useState<EditorState>("idle");
  const [initialMarkdown, setInitialMarkdown] = useState<string | null>(null);
  const [savedMarkdown, setSavedMarkdown] = useState("");
  const [draftMarkdown, setDraftMarkdown] = useState("");
  const [mtimeMs, setMtimeMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDirty = initialMarkdown !== null && draftMarkdown !== savedMarkdown;

  const openEditor = useCallback(async () => {
    setIsOpen(true);
    setEditorState("loading");
    setError(null);
    setInitialMarkdown(null);

    try {
      const response = await fetch(`/api/dev/posts/${encodeURIComponent(slug)}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(await responseError(response));

      const post = (await response.json()) as PostResponse;
      setInitialMarkdown(post.markdown);
      setSavedMarkdown(post.markdown);
      setDraftMarkdown(post.markdown);
      setMtimeMs(post.mtimeMs);
      setEditorState("idle");
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load the post"
      );
      setEditorState("error");
    }
  }, [slug]);

  const savePost = useCallback(async () => {
    if (mtimeMs === null || editorState === "saving") return;

    const markdown = editorRef.current?.getMarkdown() ?? draftMarkdown;
    setEditorState("saving");
    setError(null);

    try {
      const response = await fetch(`/api/dev/posts/${encodeURIComponent(slug)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown, expectedMtimeMs: mtimeMs }),
      });
      if (!response.ok) throw new Error(await responseError(response));

      const result = (await response.json()) as SaveResponse;
      setDraftMarkdown(markdown);
      setSavedMarkdown(markdown);
      setMtimeMs(result.mtimeMs);
      setEditorState("saved");
      router.refresh();

      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setEditorState("idle"), 1600);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to save the post"
      );
      setEditorState("error");
    }
  }, [draftMarkdown, editorState, mtimeMs, router, slug]);

  const closeEditor = useCallback(() => {
    if (isDirty && !window.confirm("Discard your unsaved changes?")) return;

    setIsOpen(false);
    setInitialMarkdown(null);
    setError(null);
    setEditorState("idle");
  }, [isDirty]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void savePost();
      }
      if (event.key === "Escape") closeEditor();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeEditor, isOpen, savePost]);

  useEffect(
    () => () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    },
    []
  );

  return (
    <>
      <div className="mb-7 flex items-center justify-between gap-4 border-y border-dashed border-primary/30 py-2.5 text-xs">
        <div className="min-w-0">
          <span className="font-semibold uppercase tracking-[0.16em] text-primary">
            Development
          </span>
          <span className="ml-3 hidden truncate font-mono text-muted-foreground sm:inline">
            app/blog/posts/{slug}.mdx
          </span>
        </div>
        <button
          type="button"
          onClick={() => void openEditor()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 font-medium text-foreground shadow-xs transition hover:border-primary/50 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <FilePenLine className="size-3.5" aria-hidden="true" />
          Edit post
        </button>
      </div>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-stone-50 text-stone-900"
          role="dialog"
          aria-modal="true"
          aria-label={`Edit ${title}`}
        >
          <header className="flex min-h-16 items-center justify-between gap-4 border-b border-stone-200 bg-white px-4 sm:px-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-orange-800">
                  Dev only
                </span>
                <h2 className="truncate text-sm font-semibold sm:text-base">{title}</h2>
              </div>
              <p className="mt-0.5 truncate font-mono text-[11px] text-stone-500">
                app/blog/posts/{slug}.mdx
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden min-w-24 justify-end text-xs sm:flex">
                {editorState === "saving" ? (
                  <span className="inline-flex items-center gap-1.5 text-stone-500">
                    <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                    Saving
                  </span>
                ) : null}
                {editorState === "saved" ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-700">
                    <Check className="size-3.5" aria-hidden="true" />
                    Saved
                  </span>
                ) : null}
                {editorState === "error" ? (
                  <span className="inline-flex items-center gap-1.5 text-red-700">
                    <AlertTriangle className="size-3.5" aria-hidden="true" />
                    Save failed
                  </span>
                ) : null}
                {editorState === "idle" && isDirty ? (
                  <span className="text-stone-500">Unsaved changes</span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void savePost()}
                disabled={
                  initialMarkdown === null || editorState === "saving" || !isDirty
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-stone-900 px-3 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {editorState === "saving" ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="size-4" aria-hidden="true" />
                )}
                <span className="hidden sm:inline">Save</span>
              </button>
              <button
                type="button"
                onClick={closeEditor}
                className="grid size-9 place-items-center rounded-md border border-stone-200 bg-white text-stone-600 transition hover:bg-stone-100 hover:text-stone-950"
                aria-label="Close editor"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          </header>

          {error ? (
            <div className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800 sm:px-6">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>{error}</p>
            </div>
          ) : null}

          <main className="min-h-0 flex-1 overflow-auto">
            {editorState === "loading" ? (
              <div className="grid min-h-full place-items-center">
                <div className="flex items-center gap-2 text-sm text-stone-500">
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                  Loading source markdown…
                </div>
              </div>
            ) : null}

            {initialMarkdown !== null ? (
              <MdxEditor
                ref={editorRef}
                markdown={initialMarkdown}
                className="min-h-full bg-white"
                contentEditableClassName="prose prose-stone mx-auto min-h-[calc(100vh-8rem)] max-w-3xl px-6 py-12 outline-none sm:px-10"
                onChange={(markdown, initialMarkdownNormalize) => {
                  setDraftMarkdown(markdown);
                  if (initialMarkdownNormalize) setSavedMarkdown(markdown);
                  if (editorState === "error") {
                    setEditorState("idle");
                    setError(null);
                  }
                }}
                onError={(payload) => {
                  setError(payload.error);
                  setEditorState("error");
                }}
                autoFocus
              />
            ) : null}
          </main>
        </div>
      ) : null}
    </>
  );
}
