"use client";

import { Bot, Database, Search, Sparkles, Brain } from "lucide-react";

const loadingSteps = [
  {
    icon: Search,
    text: "Searching scientific databases...",
    color: "text-[#13ec92]",
  },
  {
    icon: Database,
    text: "Fetching protein structures...",
    color: "text-[#13ec92]/80",
  },
  {
    icon: Brain,
    text: "Analyzing molecular data...",
    color: "text-[#13ec92]/60",
  },
  {
    icon: Sparkles,
    text: "Generating explanation...",
    color: "text-amber-500",
  },
];

export function LoadingIndicator() {
  return (
    <div className="flex gap-4">
      {/* Avatar */}
      <div className="shrink-0">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-r from-slate-700 to-slate-800 shadow-lg">
          <Bot className="w-5 h-5 text-white animate-pulse" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        <div className="bg-white/[0.06] backdrop-blur-md border border-white/[0.08] rounded-2xl rounded-tl-sm p-4 shadow-lg">
          {/* Typing indicator */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex space-x-1.5">
              <div
                className="w-2.5 h-2.5 bg-[#13ec92] rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <div
                className="w-2.5 h-2.5 bg-[#13ec92] rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <div
                className="w-2.5 h-2.5 bg-[#13ec92] rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
            <span className="text-sm text-white/60">
              Processing your question...
            </span>
          </div>

          {/* Loading steps */}
          <div className="space-y-2.5">
            {loadingSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.text}
                  className="flex items-center gap-3 text-xs animate-pulse"
                  style={{ animationDelay: `${index * 400}ms` }}
                >
                  <div className="w-6 h-6 rounded-lg bg-white/[0.06] flex items-center justify-center">
                    <Icon className={`w-3.5 h-3.5 ${step.color}`} />
                  </div>
                  <span className="text-white/40">{step.text}</span>
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-1 bg-white/[0.06] backdrop-blur-sm rounded-full overflow-hidden">
            <div className="h-full bg-[#13ec92] rounded-full animate-loading-bar" />
          </div>
        </div>
      </div>
    </div>
  );
}
