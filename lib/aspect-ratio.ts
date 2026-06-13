import type { AspectRatio } from "../types";

const RUNWARE_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  "1:1":  { width: 1024, height: 1024 },
  "16:9": { width: 1536, height: 864  },
  "9:16": { width: 864,  height: 1536 },
};

export function toRunwareDimensions(ratio: AspectRatio) {
  return RUNWARE_DIMENSIONS[ratio];
}

export function toVertexAspectRatio(ratio: AspectRatio): string {
  return ratio;
}
