export type HighlightMedia = {
  src: string;
  aspect: string;
  alt?: string;
};

export type ProviderLogo = {
  src?: string;
  alt: string;
  sizeClass?: string;
  kind?: "image" | "more";
};

export type PhoneShot = {
  src: string;
  alt?: string;
};

export type GalleryShot = {
  src: string;
  alt?: string;
};

export type Highlight = {
  title: string;
  caption: string;
  aspect?: string;
  placeholderClass: string;
  image?: string;
  imageAlt?: string;
  video?: string;
  media?: HighlightMedia[];
  logos?: ProviderLogo[];
  phones?: PhoneShot[];
  gallery?: GalleryShot[];
  galleryAspect?: string;
  galleryCols?: number;
  inset?: boolean;
  maxWidthClass?: string;
};

export type ProjectStat = {
  label: string;
  value: string;
};

export type ProjectCategory = "personal" | "professional";

export type ProjectCredit = {
  label: string;
  href: string;
  prefix?: string;
};

export type Project = {
  slug: string;
  title: string;
  blurb: string;
  description: string;
  meta: string;
  year: string;
  href: string;
  external?: boolean;
  ctaLabel?: string;
  placeholderClass: string;
  image?: string;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
  video?: string;
  heroVideo?: string;
  heroImage?: string;
  heroEmbed?: string;
  heroCredit?: ProjectCredit;
  category: ProjectCategory;
  stats: ProjectStat[];
  highlights: Highlight[];
  inset?: boolean;
};

export type PortfolioFilter = "all" | ProjectCategory | "awards";

export const categoryFilters: { value: PortfolioFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "personal", label: "Personal" },
  { value: "professional", label: "Professional" },
  { value: "awards", label: "Awards" },
];

