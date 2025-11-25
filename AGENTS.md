# Repository Guidelines

## Project Structure & Module Organization
- `app/` hosts the Next.js App Router. Keep blog listings in `app/blog`, render MDX posts with `[slug]/page.tsx`, and share wrappers through `app/layout.tsx`.
- `components/` is split by concern (`components/ui`, `components/charts`, `components/media`); keep every component self-contained and export only the public surface.
- `lib/` centralizes MDX helpers (`lib/mdx.ts`), chart data (`lib/rockBenchData.ts`), and utilities (`lib/utils.ts`). Static assets stay in `public/`, while Tailwind tokens live in `app/globals.css`. Import shared code with the `@/*` path alias defined in `tsconfig.json`.

## Build, Test, and Development Commands
- `npm install` — sync dependencies defined in `package.json`.
- `npm run dev` — start the HMR dev server on `http://localhost:3000`.
- `npm run build` — create the production bundle; this also verifies MDX and type safety.
- `npm run start` — boot the compiled app to smoke-test deployment artifacts.
- `npm run lint` — execute ESLint; append `-- --fix` for autofixes before committing.

## Coding Style & Naming Conventions
- Use TypeScript everywhere (compilation is `strict`). Default to React Server Components; add `"use client"` only when hooks or browser APIs are required.
- Adopt PascalCase for component files and camelCase for helpers; author MDX entries in kebab-case under `app/blog`.
- Favor Tailwind utility classes plus the theme values defined in `app/globals.css`; reserve inline styles for dynamic values only.
- Run `npm run lint` pre-push to satisfy `eslint.config.mjs`, keeping imports grouped as React -> Next -> `@/*`.

## Testing Guidelines
- No automated suite exists yet, so always run `npm run lint`, `npm run build`, and manual browse-throughs before opening a PR.
- When tests are added, co-locate them in `__tests__` folders beside the feature, exercise components with Testing Library, name specs `feature-name.spec.tsx`, and keep shared fixtures in `lib/`.

## Commit & Pull Request Guidelines
- Keep commits short and imperative (`Add hero metrics chart`), matching the existing `Initial commit from Create Next App` style. Reference issue IDs or content tickets in the body.
- Squash before review and include PR descriptions that cite the touched routes, evidence of `npm run build`, and screenshots for visual shifts or new MDX content.

## Content & Data Tips
- MDX parsing relies on `lib/mdx.ts` and `@mdx-js/loader`; validate frontmatter keys locally to avoid runtime crashes.
- Charts read from `lib/rockBenchData.ts`, so extend the exported arrays instead of hardcoding numbers inside React components.
