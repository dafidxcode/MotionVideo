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

import { requireActiveUser } from "../../../../lib/auth";
import {
  chargeUserCredits,
  refundUserCredits,
} from "../../../../lib/credits";
import { checkRateLimit } from "../../../../lib/rate-limit";

export const POST = executeApi<RenderMediaOnLambdaOutput, typeof RenderRequest>(
  RenderRequest,
  async (req, body) => {
    // ── Authentication & Account Status (BUG-03 / BUG-06) ──────────────────
    // Previously a missing/invalid session silently fell through as
    // "Guest User" and rendered for free.
    const guard = await requireActiveUser(req);
    if (!guard.ok || !guard.email) {
      throw new Error(
        guard.error || "Authentication required. Please sign in again.",
      );
    }
    const userEmail = guard.email;

    // Rate limiting (BUG-03): max 5 render requests per minute per user
    const rateLimit = checkRateLimit(`render:${userEmail}`, {
      windowMs: 60_000,
      maxRequests: 5,
    });
    if (!rateLimit.allowed) {
      throw new Error(
        "Too many render requests. Please wait a moment before starting another render.",
      );
    }

    // ── AWS Credential Check BEFORE charging (BUG-08) ─────────────────────
    // The render cost was deducted first, so a deployment without AWS keys
    // charged the user for a render that could never start.
    const hasAwsKey =
      Boolean(process.env.AWS_ACCESS_KEY_ID || process.env.REMOTION_AWS_ACCESS_KEY_ID);
    const hasAwsSecret =
      Boolean(process.env.AWS_SECRET_ACCESS_KEY || process.env.REMOTION_AWS_SECRET_ACCESS_KEY);

    if (!hasAwsKey || !hasAwsSecret) {
      throw new Error(
        "AWS credentials missing. Please set REMOTION_AWS_ACCESS_KEY_ID and REMOTION_AWS_SECRET_ACCESS_KEY in environment variables.",
      );
    }

    // ── Credit Deduction ───────────────────────────────────────────────────
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

    const chargedAmount = chargeResult.chargedAmount;

    const { logRuntime } = await import("@/lib/runtime-logger");
    const projId = body.projectId || "unspecified";

    logRuntime({
      action: "VIDEO RENDER (AWS LAMBDA)",
      status: "START",
      userEmail,
      projectId: projId,
      details: {
        composition: COMP_NAME,
        frames: body.inputProps?.durationInFrames || "default",
      },
    });

    try {
      const sanitizedUser = userEmail
        .split("@")[0]
        .replace(/[^a-zA-Z0-9_-]/g, "");
      const uniqueFileName = `swdbot-motion-${sanitizedUser}-${Date.now()}.mp4`;

      // Ensure any relative audio URLs are expanded to direct S3 pre-signed URLs (or HTTPS baseUrl) so Lambda Chrome loads them reliably
      const processedInputProps = { ...body.inputProps };
      if (processedInputProps.code) {
        const { prepareCodeForLambda } = await import("@/lib/audio-storage");
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://swdbot.tech";
        processedInputProps.code = await prepareCodeForLambda(
          processedInputProps.code,
          baseUrl,
        );
      }

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
        inputProps: processedInputProps,
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
        userEmail,
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
        userEmail,
        projectId: projId,
        error: renderError,
      });
      // BUG-08: the render never started, so refund the render credits.
      try {
        await refundUserCredits({
          email: userEmail,
          amount: chargedAmount,
          reason: "Refund: AWS Lambda render failed",
          metadata: { composition: COMP_NAME },
        });
      } catch (refundError) {
        console.error("[Render] Refund failed:", refundError);
      }
      throw renderError;
    }
  },
);
