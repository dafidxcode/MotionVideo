import { z } from "zod";

export const COMP_NAME = "DynamicComp";

export const CompositionProps = z.object({
  code: z.string(),
  durationInFrames: z.number(),
  fps: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
});
