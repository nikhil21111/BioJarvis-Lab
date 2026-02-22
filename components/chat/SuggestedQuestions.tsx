"use client";

import { Pill, FlaskConical, Dna, Microscope, ArrowRight } from "lucide-react";

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
}

const suggestions = [
  {
    question: "How does Aspirin work?",
    icon: Pill,
    iconBg: "bg-rose-500/[0.08]",
    iconColor: "text-rose-400",
    hoverGlow: "group-hover:shadow-rose-500/10",
  },
  {
    question: "Show me the insulin structure",
    icon: Dna,
    iconBg: "bg-[#13ec92]/[0.08]",
    iconColor: "text-[#13ec92]",
    hoverGlow: "group-hover:shadow-[#13ec92]/10",
  },
  {
    question: "How does Penicillin kill bacteria?",
    icon: FlaskConical,
    iconBg: "bg-amber-400/[0.08]",
    iconColor: "text-amber-400",
    hoverGlow: "group-hover:shadow-amber-400/10",
  },
  {
    question: "How does Metformin work?",
    icon: Microscope,
    iconBg: "bg-sky-400/[0.08]",
    iconColor: "text-sky-400",
    hoverGlow: "group-hover:shadow-sky-400/10",
  },
];

export function SuggestedQuestions({ onSelect }: SuggestedQuestionsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {suggestions.map((suggestion) => {
        const Icon = suggestion.icon;
        return (
          <button
            key={suggestion.question}
            onClick={() => onSelect(suggestion.question)}
            className={`suggestion-card group rounded-2xl p-4 text-left cursor-pointer ${suggestion.hoverGlow}`}
          >
            <div className="flex items-center gap-3.5">
              <div
                className={`flex items-center justify-center w-11 h-11 rounded-xl ${suggestion.iconBg} transition-all duration-300 group-hover:scale-105`}
              >
                <Icon
                  className={`w-[18px] h-[18px] ${suggestion.iconColor} transition-transform duration-300 group-hover:scale-110`}
                />
              </div>
              <span className="flex-1 text-[13px] text-white/40 group-hover:text-white/70 transition-colors duration-300 leading-snug font-light">
                {suggestion.question}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-white/[0.06] group-hover:text-[#13ec92]/60 translate-x-0 group-hover:translate-x-1 transition-all duration-300" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
