// Comfy Commerce's run setup, as data: the settings each built-in workflow
// asks for in the RunSheet's Details step (server/src/workflows/builtin-graphs.ts,
// verbatim, prompts and all), the three engines the Engine step offers
// (server/src/providers/index.ts, comfyCloud.ts, comfyHttp.ts), and the
// sampling rules (web/src/features/activity/RunSheet.tsx,
// server/src/services/runService.ts pickSample).

/** Above this many images the sheet nudges toward a sample run first (RunSheet SAMPLE_NUDGE_THRESHOLD). */
export const SAMPLE_NUDGE_THRESHOLD = 12;
/** The sample's size (RunSheet SAMPLE_SIZE). */
export const SAMPLE_SIZE = 5;
/** Products per Browse page (BrowsePage PAGE_SIZE). */
export const BROWSE_PAGE_SIZE = 12;

/** Where a published result goes (RunSheet STAGE_LABELS), in the order the Details step lists them. */
export const STAGE_ACTIONS = [
  { value: "add-new", label: "Add as new media" },
  { value: "replace-position", label: "Replace in place" },
  { value: "add-featured", label: "Add as featured" },
] as const;
export type StageAction = (typeof STAGE_ACTIONS)[number]["value"];
export const STAGE_LABELS: Record<StageAction, string> = {
  "add-new": "Add as new media",
  "replace-position": "Replace in place",
  "add-featured": "Add as featured",
};

/* ------------------------------------------------------------- engines */

export type EngineId = "comfy-local" | "comfy-remote" | "comfy-cloud";

export interface Engine {
  id: EngineId;
  name: string;
  description: string;
  /** Whether the broker could reach it (ProviderInfo.available). */
  available: boolean;
  /**
   * The availability probe's line, shown in place of the description when set
   * (ProviderInfo.detail): a ComfyUI reports its URL, an unconfigured one says
   * what to set. Comfy Cloud reports none, so its description shows.
   */
  detail: string | null;
}

/**
 * The engines as a fresh install with a local ComfyUI running and a Comfy
 * Cloud key saved would list them (the mock engine is never offered). The
 * local URL is the broker's default COMFY_LOCAL_URL; no remote URL is set.
 */
export const ENGINES: Engine[] = [
  {
    id: "comfy-local",
    name: "Local ComfyUI",
    description: "Runs edits on your own ComfyUI instance. Images never leave your machine.",
    available: true,
    detail: "http://127.0.0.1:8188",
  },
  {
    id: "comfy-remote",
    name: "Remote ComfyUI",
    description: "Runs edits on a ComfyUI instance on another machine on your network.",
    available: false,
    detail: "Set a Remote ComfyUI URL in Connectors",
  },
  {
    id: "comfy-cloud",
    name: "Comfy Cloud",
    description: "Runs edits on Comfy Cloud — no local GPU required.",
    available: true,
    detail: null,
  },
];

/** The Activity row's engine names (ActivityPage PROVIDER_LABELS). */
export const ENGINE_LABELS: Record<EngineId, string> = {
  "comfy-local": "Local ComfyUI",
  "comfy-remote": "Remote ComfyUI",
  "comfy-cloud": "Comfy Cloud",
};

/* ------------------------------------------------------ workflow settings */

export type WorkflowParam =
  | { id: string; label: string; type: "text"; defaultValue?: string; placeholder?: string }
  | { id: string; label: string; type: "number"; defaultValue?: string; placeholder?: string }
  | { id: string; label: string; type: "select"; defaultValue?: string; options: string[] };

/**
 * Each built-in's editable inputs, as the bake exposed them (the labels keep
 * the bake's "Node · input" form where it named them that way). Text params
 * are prompt fields, select params chips, number params a short input.
 */
