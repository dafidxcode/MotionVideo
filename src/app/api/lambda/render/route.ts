import {
  AwsRegion,
  renderMediaOnLambda,
  RenderMediaOnLambdaOutput,
  speculateFunctionName,
} from "@remotion/lambda/client";
import {
  DISK,
  RAM,
  REGION,
  SITE_NAME,
  TIMEOUT,
} from "../../../../../config.mjs";
import { COMP_NAME } from "../../../../../types/constants";
import { RenderRequest } from "../../../../../types/schema";
import { executeApi } from "../../../../helpers/api-response";

import { verifySessionToken } from "../../../../lib/auth";
import { chargeUserCredits } from "../../../../lib/credits";

export const POST = executeApi<RenderMediaOnLambdaOutput, typeof RenderRequest>(
  RenderRequest,
  async (req, body) => {
    // ── Authentication & Credit Deduction ───────────────────────────────────
    const cookieHeader = req.headers.get("cookie") || "";
    const authHeader = req.headers.get("authorization");
    let token = "";
    if (cookieHeader) {
      const match = cookieHeader.match(/swdbot_session=([^;]+)/);
      if (match) token = match[1];
    }
    if (!token && authHeader?.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }

    let userEmail: string | undefined;
    if (token) {
      const verified = verifySessionToken(token);
      if (verified.valid && verified.email) {
        userEmail = verified.email;
      }
    }

    if (userEmail) {
      const chargeResult = await chargeUserCredits({
        email: userEmail,
        action: "aws_render",
        description: "Video Rendering",
        metadata: { composition: COMP_NAME },
      });

      if (!chargeResult.success) {
        throw new Error(
          chargeResult.error ||
          "Insufficient credits! Rendering video failed.",
        );
      }
    }

    const hasAwsKey =
      Boolean(process.env.AWS_ACCESS_KEY_ID || process.env.REMOTION_AWS_ACCESS_KEY_ID);
    const hasAwsSecret =
      Boolean(process.env.AWS_SECRET_ACCESS_KEY || process.env.REMOTION_AWS_SECRET_ACCESS_KEY);

    if (!hasAwsKey || !hasAwsSecret) {
      throw new Error(
        "AWS credentials missing. Please set REMOTION_AWS_ACCESS_KEY_ID and REMOTION_AWS_SECRET_ACCESS_KEY in environment variables.",
      );
    }

    const { logRuntime } = await import("@/lib/runtime-logger");
    const projId = body.projectId || "unspecified";

    logRuntime({
      action: "VIDEO RENDER (AWS LAMBDA)",
      status: "START",
      userEmail: userEmail || "Guest User",
      projectId: projId,
      details: {
        composition: COMP_NAME,
        frames: body.inputProps?.durationInFrames || "default",
      },
    });

    try {
      const sanitizedUser = (userEmail || "user")
        .split("@")[0]
        .replace(/[^a-zA-Z0-9_-]/g, "");
      const uniqueFileName = `swdbot-motion-${sanitizedUser}-${Date.now()}.mp4`;

      const result = await renderMediaOnLambda({
        codec: "h264",
        functionName: speculateFunctionName({
          diskSizeInMb: DISK,
          memorySizeInMb: RAM,
          timeoutInSeconds: TIMEOUT,
        }),
        region: REGION as AwsRegion,
        serveUrl: SITE_NAME,
        composition: COMP_NAME,
        inputProps: body.inputProps,
        framesPerLambda: 60,
        downloadBehavior: {
          type: "download",
          fileName: uniqueFileName,
        },
      });

      if (userEmail && body.projectId) {
        const { saveUserProject } = await import("@/lib/projects");
        saveUserProject({
          id: body.projectId,
          userEmail,
          code: body.inputProps.code,
          prompt: "Motion Graphics Video",
          renderStatus: "rendering",
          renderId: result.renderId,
          renderBucket: result.bucketName,
        }).catch(() => {});
      }

      logRuntime({
        action: "VIDEO RENDER (AWS LAMBDA)",
        status: "SUCCESS",
        userEmail: userEmail || "Guest User",
        projectId: projId,
        details: {
          renderId: result.renderId,
          bucket: result.bucketName,
          fileName: uniqueFileName,
        },
      });

      return result;
    } catch (renderError: any) {
      logRuntime({
        action: "VIDEO RENDER (AWS LAMBDA)",
        status: "FAILED",
        userEmail: userEmail || "Guest User",
        projectId: projId,
        error: renderError,
      });
      throw renderError;
    }
  },
);
