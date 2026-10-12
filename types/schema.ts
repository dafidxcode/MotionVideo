import { z } from "zod";
import { CompositionProps } from "./constants";

export const RenderRequest = z.object({
  inputProps: CompositionProps,
  projectId: z.string().optional(),
});

export const ProgressRequest = z.object({
  bucketName: z.string(),
  id: z.string(),
  projectId: z.string().optional(),
});

export type ProgressResponse =
  | {
      type: "error";
      message: string;
    }
  | {
      type: "progress";
      progress: number;
    }
  | {
      type: "done";
      url: string;
      size: number;
    };
