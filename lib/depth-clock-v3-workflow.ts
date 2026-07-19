export type ComfyWorkflow = Record<
  string,
  {
    class_type: string;
    inputs: Record<string, unknown>;
  }
>;

export const DEPTH_CLOCK_V3_OUTPUT_NODE_ID = "3";

export function createDepthClockV3Workflow(imageName: string): ComfyWorkflow {
  return {
    "1": {
      class_type: "LoadImage",
      inputs: {
        image: imageName,
      },
    },
    "2": {
      class_type: "DepthAnythingV2Preprocessor",
      inputs: {
        image: ["1", 0],
        ckpt_name: "depth_anything_v2_vitl.pth",
        resolution: 1024,
      },
    },
    "3": {
      class_type: "SaveImage",
      inputs: {
        images: ["2", 0],
        filename_prefix: "depth-clock",
      },
    },
  };
}
