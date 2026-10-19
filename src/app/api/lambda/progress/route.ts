import {
  AwsRegion,
  getRenderProgress,
  speculateFunctionName,
} from "@remotion/lambda/client";
import { DISK, RAM, REGION, TIMEOUT } from "../../../../../config.mjs";
import { ProgressRequest, ProgressResponse } from "../../../../../types/schema";
import { executeApi } from "../../../../helpers/api-response";
import { requireActiveUser } from "../../../../lib/auth";

export const POST = executeApi<ProgressResponse, typeof ProgressRequest>(
  ProgressRequest,
  async (req, body) => {
    // BUG-03: render progress was readable (and downloadable) by anyone who
    // knew a bucketName + renderId. Require an active session.
    const guard = await requireActiveUser(req);
    if (!guard.ok || !guard.email) {
      throw new Error(
        guard.error || "Authentication required. Please sign in again.",
      );
    }
    const userEmail = guard.email;

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
      // BUG-23: Include an unguessable UUID token so rendered video URLs cannot be enumerated
      const randomToken = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      const { saveMediaToLocal } = await import("@/lib/localMediaStorage");
      const secureFileName = `render_${(body.projectId || body.id).replace(/[^a-zA-Z0-9_-]/g, "")}_${randomToken}.mp4`;
      const localUrl = await saveMediaToLocal(rawUrl, secureFileName);

      if (body.projectId) {
        // BUG-11: use updatePartialProject to update render metadata without
        // wiping out code and prompt with empty strings.
        const { updatePartialProject } = await import("@/lib/projects");
        await updatePartialProject(userEmail, body.projectId, {
          renderStatus: "completed",
          renderUrl: localUrl,
          renderSize: renderProgress.outputSizeInBytes as number,
        }).catch((err) => {
          console.warn("[Progress] Failed to update project render status:", err);
        });
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
