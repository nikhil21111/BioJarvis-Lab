"use client";

import { useRef, useState } from "react";
import { Send, Paperclip } from "lucide-react";

interface InputBarProps {
  onSend: (message: string) => void;
  loading?: boolean;
}

export function InputBar({ onSend, loading = false }: InputBarProps) {
  const [input, setInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function detectTargetAnchor(raw: string, mutations: string[]) {
    const geneMatchPattern = /\b([A-Z0-9]{2,12})\s*[,\t:|; ]+\s*([A-Z]\d+[A-Z])\b/g;
    const counts = new Map<string, number>();

    let match: RegExpExecArray | null = null;
    while ((match = geneMatchPattern.exec(raw.toUpperCase())) !== null) {
      const gene = match[1];
      const mutation = match[2];
      if (!mutations.includes(mutation)) continue;
      counts.set(gene, (counts.get(gene) || 0) + 1);
    }

    if (counts.size > 0) {
      return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }

    const knownTargets = [
      "EGFR",
      "BRCA1",
      "BRCA2",
      "TP53",
      "ALK",
      "KRAS",
      "BRAF",
      "PIK3CA",
      "ERBB2",
      "MET",
      "JAK2",
      "FLT3",
      "NTRK1",
      "ROS1",
      "RET",
      "PTEN",
      "CDK4",
      "CDK6",
      "KIT",
      "PDGFRA",
    ];

    for (const target of knownTargets) {
      const targetPattern = new RegExp(`\\b${target}\\b`, "i");
      if (targetPattern.test(raw)) return target;
    }

    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || loading) {
      return;
    }
    onSend(message);
    setInput("");
  }

  function handleAttachmentClick() {
    if (loading) return;
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || loading) return;

    try {
      const raw = await file.text();
      const matches = raw.toUpperCase().match(/\b[A-Z]\d+[A-Z]\b/g) || [];
      const uniqueMutations = Array.from(new Set(matches)).slice(0, 50);
      const targetAnchor = detectTargetAnchor(raw, uniqueMutations);
      const anchorSuffix = targetAnchor
        ? `\nTarget anchor: ${targetAnchor}\nStructure request: show ${targetAnchor} structure and map these mutations if available.`
        : "";

      const payload =
        uniqueMutations.length > 0
          ? `Analyze this uploaded variant panel from file \"${file.name}\".\nMutations: ${uniqueMutations.join(", ")}\n\nPlease: (1) group likely functional impact, (2) map structure relevance where available, (3) flag uncertain interpretations.${anchorSuffix}`
          : `I uploaded \"${file.name}\". Please analyze this dataset and summarize key scientific findings, confidence, and limitations:\n\n${raw.slice(0, 3000)}`;

      onSend(payload);
    } finally {
      e.target.value = "";
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="input-glow bg-white/[0.02] backdrop-blur-md rounded-xl border border-white/[0.06] overflow-hidden transition-all duration-300">
        <div className="flex items-center gap-2.5 px-4 py-3">
          <button
            type="button"
            onClick={handleAttachmentClick}
            className="text-white/15 hover:text-white/40 transition-colors duration-200 shrink-0"
            aria-label="Add attachment"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,.tsv,.json"
            className="hidden"
            onChange={handleFileSelected}
          />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about proteins, drugs, or molecular structures..."
            className="flex-1 bg-transparent text-white/80 placeholder:text-white/15 focus:outline-none text-[13px] font-light tracking-wide"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-lg bg-[#13ec92] text-[#050505] flex items-center justify-center transition-all duration-300 disabled:opacity-20 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(19,236,146,0.3)] hover:scale-105 active:scale-95 shrink-0"
            aria-label="Send message"
          >
            <Send className="w-[15px] h-[15px]" />
          </button>
        </div>
      </div>
    </form>
  );
}
