import React, { useEffect, useState } from "react";
import { AbsoluteFill, getInputProps } from "remotion";
import { compileCode } from "./compiler";

interface DynamicCompProps {
  code: string;
  [key: string]: unknown;
}

export const DynamicComp: React.FC = () => {
  const { code } = getInputProps() as DynamicCompProps;

  const initial = React.useMemo(() => {
    try {
      return compileCode(code);
    } catch (e) {
      return { Component: null, error: e instanceof Error ? e.message : "Unknown error" };
    }
  }, [code]);

  const [Component, setComponent] = useState<React.ComponentType | null>(
    () => initial.Component,
  );
  const [error, setError] = useState<string | null>(() => initial.error);

  useEffect(() => {
    if (initial.Component !== Component) {
      setComponent(() => initial.Component);
      setError(initial.error);
    }
  }, [initial]);

  if (error) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: "#1a1a2e",
          justifyContent: "center",
          alignItems: "center",
          padding: 60,
        }}
      >
        <div
          style={{
            color: "#ff6b6b",
            fontSize: 42,
            fontFamily: "system-ui, sans-serif",
            textAlign: "center",
            maxWidth: "80%",
          }}
        >
          Compilation Error
        </div>
        <div
          style={{
            color: "#fff",
            fontSize: 24,
            fontFamily: "monospace",
            marginTop: 24,
            textAlign: "center",
            maxWidth: "80%",
            wordBreak: "break-word",
          }}
        >
          {error}
        </div>
      </AbsoluteFill>
    );
  }

  if (!Component) {
    return null;
  }

  return <Component />;
};
