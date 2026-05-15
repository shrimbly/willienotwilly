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
  video?: string;
  heroVideo?: string;
  heroImage?: string;
  heroEmbed?: string;
  heroCredit?: ProjectCredit;
  category: ProjectCategory;
  stats: ProjectStat[];
  highlights: Highlight[];
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
    placeholderClass:
      "bg-[conic-gradient(from_140deg_at_60%_40%,oklch(0.82_0.14_55),oklch(0.62_0.14_39),oklch(0.40_0.10_30),oklch(0.82_0.14_55))]",
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
        placeholderClass:
          "bg-[radial-gradient(at_30%_30%,oklch(0.86_0.15_55),oklch(0.50_0.12_35)_70%,oklch(0.28_0.06_30))]",
        video: "/videos/portfolio/reflct-viewer.mp4",
      },
      {
        title: "Curated camera paths",
        caption:
          "Authors choreograph the hero shots so every visitor sees the scene at its best.",
        aspect: "16/9",
        placeholderClass:
          "bg-[conic-gradient(from_30deg_at_50%_50%,oklch(0.78_0.16_60),oklch(0.50_0.12_40),oklch(0.32_0.08_30),oklch(0.78_0.16_60))]",
        video: "/videos/portfolio/reflct-camera.mp4",
      },
      {
        title: "Shopify app",
        caption:
          "Drop a 3D scene onto any Shopify product page — merchants install once and embed splats next to their photography with no code.",
        aspect: "4/3",
        placeholderClass:
          "bg-[conic-gradient(from_200deg_at_50%_50%,oklch(0.88_0.13_55),oklch(0.62_0.14_38),oklch(0.34_0.08_30),oklch(0.88_0.13_55))]",
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
    placeholderClass:
      "bg-[conic-gradient(from_220deg_at_30%_70%,oklch(0.90_0.15_95),oklch(0.72_0.18_85),oklch(0.46_0.12_70),oklch(0.90_0.15_95))]",
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
        placeholderClass:
          "bg-[radial-gradient(at_70%_30%,oklch(0.92_0.16_95),oklch(0.66_0.18_85)_55%,oklch(0.34_0.08_70))]",
        video: "/videos/portfolio/nd-variables2.mp4",
      },
      {
        title: "Ease curve node",
        caption:
          "Bezier-controlled interpolation between any two values — drives parameter sweeps, batch renders, and motion-style outputs.",
        aspect: "1/1",
        placeholderClass:
          "bg-[radial-gradient(at_30%_70%,oklch(0.94_0.13_95),oklch(0.66_0.18_85)_55%,oklch(0.34_0.08_70))]",
        video: "/videos/portfolio/nd-ease.mp4",
      },
      {
        title: "Fallback models",
        caption:
          "When a provider rate-limits or errors, the graph quietly retries against a secondary model without dropping the run.",
        aspect: "16/9",
        placeholderClass:
          "bg-[linear-gradient(150deg,oklch(0.92_0.14_95),oklch(0.70_0.18_85),oklch(0.40_0.10_70))]",
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
    placeholderClass:
      "bg-[conic-gradient(from_60deg_at_40%_60%,oklch(0.74_0.16_230),oklch(0.50_0.14_245),oklch(0.30_0.08_250),oklch(0.74_0.16_230))]",
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
        placeholderClass:
          "bg-[radial-gradient(at_50%_40%,oklch(0.78_0.16_230),oklch(0.46_0.14_245)_60%,oklch(0.26_0.08_250))]",
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
    placeholderClass:
      "bg-[conic-gradient(from_300deg_at_50%_50%,oklch(0.82_0.16_160),oklch(0.60_0.16_170),oklch(0.32_0.08_180),oklch(0.82_0.16_160))]",
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
        placeholderClass:
          "bg-[radial-gradient(at_40%_30%,oklch(0.86_0.16_160),oklch(0.54_0.16_170)_60%,oklch(0.28_0.08_180))]",
      },
      {
        title: "Audio mixing",
        caption:
          "Crossfade and mix tracks directly in the timeline, all without leaving the browser.",
        aspect: "4/3",
        placeholderClass:
          "bg-[conic-gradient(from_200deg_at_50%_50%,oklch(0.82_0.16_160),oklch(0.54_0.16_170),oklch(0.30_0.08_180),oklch(0.82_0.16_160))]",
      },
      {
        title: "Client-side render",
        caption:
          "Media bunny does the heavy lifting locally — nothing leaves your machine.",
        aspect: "16/10",
        placeholderClass:
          "bg-[linear-gradient(135deg,oklch(0.84_0.16_160),oklch(0.58_0.16_170),oklch(0.30_0.08_180))]",
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
    placeholderClass:
      "bg-[conic-gradient(from_140deg_at_50%_50%,oklch(0.78_0.18_295),oklch(0.50_0.20_280),oklch(0.30_0.10_270),oklch(0.78_0.18_295))]",
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
        placeholderClass:
          "bg-[radial-gradient(at_30%_30%,oklch(0.82_0.18_295),oklch(0.50_0.20_280)_60%,oklch(0.28_0.10_270))]",
        image: "/images/contact-sheet/contact-sheet.jpg",
        imageAlt: "Generated contact sheet — multi-frame story from a single prompt",
      },
      {
        title: "Kinetic type animation",
        caption:
          "The same technique adapts beyond character work. Here the contact sheet drives a kinetic type sequence, with each frame setting up the next pose for the animator.",
        aspect: "16/9",
        placeholderClass:
          "bg-[conic-gradient(from_240deg_at_60%_50%,oklch(0.80_0.18_295),oklch(0.50_0.20_280),oklch(0.30_0.10_270),oklch(0.80_0.18_295))]",
        video: "/videos/portfolio/contact-kinetic-type.mp4",
      },
      {
        title: "Industry adoption",
        caption:
          "Glif, Weavy, Leonardo AI, ComfyUI, and others have built the technique into their products and workflows since the original write-up went live.",
        aspect: "1514/897",
        placeholderClass:
          "bg-[linear-gradient(135deg,oklch(0.84_0.18_295),oklch(0.54_0.20_280),oklch(0.30_0.10_270))]",
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
    placeholderClass:
      "bg-[conic-gradient(from_180deg_at_50%_50%,oklch(0.82_0.18_330),oklch(0.58_0.20_320),oklch(0.34_0.10_310),oklch(0.82_0.18_330))]",
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
        placeholderClass:
          "bg-[radial-gradient(at_30%_30%,oklch(0.86_0.18_330),oklch(0.54_0.20_320)_60%,oklch(0.30_0.10_310))]",
        video: "/videos/portfolio/flipper-demo.mp4",
      },
    ],
  },
  {
    slug: "try-galaxy",
    title: "Try Galaxy",
    blurb:
      "Web experience that lets iPhone and Android owners try Samsung's One UI on their own device — interactive demos of Galaxy AI, camera, and design.",
    description:
      "Samsung's Try Galaxy turns any phone into a Galaxy. Users swipe through One UI directly in their mobile browser, exploring Galaxy AI features, camera tools, themes, and the wider ecosystem — without buying the hardware. Designed to reach iPhone owners in the moment of curiosity. Reached 144 million users.",
    meta: "Samsung · 144M users",
    year: "2024",
    href: "https://www.trygalaxy.com",
    external: true,
    category: "professional",
    placeholderClass:
      "bg-[conic-gradient(from_200deg_at_50%_50%,oklch(0.78_0.13_240),oklch(0.50_0.16_255),oklch(0.30_0.10_265),oklch(0.78_0.13_240))]",
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
        placeholderClass:
          "bg-[radial-gradient(at_40%_30%,oklch(0.82_0.13_240),oklch(0.50_0.16_255)_60%,oklch(0.28_0.10_265))]",
        image: "/images/portfolio/try-galaxy-1.png",
        imageAlt:
          "Four phones showing the Try Galaxy home screen, design picker, camera, and AI photo editor",
      },
      {
        title: "Feature walkthroughs",
        caption:
          "Step-by-step demos of Object Eraser, Photo Remaster, SmartThings, Mindfulness, and the wider Galaxy AI ecosystem.",
        aspect: "16/9",
        placeholderClass:
          "bg-[conic-gradient(from_60deg_at_40%_60%,oklch(0.80_0.13_240),oklch(0.50_0.16_255),oklch(0.30_0.10_265),oklch(0.80_0.13_240))]",
        image: "/images/portfolio/try-galaxy-2.webp",
        imageAlt:
          "Row of phones demonstrating Object Eraser, Photo Remaster, and Mindfulness in One UI",
      },
    ],
  },
  {
    slug: "if-you-seek",
    title: "If You Seek",
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
    placeholderClass:
      "bg-[conic-gradient(from_180deg_at_50%_50%,oklch(0.74_0.12_150),oklch(0.50_0.14_165),oklch(0.30_0.08_175),oklch(0.74_0.12_150))]",
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
