import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { CompositionProps } from "../../types/constants";
import { getProgress, renderVideo } from "../lambda/api";

export type State =
  | {
      status: "init";
    }
  | {
      status: "invoking";
    }
  | {
      renderId: string;
      bucketName: string;
      progress: number;
      status: "rendering";
    }
  | {
      renderId: string | null;
      status: "error";
      error: Error;
    }
  | {
      url: string;
      size: number;
      status: "done";
    };

const wait = async (milliSeconds: number) => {
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, milliSeconds);
  });
};

export const useRendering = (
  inputProps: z.infer<typeof CompositionProps>,
  projectId?: string,
) => {
  const [state, setState] = useState<State>({
    status: "init",
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // BUG-33: Abort ongoing poll loop on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const undo = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState({ status: "init" });
  }, []);

  const renderMedia = useCallback(async () => {
    // BUG-33: Clean previous polling loop before starting a new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setState({
      status: "invoking",
    });

    try {
      const { renderId, bucketName } = await renderVideo({ inputProps, projectId });
      if (controller.signal.aborted) return;

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("swdbot-refresh-user"));
      }

      setState({
        status: "rendering",
        progress: 0,
        renderId: renderId,
        bucketName: bucketName,
      });

      let pending = true;

      while (pending && !controller.signal.aborted) {
        // Pause polling when the document is hidden/backgrounded
        while (
          typeof document !== "undefined" &&
          document.visibilityState === "hidden" &&
          !controller.signal.aborted
        ) {
          await wait(1000);
        }

        if (controller.signal.aborted) break;

        const result = await getProgress({
          id: renderId,
          bucketName: bucketName,
          projectId,
        });

        if (controller.signal.aborted) break;

        switch (result.type) {
          case "error": {
            setState({
              status: "error",
              renderId: renderId,
              error: new Error(result.message),
            });
            pending = false;
            break;
          }
          case "done": {
            setState({
              size: result.size,
              url: result.url,
              status: "done",
            });
            pending = false;
            break;
          }
          case "progress": {
            setState({
              status: "rendering",
              bucketName: bucketName,
              progress: result.progress,
              renderId: renderId,
            });
            await wait(1000);
          }
        }
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setState({
          status: "error",
          error: err as Error,
          renderId: null,
        });
      }
    }
  }, [inputProps, projectId]);

  return useMemo(() => {
    return {
      renderMedia,
      state,
      undo,
    };
  }, [renderMedia, state, undo]);
};