export const projects: Project[] = [
  {
    slug: "reflct",
    title: "Reflct",
    blurb:
      "Web platform for publishing and curating 3D Gaussian Splatting scenes with managed views, camera controls, and React integration.",
    description:
      "Reflct makes radiance-field captures shareable for non-technical audiences. A managed viewer, curated camera paths, and a React SDK turn raw Gaussian splats into embeddable scenes that load fast and play nicely on the web.",
    meta: "Founder · Active",
    year: "2024",
    href: "https://reflct.app",
    external: true,
    category: "personal",
    placeholderClass: "bg-muted",
    video: "/videos/portfolio/reflct-1-1.mp4",
    heroVideo: "/videos/portfolio/reflct-hero.mp4",
    stats: [
      { label: "Role", value: "Founder" },
      { label: "Status", value: "Active" },
      { label: "Stack", value: "Next · Three" },
    ],
    highlights: [
      {
        title: "Embeddable viewer",
        caption:
          "Drop a splat scene anywhere with a single component — managed camera, lighting, and quality scaling.",
        aspect: "16/9",
        placeholderClass: "bg-muted",
        video: "/videos/portfolio/reflct-viewer.mp4",
      },
      {
        title: "Curated camera paths",
        caption:
          "Authors choreograph the hero shots so every visitor sees the scene at its best.",
        aspect: "16/9",
        placeholderClass: "bg-muted",
        video: "/videos/portfolio/reflct-camera.mp4",
      },
      {
        title: "Shopify app",
        caption:
          "Drop a 3D scene onto any Shopify product page — merchants install once and embed splats next to their photography with no code.",
        aspect: "4/3",
        placeholderClass: "bg-muted",
        media: [
          {
            src: "/videos/portfolio/reflct-shopify-square.mp4",
            aspect: "4/5",
            alt: "Reflct Shopify app — embedded 3D scene on a product page",
          },
          {
            src: "/videos/portfolio/reflct-shopify-wide.mp4",
            aspect: "1576/1326",
            alt: "Reflct Shopify app — admin configuration view",
          },
        ],
      },
    ],
  },
  {
    slug: "node-banana",
    title: "Node Banana",
    blurb:
      "Node-based workflow builder for generative AI pipelines with Fal, Replicate, Wavespeed, Kie, and Gemini. Free and open source.",
    description:
      "A free, open-source canvas for stitching together generative AI APIs. Drag nodes, route media between providers, and prototype pipelines that would otherwise live in a stack of Python scripts.",
    meta: "1.4k stars · TypeScript",
    year: "2026",
    href: "https://github.com/shrimbly/node-banana",
    external: true,
    category: "personal",
    placeholderClass: "bg-muted",
    video: "/videos/portfolio/banana.mp4",
    stats: [
      { label: "Stars", value: "1.4k" },
      { label: "License", value: "MIT" },
      { label: "Stack", value: "TypeScript" },
    ],
    highlights: [
      {
        title: "Bring your own provider",
        caption:
          "Built-in integrations for Replicate, Fal, Google Gemini, Wavespeed, and others.",
        aspect: "22/9",
        placeholderClass: "bg-white",
        logos: [
          { src: "/images/portfolio/providers/replicate.png", alt: "Replicate" },
          { src: "/images/portfolio/providers/fal.png", alt: "Fal" },
          { src: "/images/portfolio/providers/gemini.svg", alt: "Google Gemini" },
          {
            src: "/images/portfolio/providers/wavespeed.png",
            alt: "Wavespeed",
            sizeClass: "h-[3.75rem] w-auto",
          },
          { kind: "more", alt: "More" },
        ],
      },
      {
        title: "Prompt variables",
        caption:
          "Prompts adapt at run time. Drop variables into any prompt and they're substituted from upstream inputs as the graph runs.",
        aspect: "16/9",
        placeholderClass: "bg-muted",
        video: "/videos/portfolio/nd-variables2.mp4",
      },
      {
        title: "Ease curve node",
        caption:
          "Bezier-controlled interpolation between any two values — drives parameter sweeps, batch renders, and motion-style outputs.",
        aspect: "1/1",
        placeholderClass: "bg-muted",
        video: "/videos/portfolio/nd-ease.mp4",
      },
      {
        title: "Fallback models",
        caption:
          "When a provider rate-limits or errors, the graph quietly retries against a secondary model without dropping the run.",
        aspect: "16/9",
        placeholderClass: "bg-muted",
        video: "/videos/portfolio/nd-fallback.mp4",
      },
    ],
  },
  {
    slug: "sharp-frames",
    title: "Sharp Frames",
    blurb:
      "CLI for extracting in-focus frames from video using Laplacian variance scoring. Three selection algorithms tuned for 3DGS dataset prep.",
    description:
      "A free, open-source focus-aware frame extractor for radiance-field capture. Sharp Frames scores each frame for sharpness, then picks the optimal set using one of three selection algorithms. Available as a Windows desktop app, a web tool, and a Python package with both a CLI and a terminal UI.",
    meta: "152 stars · Python",
    year: "2024",
    href: "https://github.com/Reflct/sharp-frames-python",
    external: true,
    category: "personal",
    placeholderClass: "bg-muted",
    video: "/videos/portfolio/sharp.mp4",
    stats: [
      { label: "Stars", value: "152" },
      { label: "Language", value: "Python" },
      { label: "Use", value: "3DGS prep" },
    ],
    highlights: [
      {
        title: "Terminal UI",
        caption:
          "A keyboard-driven TUI walks you through input selection, scoring, and export — no flags to memorise.",
        aspect: "16/9",
        placeholderClass: "bg-muted",
        video: "/videos/portfolio/sf-tui.mp4",
      },
    ],
  },
  {
    slug: "easy-peasy-ease",
    title: "Easy Peasy Ease",
    blurb:
      "Browser-based video editor for seamless looped videos with Bezier speed curves and audio mixing. Client-side processing via media bunny.",
    description:
      "A free, open-source browser-only video editor focused on one thing: making perfect loops. Bezier-controlled speed curves let you sculpt a tail back into a head, and everything runs client-side over media bunny — no upload, no server.",
    meta: "105 stars · TypeScript",
    year: "2025",
    href: "https://github.com/shrimbly/easy-peasy-ease",
    external: true,
    category: "personal",
    placeholderClass: "bg-muted",
    video: "/videos/portfolio/ezpz.mp4",
    stats: [
      { label: "Stars", value: "105" },
      { label: "Stack", value: "TypeScript" },
      { label: "Runtime", value: "Browser" },
    ],
    highlights: [
      {
        title: "Bezier speed curves",
        caption:
          "Drag a curve to retime any clip — perfect for stitching a seamless out-to-in.",
        aspect: "16/10",
        placeholderClass: "bg-muted",
      },
      {
        title: "Audio mixing",
        caption:
          "Crossfade and mix tracks directly in the timeline, all without leaving the browser.",
        aspect: "4/3",
        placeholderClass: "bg-muted",
      },
      {
        title: "Client-side render",
        caption:
          "Media bunny does the heavy lifting locally — nothing leaves your machine.",
        aspect: "16/10",
        placeholderClass: "bg-muted",
      },
    ],
  },
  {
    slug: "contact-sheet-prompting",
    title: "Contact Sheet Prompting",
    blurb:
      "A prompting technique I pioneered for image-to-video workflows. Now used at Glif, Weavy, Leonardo AI, ComfyUI, and beyond.",
    description:
      "A prompting technique I pioneered for image-to-video workflows. Prompt a reasoning image model like Nano Banana Pro to generate a 6–9 frame contact sheet that tells a cohesive story, then feed those frames as keyframes into an animator like Kling 2.6. The original write-up is on the blog, and the technique has since been built into Glif, Weavy, Leonardo AI, ComfyUI, and more.",
    meta: "Technique · Widely adopted",
    year: "2025",
    href: "/contact-sheet-prompting",
    external: true,
    ctaLabel: "Read the article",
    category: "personal",
    placeholderClass: "bg-muted",
    video: "/videos/portfolio/contact-sheet.mp4",
    stats: [
      { label: "Year", value: "2025" },
      { label: "Format", value: "Technique" },
      { label: "Adopted", value: "Industry-wide" },
    ],
    highlights: [
      {
        title: "Reasoning-driven grids",
        caption:
          "Nano Banana Pro generates a 6–9 frame contact sheet from a single prompt, leaning into its reasoning to keep characters, lighting, and continuity consistent across every frame.",
        aspect: "2528/1696",
        placeholderClass: "bg-muted",
        image: "/images/contact-sheet/contact-sheet.jpg",
        imageAlt: "Generated contact sheet — multi-frame story from a single prompt",
      },
      {
        title: "Kinetic type animation",
        caption:
          "The same technique adapts beyond character work. Here the contact sheet drives a kinetic type sequence, with each frame setting up the next pose for the animator.",
        aspect: "16/9",
        placeholderClass: "bg-muted",
        video: "/videos/portfolio/contact-kinetic-type.mp4",
      },
      {
        title: "Industry adoption",
        caption:
          "Glif, Weavy, Leonardo AI, ComfyUI, and others have built the technique into their products and workflows since the original write-up went live.",
        aspect: "1514/897",
        placeholderClass: "bg-muted",
        image: "/images/portfolio/contact-sheet-comfyui.png",
        imageAlt: "ComfyUI templates including Contact Sheet Workflow steps",
      },
    ],
  },
  {
    slug: "flipper-studio",
    title: "Flipper Studio",
    blurb:
      "AI photo enhancement for online resellers. Capture every product in a single pass, then pick a marketplace-ready preset.",
    description:
      "Flipper Studio turns rushed product shots into marketplace-ready images for eBay, Etsy, and Facebook Marketplace. Capture every product in a single pass, then apply pre-built style presets. A background prompt-enhancement step rewrites the user's input to push each image toward its intended style.",
    meta: "Retired · AI tooling",
    year: "2025",
    href: "https://flipperstudio.com",
    external: true,
    category: "personal",
    placeholderClass: "bg-muted",
    video: "/videos/portfolio/flip.mp4",
    stats: [
      { label: "Status", value: "Retired" },
      { label: "Focus", value: "Marketplaces" },
      { label: "Runtime", value: "Browser" },
    ],
    highlights: [
      {
        title: "Capture and style in one pass",
        caption:
          "Photograph every product in a single shoot, then apply a marketplace-ready preset. A background prompt-enhancement step rewrites the input to push each image toward its intended style.",
        aspect: "16/9",
        placeholderClass: "bg-muted",
        video: "/videos/portfolio/flipper-demo.mp4",
      },
    ],
  },
  {
    slug: "try-galaxy",
    title: "Try Galaxy",
    inset: true,
    imageWidth: 1080,
    imageHeight: 1080,
    blurb:
      "Web experience that lets iPhone and Android owners try Samsung's One UI on their own device — interactive demos of Galaxy AI, camera, and design.",
    description:
      "Samsung's Try Galaxy turns any phone into a Galaxy. Users swipe through One UI directly in their mobile browser, exploring Galaxy AI features, camera tools, themes, and the wider ecosystem — without buying the hardware. Designed to reach iPhone owners in the moment of curiosity. Reached 144 million users.",
    meta: "Samsung · 144M users",
    year: "2024",
    href: "https://www.trygalaxy.com",
    external: true,
    category: "professional",
    placeholderClass: "bg-muted",
    video: "/videos/portfolio/try-galaxy-card.mp4",
    heroEmbed:
      "https://www.youtube.com/embed/BCgk02jgnPQ?start=14&autoplay=1&mute=1&loop=1&playlist=BCgk02jgnPQ&controls=0&modestbranding=1&rel=0&playsinline=1&enablejsapi=1",
    heroCredit: {
      prefix: "",
      label: "One of many organic YouTube videos covering Try Galaxy.",
      href: "https://youtu.be/BCgk02jgnPQ?t=14",
    },
    stats: [
      { label: "Role", value: "Head of Product" },
      { label: "Client", value: "Samsung" },
      { label: "Reach", value: "144M users" },
    ],
    highlights: [
      {
        title: "Galaxy in any phone",
        caption:
          "Interactive home screen, design picker, camera, and AI editing — all running directly in Safari or Chrome on the visitor's device.",
        aspect: "16/9",
        placeholderClass: "bg-muted",
        image: "/images/portfolio/try-galaxy-1.png",
        imageAlt:
          "Four phones showing the Try Galaxy home screen, design picker, camera, and AI photo editor",
      },
      {
        title: "Feature walkthroughs",
        caption:
          "Step-by-step demos of Object Eraser, Photo Remaster, SmartThings, Mindfulness, and the wider Galaxy AI ecosystem.",
        aspect: "16/9",
        placeholderClass: "bg-muted",
        image: "/images/portfolio/try-galaxy-2.webp",
        imageAlt:
          "Row of phones demonstrating Object Eraser, Photo Remaster, and Mindfulness in One UI",
      },
    ],
  },
  {
    slug: "wewrangle-audio",
    title: "WeWrangle Audio",
    inset: true,
    blurb:
      "AI radio production at broadcast scale. Cloned voices, mastering, and review workflows shipping spots for retailers across three countries.",
    description:
      "WeWrangle Audio is a production tool for AI radio at broadcast scale. It wraps ElevenLabs voice cloning in the workflow features broadcast actually needs — configurable review phases, cloud-based mixing and mastering, and bulk editing. In production for Kroger, Coles, New World, and Genesis Energy.",
    meta: "WeWrangle · DDB",
    year: "2024",
    href: "https://wewrangle.com",
    external: true,
    category: "professional",
    placeholderClass: "bg-muted",
    image: "/images/portfolio/wewrangle-audio/script-v2.png",
    imageAlt: "WeWrangle Audio — script editor with VO and history",
    imageWidth: 2048,
    imageHeight: 1111,
    heroImage: "/images/portfolio/wewrangle-audio/script-v2.png",
    stats: [
      { label: "Role", value: "Head of Product" },
      { label: "Clients", value: "Kroger, Coles, New World, Genesis" },
      { label: "Year", value: "2024" },
    ],
    highlights: [
      {
        title: "Spots, organized by period",
        caption:
          "Editors see every spot across every period in one place — broadcast week, status, spot count, and one-click export.",
        aspect: "2048/1152",
        placeholderClass: "bg-neutral-100",
        image: "/images/portfolio/wewrangle-audio/dashboard-v2.png",
        imageAlt: "WeWrangle Audio — Kroger dashboard",
        inset: true,
      },
      {
        title: "Broadcast-grade controls",
        caption:
          "Speed and volume adjustments, library search, and audio uploads sit next to the script so producers shape every spot without bouncing between tools.",
        aspect: "620/956",
        maxWidthClass: "max-w-xs",
        placeholderClass: "bg-neutral-100",
        image: "/images/portfolio/wewrangle-audio/controls-v2.png",
        imageAlt: "WeWrangle Audio — per-track controls",
        inset: true,
      },
    ],
  },
  {
    slug: "wewrangle-studio",
    title: "WeWrangle Studio",
    inset: true,
    blurb:
      "Branded image generation built for AA Insurance. Custom fine-tunes and prompt-enhanced editing behind a deliberately simple interface.",
    description:
      "WeWrangle Studio is a branded image generation tool. Custom fine-tunes hold the brand line; prompt enhancement and edit-by-instruction smooth the rough edges of generative tooling. The interface is intentionally bare, tailored to clients new to AI.",
    meta: "WeWrangle · DDB",
    year: "2024",
    href: "https://wewrangle.com",
    external: true,
    category: "professional",
    placeholderClass: "bg-muted",
    image: "/images/portfolio/wewrangle-studio/results-v2.png",
    imageAlt: "WeWrangle Studio — prompt-enhanced edit step",
    imageWidth: 1656,
    imageHeight: 917,
    heroImage: "/images/portfolio/wewrangle-studio/results-v2.png",
    stats: [
      { label: "Role", value: "Head of Product" },
      { label: "Client", value: "AA Insurance" },
      { label: "Year", value: "2024" },
    ],
    highlights: [
      {
        title: "Prompt-enhanced editing",
        caption:
          "Generated images carry forward into an edit step where natural-language instructions adjust the image without breaking the brand fine-tune underneath.",
        aspect: "1873/904",
        placeholderClass: "bg-neutral-100",
        image: "/images/portfolio/wewrangle-studio/interface-v2.png",
        imageAlt: "WeWrangle Studio — generation interface",
        inset: true,
      },
    ],
  },
  {
    slug: "anz-blue",
    title: "ANZ Blue",
    inset: true,
    imageWidth: 1024,
    imageHeight: 768,
    blurb:
      "Generative pipeline for ANZ Bank's Blu-tack mascot. A fine-tuned Flux Dev LoRA in ComfyUI produces 'Blue' in any product-led shape, on demand.",
    description:
      "Blue is ANZ Bank's mascot — a piece of Blu-tack moulded into a different shape for each banking product in tactical comms. The originals were rendered in 3D, slowly and at cost. A fine-tuned Flux Dev LoRA wrapped in a ComfyUI pipeline produces new Blue characters on demand, in seconds.",
    meta: "ANZ · DDB",
    year: "2023",
    href: "https://www.anz.co.nz",
    external: true,
    category: "professional",
    placeholderClass: "bg-muted",
    image: "/images/portfolio/anz-blue/blue-tophat.png",
    imageAlt: "ANZ Blue — Blu-tack mascot wearing a top hat",
    heroImage: "/images/portfolio/anz-blue/blue-tophat.png",
    stats: [
      { label: "Role", value: "Head of Product" },
      { label: "Client", value: "ANZ" },
      { label: "Year", value: "2023" },
    ],
    highlights: [
      {
        title: "One mascot, every product",
        caption:
          "A fine-tuned Flux Dev LoRA renders Blue as a piggy bank, a wallet, a padlock — or whatever the next campaign needs — in seconds, replacing a costly 3D pipeline.",
        aspect: "32/9",
        placeholderClass: "bg-card",
        gallery: [
          {
            src: "/images/portfolio/anz-blue/blue-piggy.png",
            alt: "Blue as a piggy bank",
          },
          {
            src: "/images/portfolio/anz-blue/blue-wallet.png",
            alt: "Blue as a wallet",
          },
          {
            src: "/images/portfolio/anz-blue/blue-padlock.png",
            alt: "Blue as a padlock",
          },
          {
            src: "/images/portfolio/anz-blue/blue-umbrella.png",
            alt: "Blue as an umbrella",
          },
        ],
      },
    ],
  },
  {
    slug: "if-you-seek",
    title: "If You Seek",
    inset: true,
    imageWidth: 2688,
    imageHeight: 1656,
    blurb:
      "Six mobile-first digital experiences for Tourism New Zealand's 'If You Seek' campaign. Each one pairs a sensory film with a different smartphone-sensor interaction.",
    description:
      "If You Seek is Tourism New Zealand's 2022 campaign for travellers with a seeker mindset. I led the development of six mobile-first digital experiences. Each one paired a sensory film with a different smartphone interaction, using the microphone, camera, and accelerometer to embody manaakitanga and reward those who actively sought more.",
    meta: "Tourism New Zealand · DDB",
    year: "2022",
    href: "https://www.ddbgroup.co.nz/our-work/if-you-seek",
    external: true,
    ctaLabel: "Case study",
    category: "professional",
    placeholderClass: "bg-muted",
    image: "/images/portfolio/if-you-seek/image-11.webp",
    imageAlt: "If You Seek — Tourism New Zealand campaign hero",
    heroImage: "/images/portfolio/if-you-seek/image-11.webp",
    stats: [
      { label: "Role", value: "Head of Product" },
      { label: "Client", value: "Tourism NZ" },
      { label: "Year", value: "2022" },
    ],
    highlights: [
      {
        title: "Six digital experiences",
        caption:
          "Each experience paired a sensory film with a different smartphone interaction — microphone, camera, accelerometer — to make the seeker journey tactile.",
        placeholderClass: "bg-neutral-100",
        phones: [
          { src: "/images/portfolio/if-you-seek/image-4.webp", alt: "If You Seek — experience 1" },
          { src: "/images/portfolio/if-you-seek/image-5.webp", alt: "If You Seek — experience 2" },
          { src: "/images/portfolio/if-you-seek/image-6.webp", alt: "If You Seek — experience 3" },
          { src: "/images/portfolio/if-you-seek/image-7.webp", alt: "If You Seek — experience 4" },
          { src: "/images/portfolio/if-you-seek/image-8.webp", alt: "If You Seek — experience 5" },
          { src: "/images/portfolio/if-you-seek/image-9.webp", alt: "If You Seek — experience 6" },
        ],
      },
      {
        title: "Sensory storytelling",
        caption:
          "Each experience opened with a short sensory film, grounding the seeker in a place before handing the interaction over to the phone itself.",
        aspect: "2232/1012",
        placeholderClass: "bg-neutral-100",
        image: "/images/portfolio/if-you-seek/image-10.webp",
        imageAlt: "If You Seek — sensory film still",
      },
    ],
  },
];

export function getProjectBySlug(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}
