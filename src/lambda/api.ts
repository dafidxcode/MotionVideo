import type { RenderMediaOnLambdaOutput } from "@remotion/lambda/client";
import { z } from "zod";
import { CompositionProps } from "../../types/constants";
import {
  ProgressRequest,
  ProgressResponse,
  RenderRequest,
} from "../../types/schema";
import { ApiResponse } from "../helpers/api-response";

const makeRequest = async <Res>(
  endpoint: string,
  body: unknown,
): Promise<Res> => {
  const result = await fetch(endpoint, {
    method: "post",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
    },
  });
  const json = (await result.json()) as ApiResponse<Res>;
  if (json.type === "error") {
    throw new Error(json.message);
  }

  return json.data;
};

export const renderVideo = async ({
  inputProps,
  projectId,
}: {
  inputProps: z.infer<typeof CompositionProps>;
  projectId?: string;
}) => {
  const body: z.infer<typeof RenderRequest> = {
    inputProps,
    projectId,
  };

  return makeRequest<RenderMediaOnLambdaOutput>("/api/lambda/render", body);
};

export const getProgress = async ({
  id,
  bucketName,
  projectId,
}: {
  id: string;
  bucketName: string;
  projectId?: string;
}) => {
  const body: z.infer<typeof ProgressRequest> = {
    id,
    bucketName,
    projectId,
  };

  return makeRequest<ProgressResponse>("/api/lambda/progress", body);
};
