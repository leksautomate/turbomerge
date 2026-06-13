import { describe, it, expect } from "vitest";
import { toRunwareDimensions, toVertexAspectRatio } from "../../lib/aspect-ratio";

describe("toRunwareDimensions", () => {
  it("maps 1:1 to 1024x1024", () => {
    expect(toRunwareDimensions("1:1")).toEqual({ width: 1024, height: 1024 });
  });
  it("maps 16:9 to 1536x864", () => {
    expect(toRunwareDimensions("16:9")).toEqual({ width: 1536, height: 864 });
  });
  it("maps 9:16 to 864x1536", () => {
    expect(toRunwareDimensions("9:16")).toEqual({ width: 864, height: 1536 });
  });
});

describe("toVertexAspectRatio", () => {
  it("returns the ratio string as-is", () => {
    expect(toVertexAspectRatio("16:9")).toBe("16:9");
    expect(toVertexAspectRatio("9:16")).toBe("9:16");
    expect(toVertexAspectRatio("1:1")).toBe("1:1");
  });
});
