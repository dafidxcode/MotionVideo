import {
  AwsRegion,
  getRenderProgress,
  speculateFunctionName,
} from "@remotion/lambda/client";
import { DISK, RAM, REGION, TIMEOUT } from "../../../../../config.mjs";
import { ProgressRequest, ProgressResponse } from "../../../../../types/schema";
import { executeApi } from "../../../../helpers/api-response";

export const POST = executeApi<ProgressResponse, typeof ProgressRequest>(
  ProgressRequest,
  async (req, body) => {
    const renderProgress = await getRenderProgress({
      bucketName: body.bucketName,
      functionName: speculateFunctionName({
        diskSizeInMb: DISK,
        memorySizeInMb: RAM,
        timeoutInSeconds: TIMEOUT,
      }),
      region: REGION as AwsRegion,
      renderId: body.id,
    });

    if (renderProgress.fatalErrorEncountered) {
      return {
        type: "error",
        message: renderProgress.errors[0].message,
      };
    }

    if (renderProgress.done) {
      const rawUrl = renderProgress.outputFile as string;
      const { saveMediaToLocal } = await import("@/lib/localMediaStorage");
      const localUrl = await saveMediaToLocal(
        rawUrl,
        `render_${body.projectId || body.id}.mp4`
      );

      const cookieHeader = req.headers.get("cookie") || "";
      let token = "";
      const match = cookieHeader.match(/swdbot_session=([^;]+)/);
      if (match) token = match[1];
      if (token && body.projectId) {
        const { verifySessionToken } = await import("@/lib/auth");
        const verified = verifySessionToken(token);
        if (verified.valid && verified.email) {
          const { saveUserProject } = await import("@/lib/projects");
          saveUserProject({
            id: body.projectId,
            userEmail: verified.email,
            code: "",
            prompt: "",
            renderStatus: "completed",
            renderUrl: localUrl,
            renderSize: renderProgress.outputSizeInBytes as number,
          }).catch(() => {});
        }
      }

      return {
        type: "done",
        url: localUrl,
        size: renderProgress.outputSizeInBytes as number,
      };
    }

    return {
      type: "progress",
      progress: Math.max(0.03, renderProgress.overallProgress),
    };
  },
);
