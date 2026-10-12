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

    if (
      !process.env.AWS_ACCESS_KEY_ID &&
      !process.env.REMOTION_AWS_ACCESS_KEY_ID
    ) {
      throw new TypeError(
        "Set up Remotion Lambda to render videos. See the README.md for how to do so.",
      );
    }
    if (
      !process.env.AWS_SECRET_ACCESS_KEY &&
      !process.env.REMOTION_AWS_SECRET_ACCESS_KEY
    ) {
      throw new TypeError(
        "The environment variable REMOTION_AWS_SECRET_ACCESS_KEY is missing. Add it to your .env file.",
      );
    }

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

    return result;
  },
);
