"use client";

import { useMemo, useState } from "react";
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CodeToggle,
  CreateLink,
  DiffSourceToggleWrapper,
  GenericJsxEditor,
  InsertCodeBlock,
  InsertImage,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  MDXEditor,
  Separator,
  UndoRedo,
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
  headingsPlugin,
  imagePlugin,
  jsxPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  type JsxComponentDescriptor,
  type MDXEditorMethods,
  type MDXEditorProps,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";

export type InitializedMdxEditorProps = MDXEditorProps & {
  editorRef?: React.Ref<MDXEditorMethods>;
};

const jsxComponentDescriptors: JsxComponentDescriptor[] = [
  {
    name: "LocalVideo",
    kind: "flow",
    props: [
      { name: "src", type: "string", required: true },
      { name: "poster", type: "string" },
      { name: "caption", type: "string" },
      { name: "className", type: "string" },
    ],
    hasChildren: false,
    Editor: GenericJsxEditor,
  },
  {
    name: "ModelChart",
    kind: "flow",
    props: [
      { name: "activeModel", type: "string", required: true },
      { name: "title", type: "string" },
      { name: "description", type: "string" },
      { name: "revealIndex", type: "number" },
      { name: "order", type: "expression" },
      { name: "caption", type: "string" },
    ],
    hasChildren: false,
    Editor: GenericJsxEditor,
  },
  {
    name: "MegaChart",
    kind: "flow",
    props: [
      { name: "title", type: "string" },
      { name: "description", type: "string" },
    ],
    hasChildren: false,
    Editor: GenericJsxEditor,
  },
  {
    name: "RockVotePrompt",
    kind: "flow",
    props: [{ name: "model", type: "string", required: true }],
    hasChildren: false,
    Editor: GenericJsxEditor,
  },
  ...["GptMiniGallery", "SuddenJumpsGallery", "RockVoteTable"].map(
    (name): JsxComponentDescriptor => ({
      name,
      kind: "flow",
      props: [],
      hasChildren: false,
      Editor: GenericJsxEditor,
    })
  ),
];

export default function InitializedMdxEditor({
  editorRef,
  markdown,
  ...props
}: InitializedMdxEditorProps) {
  const [originalMarkdown] = useState(markdown);
  const plugins = useMemo(
    () => [
      headingsPlugin({ allowedHeadingLevels: [1, 2, 3, 4] }),
      listsPlugin(),
      quotePlugin(),
      thematicBreakPlugin(),
      markdownShortcutPlugin(),
      linkPlugin(),
      linkDialogPlugin(),
      imagePlugin(),
      tablePlugin(),
      codeBlockPlugin({ defaultCodeBlockLanguage: "text" }),
      codeMirrorPlugin({
        codeBlockLanguages: {
          text: "Plain text",
          bash: "Bash",
          css: "CSS",
          js: "JavaScript",
          json: "JSON",
          python: "Python",
          ts: "TypeScript",
          tsx: "TSX",
        },
      }),
      jsxPlugin({ jsxComponentDescriptors, allowFragment: true }),
      diffSourcePlugin({ diffMarkdown: originalMarkdown, viewMode: "rich-text" }),
      toolbarPlugin({
        toolbarContents: () => (
          <DiffSourceToggleWrapper options={["rich-text", "source", "diff"]}>
            <UndoRedo />
            <Separator />
            <BlockTypeSelect />
            <BoldItalicUnderlineToggles />
            <CodeToggle />
            <ListsToggle />
            <Separator />
            <CreateLink />
            <InsertImage />
            <InsertTable />
            <InsertCodeBlock />
            <InsertThematicBreak />
          </DiffSourceToggleWrapper>
        ),
      }),
    ],
    [originalMarkdown]
  );

  return (
    <MDXEditor
      {...props}
      ref={editorRef}
      markdown={markdown}
      plugins={plugins}
    />
  );
}
