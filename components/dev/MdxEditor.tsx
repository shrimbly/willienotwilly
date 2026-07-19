"use client";

import dynamic from "next/dynamic";
import { forwardRef } from "react";
import type { MDXEditorMethods } from "@mdxeditor/editor";
import type { InitializedMdxEditorProps } from "./InitializedMdxEditor";

const ClientEditor = dynamic(() => import("./InitializedMdxEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[28rem] items-center justify-center text-sm text-stone-500">
      Loading the editor…
    </div>
  ),
});

export const MdxEditor = forwardRef<
  MDXEditorMethods,
  Omit<InitializedMdxEditorProps, "editorRef">
>((props, ref) => <ClientEditor {...props} editorRef={ref} />);

MdxEditor.displayName = "MdxEditor";
