"use client";

import { cn } from "@/lib/utils";
import { Code, Play } from "lucide-react";
import { useState } from "react";

export type TabId = "code" | "preview";

interface TabPanelProps {
  codeContent: React.ReactNode;
  previewContent: React.ReactNode;
  defaultTab?: TabId;
  activeTab?: TabId;
  onTabChange?: (tab: TabId) => void;
  hideHeaderOnMobile?: boolean;
}

export function TabPanel({
  codeContent,
  previewContent,
  defaultTab = "preview",
  activeTab: controlledActiveTab,
  onTabChange,
  hideHeaderOnMobile = false,
}: TabPanelProps) {
  const [internalTab, setInternalTab] = useState<TabId>(defaultTab);
  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalTab;

  const handleTabChange = (tabId: TabId) => {
    if (controlledActiveTab === undefined) {
      setInternalTab(tabId);
    }
    onTabChange?.(tabId);
  };

  const tabs = [
    { id: "code" as const, label: "Remotion Code", icon: Code },
    { id: "preview" as const, label: "Video Preview", icon: Play },
  ];

  return (
    <div className="flex flex-col h-full min-w-0">
      <div
        className={cn(
          "w-fit mb-3 sm:mb-4 shrink-0 rounded-xl overflow-hidden border border-[#28282C] bg-[#18181B] p-1 flex items-center gap-1 shadow-sm",
          hideHeaderOnMobile ? "hidden min-[1000px]:inline-flex" : "inline-flex",
        )}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              "flex items-center gap-2 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer rounded-lg",
              activeTab === tab.id
                ? "bg-[#1F1F23] text-[#F5F5F7] shadow-sm border border-[#28282C]"
                : "bg-transparent text-[#9A9AA2] hover:text-[#F5F5F7] hover:bg-[#1F1F23]/60",
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        {activeTab === "code" ? codeContent : previewContent}
      </div>
    </div>
  );
}