export const WORKFLOW_PARAMS: Record<string, WorkflowParam[]> = {
  "builtin:fit-to-768px": [{ id: "width", label: "Target width (px)", type: "number", defaultValue: "1024" }],
  "builtin:nano-banana-2-generic": [
    {
      id: "prompt-24",
      label: "GeminiNanoBanana2V2 · prompt",
      type: "text",
      defaultValue:
        "Edit the image: change the man's white tank top and light pink corduroy pants to an unbuttoned cream-colored linen button-down shirt and white linen shorts; change his hairstyle to wavy medium-length hair; add round tortoiseshell sunglasses on his nose; change the dog's plain collar to a blue and white striped sailor collar and add a small straw sun hat on the dog; change the background to a sunny beach with warm golden sand and the ocean in the distance; keep the man's kneeling pose, the dog's sitting posture, and their interaction identical to the original image.\n",
    },
  ],
  "builtin:amazon-spec-product-image": [],
  "builtin:subtle-grade": [],
  "builtin:relighting": [
    {
      id: "choice-201",
      label: "Lighting Style",
      type: "select",
      defaultValue: "Soft Studio",
      options: [
        "Soft Studio",
        "Clamshell Beauty",
        "Soft Daylight",
        "Rembrandt",
        "Warm/Cool",
        "Golden Hour",
        "Editorial Side",
        "Low-Key",
      ],
    },
  ],
  "builtin:t-shirt-shoot-x3": [
    {
      id: "text-35",
      label: "Model standing by window",
      type: "text",
      defaultValue:
        "Editorial menswear photograph, shot on a Pentax 67 medium-format camera with a 105mm f/2.4 lens, Kodak Portra 400 film, visible fine grain, subtle halation on the window highlights, shallow depth of field with a gently soft background.\nA male model photographed from the front, framed from the top of his head to at least mid-thigh so the entire shirt is fully visible in frame, body angled slightly off-axis, head turned a touch away as if caught mid-glance rather than staring down the lens. He's lean but not gym-sculpted, slightly narrow-shouldered, with an interesting, offbeat look — a long neck, a sharp angular jaw, slightly protruding ears, a high hairline with dark messy curls, thick uneven brows, deep-set eyes, a slightly crooked nose, and a faint constellation of moles along his jaw and collarbone. Pale-to-olive skin rendered with real texture: visible pores, fine stubble shadow along the jaw, faint under-eye darkness, slight redness at the nose and ears, a few freckles, peach fuzz on the cheeks catching the light. Not airbrushed. Imperfect, human.\nSome relaxed, candid pose of his choosing — natural and unforced, caught between movements rather than holding a pose, arms clear enough of the torso that the full front graphic stays readable. Loose, easy, a little off-balance. The whole upper body and shirt remain in frame, not cropped into a portrait.\nHe wears the provided shirt, reproduced exactly as in the input — preserve its color, fabric, fit, and front graphic precisely (the artwork, colors, lettering, layout, and proportions on the front must match the source unchanged). Render it as real cotton: matte, slightly worn fabric texture, natural wrinkles and drape across the chest and torso, no plastic sheen or glossy print; the graphic sits flat and slightly absorbed into the fabric weave, distorting subtly where the cloth folds and catches across the chest.\nLighting: late-afternoon golden-hour daylight pouring through a large window from the right, warm and directional, raking across his face and chest to reveal skin and fabric texture, carving soft shadow under the brow and jaw. Gentle falloff into cool shadow on the left side of his body. Warm ambient bounce from a mid-century interior — wood credenza, Eames-style lounge chair, terrazzo floor, a city skyline going blue in the dusk beyond the glass.\nMuted, slightly desaturated color palette, warm midtones, soft contrast, natural film color science. Grain present throughout, especially in the shadows. 35mm/120 analog imperfection — not digital sharpness. Realistic, editorial, quietly stylish.\nFull-bleed image filling the entire frame edge to edge, no border, no white margin, no frame, no matte, not a photo print or Polaroid",
    },
    {
      id: "value-34",
      label: "Detail macro shot",
      type: "text",
      defaultValue:
        "Tight close-up detail photograph of the printed graphic on the shirt, shot on a Canon EOS R5 with an 85mm f/1.8 lens, Kodak Portra 400 film emulation, visible fine grain, shallow depth of field with soft focus falloff toward the frame edges.\nUse the two provided images as references: from the first (original) image, reproduce the shirt's print exactly — its artwork, colors, lettering, layout, and proportions must match the source unchanged. From the second (generated lifestyle) image, match the lighting direction, color temperature, shirt color, and fabric character so this close-up reads as the same garment in the same scene.\nCamera positioned close but pulled back enough to capture a recognizable portion of the design — a readable section of the artwork and lettering — along with a little surrounding bare fabric. Angled from slightly above, looking down at the cloth at roughly 30–40 degrees, so the fabric recedes gently into soft focus toward the top of the frame.\nRender the material with detail but in context: the cotton weave visible across the surface without dominating the frame, fine surface fuzz and a few stray fibers catching the light, natural wrinkles and a gentle fold running through the composition. The print sits flat and slightly absorbed into the weave — matte, faintly textured at the edges where ink meets thread, following the contour of the cloth rather than floating on top.\nLighting: warm, directional golden-hour light raking low across the surface from one side, grazing the cloth to bring out texture and throw soft shadows along the folds, with gentle falloff into shadow. Subtle, natural color, muted and slightly desaturated, warm midtones, soft contrast, film color science.\nVisible grain throughout, especially in the shadows. Analog imperfection, not clinical digital sharpness. Tactile, editorial, quietly premium.",
    },
    {
      id: "value-31",
      label: "Model seated",
      type: "text",
      defaultValue:
        "\n\nEditorial lifestyle photograph of the shirt worn by a model, shot on a Pentax 67 medium-format camera with a 105mm f/2.4 lens, Kodak Portra 400 film, visible fine grain, subtle halation on the window highlights, shallow depth of field with a gently soft background.\nUse the provided images as reference: reproduce the shirt's color, fabric, fit, and graphic exactly as in the source — the artwork, colors, lettering, layout, and proportions must match unchanged.\nThe same male model from the shoot, sitting back into the Eames-style lounge chair in the same mid-century interior — wood credenza, terrazzo floor, a city skyline going blue in the dusk beyond a large window. Lean but not gym-sculpted, slightly narrow-shouldered, with an interesting, offbeat look — long neck, sharp angular jaw, slightly protruding ears, high hairline with dark messy curls, thick uneven brows, a slightly crooked nose. Pale-to-olive skin with real texture: visible pores, faint stubble shadow along the jaw, slight redness at the ears, a few freckles, peach fuzz catching the light. Not airbrushed. Imperfect, human.\nRelaxed and casual: sunk comfortably into the chair, one ankle resting over the opposite knee, one arm draped along the armrest, the other hand loosely in his lap or holding a coffee mug, torso open to the camera so the front graphic stays readable across his chest. Head turned slightly toward the window, a calm, unguarded expression, caught mid-moment rather than posing — as if half-listening to someone off-frame. Natural slouch, shoulders soft and asymmetric.\nRender the shirt as real cotton: matte, slightly worn fabric texture, natural soft wrinkles gathering at the waist and where he bends, the weave faintly visible, the graphic sitting flat and slightly absorbed into the cloth, distorting subtly across the folds and the relaxed drape of the seated pose.\nLighting: late-afternoon golden-hour daylight from the large window to the right, warm and directional, raking across his face and chest to reveal skin and fabric texture, carving soft shadow under the brow and jaw, with gentle falloff into cool shadow on the left side of his body. Warm ambient bounce from the interior.\nMuted, slightly desaturated color palette, warm midtones, soft contrast, natural film color science. Grain present throughout, especially in the shadows. 35mm/120 analog imperfection — not digital sharpness. Realistic, editorial, quietly stylish.\nFull-bleed image filling the entire frame edge to edge, no border, no white margin, no frame, no matte, not a photo print or Polaroid",
    },
  ],
  "builtin:change-aspect-ratio": [
    {
      id: "aspect-ratio-224-191",
      label: "FluxResolutionNode (#224:191) · aspect_ratio",
      type: "select",
      defaultValue: "19:9 (Cinematic Ultrawide)",
      options: [
        "1:1 (Perfect Square)",
        "2:3 (Classic Portrait)",
        "3:4 (Golden Ratio)",
        "3:5 (Elegant Vertical)",
        "4:5 (Artistic Frame)",
        "5:7 (Balanced Portrait)",
        "5:8 (Tall Portrait)",
        "7:9 (Modern Portrait)",
        "9:16 (Slim Vertical)",
        "9:19 (Tall Slim)",
        "9:21 (Ultra Tall)",
        "9:32 (Skyline)",
        "3:2 (Golden Landscape)",
        "4:3 (Classic Landscape)",
        "5:3 (Wide Horizon)",
        "5:4 (Balanced Frame)",
        "7:5 (Elegant Landscape)",
        "8:5 (Cinematic View)",
        "9:7 (Artful Horizon)",
        "16:9 (Panorama)",
        "19:9 (Cinematic Ultrawide)",
        "21:9 (Epic Ultrawide)",
        "32:9 (Extreme Ultrawide)",
      ],
    },
  ],
  "builtin:tripo-p1-image-to-3d": [
    {
      id: "output-mode-texture-quality-4",
      label: "TripoP1ImageToModelNode · output_mode.texture_quality",
      type: "select",
      defaultValue: "detailed",
      options: ["standard", "detailed"],
    },
  ],
  "builtin:gpt-image-2-generic": [
    {
      id: "prompt-275",
      label: "Prompt",
      type: "text",
      defaultValue:
        "Edit the image into a clean, professional product photo: place the item on a minimal studio backdrop with soft, even lighting and a natural contact shadow. Preserve the product exactly as in the original — its shape, colours, materials, and any logos or text.",
    },
  ],
};

/** How many results one input stages for review: T-Shirt Shoot: x3 makes three shots of every image. */
export const OUTPUTS_PER_INPUT: Record<string, number> = {
  "builtin:t-shirt-shoot-x3": 3,
};
