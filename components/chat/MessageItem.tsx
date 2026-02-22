"use client";

import { useState } from "react";
import { Message } from "@/types/app";
import {
  User,
  Bot,
  Clock,
  Zap,
  Database,
  Sparkles,
  Box,
  BookOpen,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  GitCompareArrows,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface MessageItemProps {
  message: Message;
  structureIndex?: number;
  onStructureSelect?: (structureIndex: number) => void;
  onOpenCompare?: () => void;
  showIntentDebug?: boolean;
  onIntentFeedback?: (payload: {
    route: "text_only" | "structure_required";
    verdict: "correct" | "incorrect";
    question?: string;
  }) => void;
}

function formatJournal(journal?: string, year?: string | number) {
  if (journal && year) return journal + " (" + year + ")";
  if (journal) return journal;
  if (year) return String(year);
  return null;
}

function confidenceClasses(confidence: "high" | "medium" | "low") {
  if (confidence === "high") {
    return "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
  }
  if (confidence === "medium") {
    return "bg-amber-500/20 text-amber-300 border border-amber-500/30";
  }
  return "bg-rose-500/20 text-rose-300 border border-rose-500/30";
}

function responseConfidenceClasses(confidence: "high" | "medium" | "low") {
  if (confidence === "high") {
    return "text-emerald-300 border-emerald-500/40 bg-emerald-500/10";
  }
  if (confidence === "medium") {
    return "text-amber-300 border-amber-500/40 bg-amber-500/10";
  }
  return "text-rose-300 border-rose-500/40 bg-rose-500/10";
}

function mutationTierClasses(
  tier: "clinical" | "literature" | "computational" | "predicted",
) {
  if (tier === "clinical") {
    return "text-emerald-300 border-emerald-500/30 bg-emerald-500/10";
  }
  if (tier === "literature") {
    return "text-cyan-300 border-cyan-500/30 bg-cyan-500/10";
  }
  if (tier === "computational") {
    return "text-violet-300 border-violet-500/30 bg-violet-500/10";
  }
  return "text-slate-300 border-slate-500/30 bg-slate-500/10";
}

function mutationTierLabel(
  tier: "clinical" | "literature" | "computational" | "predicted",
) {
  if (tier === "clinical") return "Clinical";
  if (tier === "literature") return "Literature";
  if (tier === "computational") return "Computational";
  return "Predicted";
}

export function MessageItem({
  message,
  structureIndex,
  onStructureSelect,
  onOpenCompare,
  showIntentDebug,
  onIntentFeedback,
}: MessageItemProps) {
  const isUser = message.role === "user";
  const [highlightedEvidenceIndex, setHighlightedEvidenceIndex] = useState<
    number | null
  >(null);
  const mutationTierOrder = [
    "clinical",
    "literature",
    "computational",
    "predicted",
  ] as const;
  const mutationTierCounts =
    message.structure?.mutations?.reduce(
      (acc, mutation) => {
        if (mutation.evidenceTier) {
          acc[mutation.evidenceTier] += 1;
        }
        return acc;
      },
      {
        clinical: 0,
        literature: 0,
        computational: 0,
        predicted: 0,
      },
    ) || null;
  const hasMutationTierData =
    !!mutationTierCounts &&
    mutationTierOrder.some((tier) => mutationTierCounts[tier] > 0);
  const hasCompareAction =
    !!onOpenCompare &&
    (message.metadata?.compareMode ||
      (message.compareStructures?.length || 0) > 0);

  function evidenceAnchorId(index: number) {
    return `evidence-${message.id}-${index}`;
  }

  function handleTraceabilityClick(trace: {
    sourceType: "pdb" | "uniprot" | "chembl" | "pubmed" | "web";
    sourceLabel: string;
  }) {
    if (!message.evidenceClaims || message.evidenceClaims.length === 0) return;
    const matchedIndex = message.evidenceClaims.findIndex(
      (claim) =>
        claim.sourceType === trace.sourceType &&
        claim.sourceLabel === trace.sourceLabel,
    );
    if (matchedIndex < 0) return;

    setHighlightedEvidenceIndex(matchedIndex);
    const anchorId = evidenceAnchorId(matchedIndex);
    if (typeof document !== "undefined") {
      const element = document.getElementById(anchorId);
      element?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  return (
    <div
      style={{
        display: "flex",
        gap: "12px",
        width: "100%",
        maxWidth: "100%",
        overflow: "hidden",
        flexDirection: isUser ? "row-reverse" : "row",
      }}
    >
      {/* Avatar */}
      <div style={{ flexShrink: 0 }}>
        <div
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shadow-lg",
            isUser
              ? "bg-[#13ec92]"
              : "bg-gradient-to-r from-slate-700 to-slate-800",
          )}
        >
          {isUser ? (
            <User className="w-5 h-5 text-white" />
          ) : (
            <Bot className="w-5 h-5 text-white" />
          )}
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          flex: "1 1 0%",
          minWidth: 0,
          width: 0,
          overflow: "hidden",
          display: isUser ? "flex" : "block",
          flexDirection: isUser ? "column" : undefined,
          alignItems: isUser ? "flex-end" : undefined,
        }}
      >
        <div
          className={cn(
            "p-4 rounded-2xl shadow-lg",
            isUser
              ? "bg-[#13ec92]/15 text-white rounded-tr-sm ring-1 ring-[#13ec92]/20"
              : "bg-white/[0.06] backdrop-blur-md text-slate-200 border border-white/[0.08] rounded-tl-sm",
          )}
          style={{
            maxWidth: "100%",
            overflow: "hidden",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              fontSize: "0.875rem",
              lineHeight: "1.625",
              overflowWrap: "anywhere",
              wordBreak: "break-word",
              whiteSpace: "pre-wrap",
              maxWidth: "100%",
              overflow: "hidden",
            }}
          >
            {message.content}
          </div>

          {!isUser && message.metadata?.uncertaintyWarning && (
            <div className="mt-3 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200">
              <div className="flex items-start gap-2 text-xs leading-snug">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{message.metadata.uncertaintyWarning}</span>
              </div>
            </div>
          )}

          {/* Sources / Research Papers */}
          {!isUser && message.sources && message.sources.length > 0 && (
            <div
              className="mt-3 pt-3 border-t border-white/10"
              style={{ overflow: "hidden" }}
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white/40 mb-2">
                <BookOpen className="w-3.5 h-3.5" />
                Sources:
              </div>
              <div className="space-y-1.5" style={{ overflow: "hidden" }}>
                {message.sources.map((source, i) => (
                  <a
                    key={i}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:border-[#13ec92]/30 hover:bg-white/[0.08] transition-all group cursor-pointer"
                    style={{ overflow: "hidden" }}
                  >
                    <span className="flex items-center justify-center w-5 h-5 rounded-md bg-[#13ec92] text-black text-[10px] font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <div
                      style={{
                        minWidth: 0,
                        flex: "1 1 0%",
                        overflow: "hidden",
                      }}
                    >
                      <p className="text-xs font-medium text-slate-300 leading-snug line-clamp-2 group-hover:text-[#13ec92] transition-colors">
                        {source.title}
                      </p>
                      {formatJournal(source.journal, source.year) && (
                        <p className="text-[10px] text-white/30 mt-0.5">
                          {formatJournal(source.journal, source.year)}
                        </p>
                      )}
                    </div>
                    <ExternalLink className="w-3 h-3 text-white/20 group-hover:text-[#13ec92] shrink-0 mt-1 transition-colors" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {!isUser &&
            message.evidenceClaims &&
            message.evidenceClaims.length > 0 && (
              <div
                className="mt-3 pt-3 border-t border-white/10"
                style={{ overflow: "hidden" }}
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white/40 mb-2">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Evidence map:
                </div>
                <div className="space-y-2" style={{ overflow: "hidden" }}>
                  {message.evidenceClaims.map((item, i) => (
                    <div
                      key={i}
                      id={evidenceAnchorId(i)}
                      className={cn(
                        "px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] transition-all",
                        highlightedEvidenceIndex === i &&
                          "border-[#13ec92]/50 bg-[#13ec92]/10",
                      )}
                      style={{ overflow: "hidden" }}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${confidenceClasses(item.confidence)}`}
                        >
                          {item.confidence}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-white/[0.06] text-white/60 border border-white/[0.12]">
                          {item.sourceType}
                        </span>
                        <span className="text-[10px] text-white/35 truncate">
                          {item.sourceLabel}
                        </span>
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-[#13ec92] hover:text-[#13ec92]/80"
                          >
                            source
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 leading-snug break-words">
                        {item.claim}
                      </p>
                      {item.evidence && (
                        <p className="mt-1 text-[10px] text-white/35 break-words">
                          {item.evidence}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          {!isUser &&
            message.claimTraceability &&
            message.claimTraceability.length > 0 && (
              <div
                className="mt-3 pt-3 border-t border-white/10"
                style={{ overflow: "hidden" }}
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white/40 mb-2">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Claim traceability:
                </div>
                <div className="space-y-2" style={{ overflow: "hidden" }}>
                  {message.claimTraceability.slice(0, 5).map((item, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleTraceabilityClick(item)}
                      className="w-full text-left px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:border-[#13ec92]/40 hover:bg-white/[0.08] transition-colors"
                    >
                      <p className="text-xs text-slate-300 leading-snug break-words mb-1">
                        {item.sentence}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${confidenceClasses(item.confidence)}`}
                        >
                          {item.confidence}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-white/[0.06] text-white/60 border border-white/[0.12]">
                          {item.sourceType}
                        </span>
                        <span className="text-[10px] text-white/35 truncate">
                          {item.sourceLabel}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

          {/* Structure indicator — enhanced inline card */}
          {message.structure && (
            <div
              className="mt-3 pt-3 border-t border-white/10"
              style={{ overflow: "hidden" }}
            >
              <button
                type="button"
                onClick={() => {
                  if (structureIndex !== undefined) {
                    onStructureSelect?.(structureIndex);
                  }
                }}
                className="w-full text-left bg-[#13ec92]/5 border border-[#13ec92]/20 rounded-xl p-3 hover:border-[#13ec92]/40 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center justify-center w-7 h-7 bg-[#13ec92]/15 rounded-lg">
                    <Box className="w-4 h-4 text-[#13ec92]" />
                  </div>
                  {structureIndex !== undefined && (
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-[#13ec92]/20 text-[#13ec92]">
                      #{structureIndex}
                    </span>
                  )}
                  <span className="font-mono text-sm font-bold text-[#13ec92]">
                    {message.structure.pdbId}
                  </span>
                  {message.structure.isAlphaFold && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      AlphaFold
                    </span>
                  )}
                </div>
                {message.structure.title && (
                  <p className="text-xs text-slate-300 leading-snug mb-1.5 line-clamp-2">
                    {message.structure.title}
                  </p>
                )}
                <div className="flex items-center gap-3 text-[10px] text-slate-400 flex-wrap">
                  {message.structure.resolution && (
                    <span>
                      Resolution:{" "}
                      <span className="text-slate-300 font-medium">
                        {message.structure.resolution} A
                      </span>
                    </span>
                  )}
                  {message.structure.method && (
                    <span>{message.structure.method}</span>
                  )}
                  {message.structure.ligand && (
                    <span>
                      Ligand:{" "}
                      <span className="text-emerald-300 font-medium">
                        {message.structure.ligand}
                      </span>
                    </span>
                  )}
                  {message.structure.bindingSite?.residues && (
                    <span>
                      Binding site:{" "}
                      <span className="text-orange-300 font-medium">
                        {message.structure.bindingSite.residues.length} residues
                      </span>
                    </span>
                  )}
                  {message.structure.mutations &&
                    message.structure.mutations.length > 0 && (
                      <span>
                        Mutations:{" "}
                        <span className="text-red-300 font-medium">
                          {message.structure.mutations.length}
                        </span>
                      </span>
                    )}
                </div>
                {message.structure.annotationProvenance?.structureConfidence ===
                  "low" && (
                  <div className="mt-2 px-2 py-1 rounded-md text-[10px] border border-amber-500/30 bg-amber-500/10 text-amber-300">
                    Low-confidence structure candidate — verify before
                    residue-level conclusions.
                  </div>
                )}
                {hasMutationTierData && (
                  <div className="mt-2 px-2 py-1.5 rounded-md border border-white/10 bg-white/[0.03]">
                    <div className="text-[10px] text-white/40 mb-1">
                      Mutation evidence tiers
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {mutationTierOrder.map(
                        (tier) =>
                          mutationTierCounts[tier] > 0 && (
                            <span
                              key={tier}
                              className={`px-1.5 py-0.5 rounded border text-[9px] ${mutationTierClasses(tier)}`}
                            >
                              {mutationTierLabel(tier)}:{" "}
                              {mutationTierCounts[tier]}
                            </span>
                          ),
                      )}
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-[#13ec92]/40 mt-2">
                  View interactive 3D structure in the viewer panel →
                </p>
              </button>

              {hasCompareAction && (
                <button
                  type="button"
                  onClick={onOpenCompare}
                  className="mt-2 w-full text-left bg-sky-500/10 border border-sky-500/30 rounded-xl p-2.5 hover:border-sky-400/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-6 h-6 rounded-md bg-sky-500/20">
                      <GitCompareArrows className="w-3.5 h-3.5 text-sky-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-sky-200">
                        Compare newest 2 structures
                      </p>
                      <p className="text-[10px] text-sky-300/70">
                        Jump directly to Pocket Comparison Mode
                      </p>
                    </div>
                  </div>
                </button>
              )}
            </div>
          )}

          {!message.structure && hasCompareAction && (
            <div
              className="mt-3 pt-3 border-t border-white/10"
              style={{ overflow: "hidden" }}
            >
              <button
                type="button"
                onClick={onOpenCompare}
                className="w-full text-left bg-sky-500/10 border border-sky-500/30 rounded-xl p-2.5 hover:border-sky-400/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-md bg-sky-500/20">
                    <GitCompareArrows className="w-3.5 h-3.5 text-sky-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-sky-200">
                      Compare newest 2 structures
                    </p>
                    <p className="text-[10px] text-sky-300/70">
                      Open Pocket Comparison Mode in Viewer
                    </p>
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div
          className="text-xs text-white/30"
          style={{
            marginTop: "8px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
            overflow: "hidden",
            justifyContent: isUser ? "flex-end" : "flex-start",
          }}
        >
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(message.timestamp, "HH:mm")}
          </span>

          {message.metadata?.executionTime && (
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              {(message.metadata.executionTime / 1000).toFixed(1)}s
            </span>
          )}

          {message.metadata?.toolsCalled &&
            message.metadata.toolsCalled.length > 0 && (
              <span
                className="flex items-center gap-1"
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                <Database className="w-3 h-3 text-[#13ec92] shrink-0" />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {message.metadata.toolsCalled.join(", ")}
                </span>
              </span>
            )}

          {message.metadata?.cached && (
            <span className="flex items-center gap-1 text-emerald-400">
              <Sparkles className="w-3 h-3" />
              Cached
            </span>
          )}

          {!isUser && message.metadata?.responseConfidence && (
            <span
              className={`px-1.5 py-0.5 rounded border text-[10px] ${responseConfidenceClasses(message.metadata.responseConfidence)}`}
              title={message.metadata.confidenceRationale}
            >
              Confidence: {message.metadata.responseConfidence}
            </span>
          )}

          {!isUser && message.metadata?.compareMode && (
            <span
              className="px-1.5 py-0.5 rounded border text-[10px] text-sky-300 border-sky-500/40 bg-sky-500/10"
              title={message.metadata.compareReason}
            >
              Compare mode
            </span>
          )}

          {!isUser &&
            message.metadata?.policyFlags &&
            message.metadata.policyFlags.length > 0 && (
              <span
                className="px-1.5 py-0.5 rounded border text-[10px] text-violet-300 border-violet-500/40 bg-violet-500/10"
                title={message.metadata.policyFlags.join(", ")}
              >
                Policy: {message.metadata.policyFlags[0]}
              </span>
            )}

          {!isUser && showIntentDebug && message.metadata?.intentRoute && (
            <div className="flex items-center gap-2 max-w-full">
              <span className="text-[10px] text-white/35 truncate max-w-[60%]">
                Route: {message.metadata.intentRoute} ·{" "}
                {message.metadata.structureDecision}
              </span>
              <button
                type="button"
                onClick={() =>
                  onIntentFeedback?.({
                    route: message.metadata?.intentRoute || "text_only",
                    verdict: "correct",
                  })
                }
                className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
              >
                correct
              </button>
              <button
                type="button"
                onClick={() =>
                  onIntentFeedback?.({
                    route: message.metadata?.intentRoute || "text_only",
                    verdict: "incorrect",
                  })
                }
                className="text-[10px] px-1.5 py-0.5 rounded border border-red-500/40 text-red-300 hover:bg-red-500/10"
              >
                wrong
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
