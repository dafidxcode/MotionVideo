"use client";

import { LandingPageInput } from "@/components/LandingPageInput";
import { PageLayout } from "@/components/PageLayout";
import type { ModelId } from "@/types/generation";
import type { NextPage } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";

const Home: NextPage = () => {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  const handleNavigate = (
    prompt: string,
    model: ModelId,
    attachedImages?: string[],
    options?: {
      language?: string;
      voiceModel?: string;
      voice?: string;
      autoCaption?: boolean;
      aspectRatio?: string;
      duration?: number;
      fps?: number;
    },
  ) => {
    setIsNavigating(true);

    const projectId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // Store generation payload in sessionStorage so URL remains clean without prompt text
    sessionStorage.setItem(
      "pending_generation",
      JSON.stringify({
        projectId,
        prompt,
        model,
        language: options?.language || "ms",
        voiceModel: options?.voiceModel || "auto",
        voice: options?.voice || "",
        autoCaption: options?.autoCaption ?? true,
        aspectRatio: options?.aspectRatio || "16:9",
        duration: options?.duration || 300,
        fps: options?.fps || 30,
        attachedImages: attachedImages && attachedImages.length > 0 ? attachedImages : undefined,
      }),
    );

    // Clean URL: /generate?projectId=proj_xxx (Never expose user prompt in URL)
    router.push(`/generate?projectId=${encodeURIComponent(projectId)}`);
  };

  return (
    <PageLayout>
      <LandingPageInput
        onNavigate={handleNavigate}
        isNavigating={isNavigating}
        showCodeExamplesLink
      />
    </PageLayout>
  );
};

export default Home;
