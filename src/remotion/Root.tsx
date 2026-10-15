import React from "react";
import { Composition } from "remotion";
import { DynamicComp } from "./DynamicComp";

const defaultCode = `import { AbsoluteFill } from "remotion";
export const MyAnimation = () => <AbsoluteFill style={{ backgroundColor: "#000" }} />;`;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DynamicComp"
        component={DynamicComp}
        durationInFrames={180}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ code: defaultCode }}
        calculateMetadata={({ props }) => {
          const p = props as Record<string, unknown>;
          return {
            durationInFrames: (p.durationInFrames as number) || 180,
            fps: (p.fps as number) || 30,
            width: (p.width as number) || 1920,
            height: (p.height as number) || 1080,
          };
        }}
      />
    </>
  );
};
