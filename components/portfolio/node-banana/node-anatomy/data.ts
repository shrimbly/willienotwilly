import {
  GENERATE_IMAGE_INPUTS,
  GENERATE_IMAGE_OUTPUTS,
  IMAGE_INPUT_INPUTS,
  IMAGE_INPUT_OUTPUTS,
  NB_ASSETS,
  NODE_DEFAULT_W,
  PROMPT_INPUTS,
  PROMPT_OUTPUTS,
  type GenerateImageSettings,
  type GraphEdgeSpec,
  type GraphNodeSpec,
  type NodeImage,
} from "../kit";

// The Cars workflow from the Node Banana site: a photo of a 1973 MGB GT V8
// and the studio prompt an LLM filled in from it, into one Generate Image node
// whose results are the studio shots it made.

const CARS = "/images/portfolio/demos/cars";

/** Studio shots Node Banana generated from the photo, newest run first. */
export const RESULTS: ReadonlyArray<NodeImage> = [
  { src: `${CARS}/car-2.jpg`, width: 960, height: 642, alt: "Generated studio shot of a blue 1973 MGB GT V8 under an overhead softbox, front three-quarter view" },
  { src: `${CARS}/car-1.jpg`, width: 960, height: 642, alt: "Generated studio shot of the MGB GT V8 in profile, small under a long softbox" },
  { src: `${CARS}/car-4.jpg`, width: 960, height: 642, alt: "Generated studio shot of the MGB GT V8 from the rear three-quarter" },
  { src: `${CARS}/car-6.jpg`, width: 960, height: 642, alt: "Generated close-up of the MGB badge and V8 grille" },
  { src: `${CARS}/car-3.jpg`, width: 960, height: 642, alt: "Generated top-down shot of the MGB GT V8 on a dark studio floor" },
  { src: `${CARS}/car-5.jpg`, width: 960, height: 642, alt: "Generated close-up along the MGB's front wing and wheel" },
];

/** Three earlier runs are on the node to start with. */
export const START_HISTORY = [0, 1, 2];

export const START_SETTINGS: GenerateImageSettings = {
  model: "nano-banana-2.1",
  aspectRatio: "3:2",
  resolution: "2K",
  googleSearch: true,
  imageSearch: false,
};

/** The first three paragraphs of the prompt the site's LLM node filled in from the photo. */
export const PROMPT =
  "Analyze the input image and silently inventory all automotive-critical details: the specific vehicle make, model, and year (1973 MGB GT V8), custom modifications (factory-original chrome bumpers with overriders, period-correct multi-spoke alloy wheels with black centers and polished rims, and a custom '73MGV8' license plate), tire tread design, interior visibility through glass, engineering details, light direction, and reflection quality.\n\n" +
  "The setting is a pristine, high-budget automotive photography studio. A massive softbox downlight (large diffusion bank) hangs directly overhead, creating long, clean highlights on the vehicle. The background is a seamless, dark studio cyclorama. Outside the area with the car it is extremely dark, with the walls of the studio only faintly visible. Render the vehicle with hyper-realistic detail, capturing the precise texture of the materials, distinct mechanical components, and accurate light reflections.\n\n" +
  "The vehicle’s body color, wheel color, and all material colors must exactly match the input image, with no reinterpretation, correction, enhancement, or stylization.";

export const INPUT_PHOTO: NodeImage = { ...NB_ASSETS.cars.input, alt: "Photo of a blue 1973 MGB GT V8 parked on a lawn" };

export const GENERATE_ID = "generate";
export const GENERATE_W = NODE_DEFAULT_W.generateImage;

// World px. The node under study sits at the origin; its two inputs are set
// off to the left so only their right edges and the noodles reach the tile.
export const NODES: GraphNodeSpec[] = [
  { id: "photo", x: -360, y: -122, width: 260, inputs: IMAGE_INPUT_INPUTS, outputs: IMAGE_INPUT_OUTPUTS },
  { id: "prompt", x: -380, y: 140, width: 280, inputs: PROMPT_INPUTS, outputs: PROMPT_OUTPUTS },
  { id: GENERATE_ID, x: 0, y: 0, width: GENERATE_W, inputs: GENERATE_IMAGE_INPUTS, outputs: GENERATE_IMAGE_OUTPUTS },
];

export const EDGES: GraphEdgeSpec[] = [
  { id: "photo-image", from: "photo", fromHandle: "image", to: GENERATE_ID, toHandle: "image" },
  { id: "prompt-text", from: "prompt", fromHandle: "text", to: GENERATE_ID, toHandle: "text" },
];
