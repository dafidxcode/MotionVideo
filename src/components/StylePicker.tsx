"use client";

/* eslint-disable @next/next/no-img-element */
import React from "react";
import { BANG_MOTION_STYLES, BangMotionStyle } from "@/data/bangMotionStyles";
import { Check, GripVertical } from "lucide-react";

interface StylePickerProps {
  selectedStyleId?: string | null;
  onSelectStyle: (style: BangMotionStyle) => void;
}

export const StylePicker: React.FC<StylePickerProps> = ({
  selectedStyleId,
  onSelectStyle,
}) => {
  return (
    <div className="flex flex-col h-full overflow-hidden pt-1">
      {/* Desktop Gallery Header */}
      <div className="hidden lg:flex items-center justify-between pb-2 mb-2 border-b border-[#28282C] shrink-0">
        <span className="text-xs font-semibold text-[#9A9AA2] flex items-center gap-1.5">
          Visual Motion Style
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#1F1F23] border border-[#28282C] text-[#E0E0E6]">
            {BANG_MOTION_STYLES.length}
          </span>
        </span>
        <span className="text-[11px] text-[#6E6E76]">
          Click or drag & drop to apply
        </span>
      </div>

      {/* Grid of Styles - Clean sleek scrollbar with generous bottom padding so cards are never cut off */}
      <div className="flex-1 overflow-y-auto pr-1.5 pb-28 space-y-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#2E2E34] hover:[&::-webkit-scrollbar-thumb]:bg-[#404048] [&::-webkit-scrollbar-thumb]:rounded-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {BANG_MOTION_STYLES.map((style) => {
            const isSelected = selectedStyleId === style.id;
            return (
              <div
                key={style.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/x-motion-style", style.id);
                  e.dataTransfer.setData("text/plain", style.id);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => onSelectStyle(style)}
                className={`group relative text-left rounded-xl overflow-hidden border transition-all duration-200 flex flex-col cursor-grab active:cursor-grabbing select-none ${isSelected
                  ? "border-amber-400 ring-2 ring-amber-400/30 scale-[1.01] shadow-lg shadow-amber-400/10 bg-[#18181B]"
                  : "border-[#28282C] hover:border-[#38383E] hover:bg-[#1F1F23] bg-[#18181B]"
                  }`}
              >
                {/* Thumbnail Image */}
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#0A0A0B]">
                  <img
                    src={style.image}
                    alt={style.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 pointer-events-none"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                  {/* Category Pill */}
                  <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#0A0A0B]/80 backdrop-blur-md text-[#F5F5F7] border border-[#28282C]">
                    {style.category}
                  </span>

                  {/* Drag Hint (Desktop) */}
                  <span className="hidden lg:flex absolute bottom-2 right-2 items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-black/80 backdrop-blur text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity border border-white/10">
                    <GripVertical className="w-2.5 h-2.5 text-amber-400" />
                    Drag to prompt
                  </span>

                  {/* Selected Indicator */}
                  {isSelected && (
                    <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-amber-400 text-black flex items-center justify-center shadow-lg">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="p-2.5 flex-1 flex flex-col justify-between">
                  <h4
                    className={`text-xs font-bold transition-colors ${isSelected ? "text-amber-300" : "text-[#F5F5F7] group-hover:text-amber-200"
                      }`}
                  >
                    {style.name}
                  </h4>
                  <p className="text-[11px] text-[#9A9AA2] mt-1 line-clamp-2 leading-relaxed">
                    {style.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
