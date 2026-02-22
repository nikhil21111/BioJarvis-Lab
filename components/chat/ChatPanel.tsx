"use client";

import { useState, useRef, useEffect } from "react";
import { MessageList } from "./MessageList";
import { SuggestedQuestions } from "./SuggestedQuestions";
import { InputBar } from "@/components/chat/InputBar";
import { Message, StructureData } from "@/types/app";
import { nanoid } from "nanoid";
import Image from "next/image";
import { CheckCircle2, Copy, Download, GitCompareArrows } from "lucide-react";
import {
  getIntentFeedbackStore,
  recordIntentFeedback,
} from "@/lib/utils/intent-feedback";

function createNotebookFromMessages(messages: Message[]) {
  const cells: Array<{
    cell_type: "markdown" | "code";
    metadata: Record<string, unknown>;
    source: string[];
    outputs?: unknown[];
    execution_count?: number | null;
  }> = [];

  const generatedAt = new Date().toISOString();

  cells.push({
    cell_type: "markdown",
    metadata: {},
    source: [
      "# BioJarvis Research Notebook\n",
      "\n",
      `Generated: ${generatedAt}\n`,
      "\n",
      "This notebook was exported from a BioJarvis chat session for reproducibility and record-keeping.\n",
    ],
  });

  for (const message of messages) {
    if (message.role === "user") {
      cells.push({
        cell_type: "markdown",
        metadata: {},
        source: ["## Question\n", "\n", `${message.content}\n`],
      });
      continue;
    }

    if (message.role === "assistant") {
      const answerSource = ["## Answer\n", "\n", `${message.content}\n`];

      if (message.metadata?.responseConfidence) {
        answerSource.push(
          "\n",
          `- Confidence: ${message.metadata.responseConfidence}\n`,
        );
      }

      if (message.metadata?.uncertaintyWarning) {
        answerSource.push(
          `- Uncertainty note: ${message.metadata.uncertaintyWarning}\n`,
        );
      }

      if (message.metadata?.compareMode) {
        answerSource.push("- Compare mode: enabled\n");
      }

      cells.push({
        cell_type: "markdown",
        metadata: {},
        source: answerSource,
      });

      if (message.structure?.pdbId) {
        cells.push({
          cell_type: "markdown",
          metadata: {},
          source: [
            "### Structure Context\n",
            "\n",
            `- PDB ID: ${message.structure.pdbId}\n`,
            message.structure.title
              ? `- Title: ${message.structure.title}\n`
              : "",
            message.structure.ligand
              ? `- Ligand: ${message.structure.ligand}\n`
              : "",
            message.structure.bindingSite?.residues?.length
              ? `- Binding-site residues: ${message.structure.bindingSite.residues.length}\n`
              : "",
            message.structure.mutations?.length
              ? `- Mutations: ${message.structure.mutations.length}\n`
              : "",
          ].filter(Boolean),
        });
      }

      if (message.sources && message.sources.length > 0) {
        cells.push({
          cell_type: "markdown",
          metadata: {},
          source: [
            "### Sources\n",
            "\n",
            ...message.sources.map(
              (source) => `- [${source.title}](${source.url})\n`,
            ),
          ],
        });
      }

      if (message.evidenceClaims && message.evidenceClaims.length > 0) {
        const evidenceJson = JSON.stringify(message.evidenceClaims, null, 2);
        cells.push({
          cell_type: "code",
          metadata: {},
          source: [
            "# Evidence claims exported from BioJarvis\n",
            `evidence_claims = ${evidenceJson}\n`,
            "len(evidence_claims)\n",
          ],
          outputs: [],
          execution_count: null,
        });
      }
    }
  }

  return {
    cells,
    metadata: {
      kernelspec: {
        display_name: "Python 3",
        language: "python",
        name: "python3",
      },
      language_info: {
        name: "python",
      },
      biojarvis: {
        exportedAt: generatedAt,
        messageCount: messages.length,
      },
    },
    nbformat: 4,
    nbformat_minor: 5,
  };
}

function createCollaborationBrief(messages: Message[]) {
  const userQuestions = messages.filter((m) => m.role === "user");
  const assistantMessages = messages.filter((m) => m.role === "assistant");
  const structures = assistantMessages
    .map((m) => m.structure)
    .filter((structure): structure is NonNullable<Message["structure"]> =>
      Boolean(structure?.pdbId),
    );

  const uniquePdbIds = Array.from(
    new Set(structures.map((s) => s.pdbId)),
  ).slice(0, 10);

  const sourceLines = assistantMessages
    .flatMap((m) => m.sources || [])
    .slice(0, 10)
    .map((source) => `- ${source.title}: ${source.url}`);

  const summaryLines = assistantMessages.slice(-2).map((message, index) => {
    const clipped =
      message.content.length > 500
        ? `${message.content.slice(0, 500)}...`
        : message.content;
    return `### Key finding ${index + 1}\n${clipped}`;
  });

  return [
    "# BioJarvis Collaboration Brief",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Questions in session: ${userQuestions.length}`,
    `Assistant responses: ${assistantMessages.length}`,
    uniquePdbIds.length > 0
      ? `Structures referenced (PDB): ${uniquePdbIds.join(", ")}`
      : "Structures referenced (PDB): none",
    "",
    "## Questions",
    ...userQuestions.slice(0, 12).map((q, i) => `${i + 1}. ${q.content}`),
    "",
    "## Key Findings",
    ...(summaryLines.length > 0
      ? summaryLines
      : ["No assistant findings are available yet."]),
    "",
    "## Sources",
    ...(sourceLines.length > 0 ? sourceLines : ["- No sources captured."]),
  ].join("\n");
}

interface ChatPanelProps {
  onStructureUpdate?: (structure: StructureData | null) => void;
  onStructureSelect?: (structureIndex: number) => void;
  onOpenCompare?: () => void;
  canOpenCompare?: boolean;
  messages?: Message[];
  onMessagesChange?: (messages: Message[]) => void;
  structureLimitReached?: boolean;
}

export function ChatPanel({
  onStructureUpdate,
  onStructureSelect,
  onOpenCompare,
  canOpenCompare,
  messages: externalMessages,
  onMessagesChange,
  structureLimitReached,
}: ChatPanelProps) {
  const [internalMessages, setInternalMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportingNotebook, setExportingNotebook] = useState(false);
  const [copyingBrief, setCopyingBrief] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<"draft" | "reviewed">(
    "draft",
  );
  const [showIntentDebug, setShowIntentDebug] = useState(false);
  const [feedbackSummary, setFeedbackSummary] = useState(() =>
    getIntentFeedbackStore(),
  );

  const isDev = process.env.NODE_ENV !== "production";

  const messages =
    externalMessages !== undefined ? externalMessages : internalMessages;
  const setMessages = onMessagesChange || setInternalMessages;

  // Keep a ref to always have the latest messages in async callbacks
  const messagesRef = useRef<Message[]>(messages);
  messagesRef.current = messages;
  const conversationIdRef = useRef<string>(
    externalMessages?.find(
      (m) => m.role === "assistant" && m.metadata?.conversationId,
    )?.metadata?.conversationId || nanoid(),
  );

  const reviewStorageKey = `review-status:${conversationIdRef.current}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.sessionStorage.getItem(reviewStorageKey);
    if (saved === "draft" || saved === "reviewed") {
      setReviewStatus(saved);
    }
  }, [reviewStorageKey]);

  async function handleSendMessage(question: string) {
    const userMessage: Message = {
      id: nanoid(),
      role: "user",
      content: question,
      timestamp: new Date(),
    };
    const withUser = [...messagesRef.current, userMessage];
    setMessages(withUser);
    messagesRef.current = withUser;
    setLoading(true);

    try {
      // Build conversation history from existing messages for multi-turn context
      const conversationHistory = messagesRef.current
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content.slice(0, 2000),
        }));

      const lastAssistantWithStructure = [...messagesRef.current]
        .reverse()
        .find((m) => m.role === "assistant" && m.structure);

      const structureContext = lastAssistantWithStructure?.structure
        ? {
            pdbId: lastAssistantWithStructure.structure.pdbId,
            ligand: lastAssistantWithStructure.structure.ligand,
            title: lastAssistantWithStructure.structure.title,
            bindingSiteResidues:
              lastAssistantWithStructure.structure.bindingSite?.residues?.map(
                (r) => `${r.chain || "A"}:${r.number}`,
              ),
          }
        : undefined;

      const lastAssistantAnswer = [...messagesRef.current]
        .reverse()
        .find((m) => m.role === "assistant")
        ?.content.slice(0, 2000);

      const followUpMemory =
        structureContext || lastAssistantAnswer
          ? {
              structureContext,
              lastAssistantAnswer,
            }
          : undefined;

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          conversationHistory,
          structureContext,
          followUpMemory,
          conversationId: conversationIdRef.current,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Failed to get response");
      }

      const assistantMessage: Message = {
        id: nanoid(),
        role: "assistant",
        content: data.text,
        structure: data.structure,
        compareStructures: data.compareStructures,
        sources: data.sources,
        evidenceClaims: data.evidenceClaims,
        claimTraceability: data.claimTraceability,
        timestamp: new Date(),
        metadata: {
          tokensUsed: data.metadata?.tokensUsed,
          executionTime: data.metadata?.executionTime,
          toolsCalled: data.metadata?.toolsCalled,
          cached: data.cached,
          responseConfidence: data.metadata?.responseConfidence,
          confidenceRationale: data.metadata?.confidenceRationale,
          uncertaintyWarning: data.metadata?.uncertaintyWarning,
          intentRoute: data.metadata?.intentRoute,
          structureDecision: data.metadata?.structureDecision,
          compareMode: data.metadata?.compareMode,
          compareReason: data.metadata?.compareReason,
          policyFlags: data.metadata?.policyFlags,
          reviewStatus,
          conversationId: data.metadata?.conversationId,
        },
      };
      if (data.metadata?.conversationId) {
        conversationIdRef.current = data.metadata.conversationId;
      }
      const withReply = [...messagesRef.current, assistantMessage];
      setMessages(withReply);
      messagesRef.current = withReply;

      const responseStructures = [
        data.structure,
        ...(Array.isArray(data.compareStructures)
          ? data.compareStructures
          : []),
      ].filter((structure): structure is StructureData =>
        Boolean(structure?.pdbId),
      );

      if (responseStructures.length > 0 && onStructureUpdate) {
        if (structureLimitReached) {
          // Add a warning message about the limit
          const limitMessage: Message = {
            id: nanoid(),
            role: "assistant",
            content:
              "⚠️ You've reached the maximum of 5 structures in this chat session. The structure data was received but cannot be visualized here. Please open a new chat to visualize more structures.",
            timestamp: new Date(),
          };
          const withLimit = [...messagesRef.current, limitMessage];
          setMessages(withLimit);
          messagesRef.current = withLimit;
          return;
        } else {
          const seenPdbIds = new Set<string>();
          for (const structure of responseStructures) {
            if (seenPdbIds.has(structure.pdbId)) continue;
            seenPdbIds.add(structure.pdbId);
            onStructureUpdate(structure);
          }
        }
      }
    } catch (error) {
      const errorMessage: Message = {
        id: nanoid(),
        role: "assistant",
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`,
        timestamp: new Date(),
      };
      const withError = [...messagesRef.current, errorMessage];
      setMessages(withError);
      messagesRef.current = withError;
    } finally {
      setLoading(false);
    }
  }

  function handleIntentFeedback(payload: {
    route: "text_only" | "structure_required";
    verdict: "correct" | "incorrect";
    question?: string;
  }) {
    const updated = recordIntentFeedback({
      timestamp: new Date().toISOString(),
      route: payload.route,
      verdict: payload.verdict,
      question: payload.question,
    });
    setFeedbackSummary(updated);
  }

  function handleExportNotebook() {
    if (messagesRef.current.length === 0 || exportingNotebook) return;

    try {
      setExportingNotebook(true);
      const notebook = createNotebookFromMessages(messagesRef.current);
      const blob = new Blob([JSON.stringify(notebook, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      anchor.href = url;
      anchor.download = `biojarvis-notebook-${timestamp}.ipynb`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } finally {
      setExportingNotebook(false);
    }
  }

  async function handleCopyCollaborationBrief() {
    if (messagesRef.current.length === 0 || copyingBrief) return;

    try {
      setCopyingBrief(true);
      const brief = createCollaborationBrief(messagesRef.current);
      await navigator.clipboard.writeText(brief);
    } catch (error) {
      console.error("Failed to copy collaboration brief:", error);
    } finally {
      setCopyingBrief(false);
    }
  }

  function handleToggleReviewed() {
    const next = reviewStatus === "draft" ? "reviewed" : "draft";
    setReviewStatus(next);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(reviewStorageKey, next);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        flexDirection: "column",
        minWidth: 0,
        maxWidth: "100%",
        overflow: "hidden",
        width: "100%",
      }}
    >
      {/* Header - hidden in empty state, shown with messages */}
      {messages.length > 0 && (
        <>
          <div className="shrink-0 px-4 py-3 border-b border-white/10 flex items-center justify-between bg-[#0a0a0a]/80 backdrop-blur-md">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center w-9 h-9 bg-[#13ec92]/10 rounded-lg border border-[#13ec92]/20">
                <Image
                  src="/biojarvis-logo.svg"
                  alt="BioJarvis"
                  width={22}
                  height={22}
                />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-slate-200 text-sm truncate">
                  Research Chat
                </h2>
                <p className="text-xs text-white/40 truncate">
                  Ask about drugs, targets, pathways, and structures
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleReviewed}
                className="text-[10px] px-2 py-1 rounded border border-white/20 text-white/70 hover:text-white hover:border-white/35 inline-flex items-center gap-1"
                title="Toggle team review status"
              >
                <CheckCircle2 className="w-3 h-3" />
                {reviewStatus === "reviewed" ? "Reviewed" : "Mark reviewed"}
              </button>
              <button
                type="button"
                onClick={handleCopyCollaborationBrief}
                disabled={copyingBrief || messages.length === 0}
                className="text-[10px] px-2 py-1 rounded border border-white/20 text-white/70 hover:text-white hover:border-white/35 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
              >
                <Copy className="w-3 h-3" />
                {copyingBrief ? "Copying..." : "Copy brief"}
              </button>
              <button
                type="button"
                onClick={onOpenCompare}
                disabled={!canOpenCompare}
                className="text-[10px] px-2 py-1 rounded border border-sky-500/30 text-sky-300/90 hover:text-sky-200 hover:border-sky-400/45 disabled:opacity-35 disabled:cursor-not-allowed inline-flex items-center gap-1"
                title={
                  canOpenCompare
                    ? "Open pocket comparison for newest two structures"
                    : "Load at least 2 structures to compare"
                }
              >
                <GitCompareArrows className="w-3 h-3" />
                Compare newest 2
              </button>
              <button
                type="button"
                onClick={handleExportNotebook}
                disabled={exportingNotebook || messages.length === 0}
                className="text-[10px] px-2 py-1 rounded border border-white/20 text-white/70 hover:text-white hover:border-white/35 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                {exportingNotebook ? "Exporting..." : "Export .ipynb"}
              </button>
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#13ec92]/10 border border-[#13ec92]/20">
                <span className="w-1.5 h-1.5 bg-[#13ec92] rounded-full animate-pulse" />
                <span className="text-xs font-medium text-[#13ec92]">Live</span>
              </div>
            </div>
            {isDev && (
              <button
                type="button"
                onClick={() => setShowIntentDebug((prev) => !prev)}
                className="ml-2 text-[10px] px-2 py-1 rounded border border-white/20 text-white/60 hover:text-white hover:border-white/35"
              >
                {showIntentDebug ? "Hide intent debug" : "Show intent debug"}
              </button>
            )}
          </div>
          {isDev && showIntentDebug && (
            <div className="px-4 py-2 border-b border-white/10 bg-white/[0.02] text-[10px] text-white/50 flex items-center gap-3 flex-wrap">
              <span>Intent feedback total: {feedbackSummary.total}</span>
              <span>correct: {feedbackSummary.correct}</span>
              <span>wrong: {feedbackSummary.incorrect}</span>
            </div>
          )}
        </>
      )}

      {/* Messages area */}
      <div
        style={{
          flex: "1 1 0%",
          minWidth: 0,
          overflow: "hidden",
          maxWidth: "100%",
          width: "100%",
        }}
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 lg:p-10 min-w-0 relative overflow-y-auto overflow-x-hidden">
            {/* === Atmospheric background orbs === */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="orb-green absolute top-[15%] left-[20%] w-[500px] h-[500px] rounded-full" />
              <div className="orb-teal absolute bottom-[10%] right-[15%] w-[400px] h-[400px] rounded-full" />
              <div className="orb-emerald absolute top-[60%] left-[50%] w-[300px] h-[300px] rounded-full" />
            </div>

            {/* === Subtle grid pattern === */}
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.015]"
              style={{
                backgroundImage: `linear-gradient(rgba(19,236,146,1) 1px, transparent 1px), linear-gradient(90deg, rgba(19,236,146,1) 1px, transparent 1px)`,
                backgroundSize: "60px 60px",
              }}
            />

            <div className="w-full max-w-2xl flex flex-col items-center z-10">
              {/* AI Online badge */}
              <div className="animate-fadeInUp delay-2 mb-8">
                <div className="flex items-center gap-2.5 px-5 py-2 rounded-full bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#13ec92] opacity-40" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#13ec92] shadow-[0_0_8px_rgba(19,236,146,0.5)]" />
                  </span>
                  <span className="text-[11px] text-white/40 mono-font tracking-[0.2em] uppercase font-medium">
                    AI Online
                  </span>
                </div>
              </div>

              {/* Main heading */}
              <div className="animate-fadeInUp delay-3 text-center mb-10">
                <h1 className="text-[2.75rem] lg:text-[3.5rem] font-bold text-white tracking-[-0.02em] leading-[1.1] mb-4">
                  Research{" "}
                  <span
                    className="text-gradient-green italic serif-font font-normal"
                    style={{ fontStyle: "italic" }}
                  >
                    Session
                  </span>
                </h1>
                <p className="text-white/30 text-[15px] max-w-md mx-auto leading-relaxed font-light">
                  Ask complex biological questions, explore 3D protein
                  structures, and get real-time research data from trusted
                  sources.
                </p>
              </div>

              {/* Suggested questions */}
              <div className="animate-fadeInUp delay-4 w-full mb-8">
                <SuggestedQuestions onSelect={handleSendMessage} />
              </div>

              {/* Input bar */}
              <div className="animate-fadeInUp delay-5 w-full mb-5">
                <InputBar onSend={handleSendMessage} loading={loading} />
              </div>

              {/* Footer */}
              <div className="animate-fadeIn delay-7 flex items-center gap-3 text-[10px] text-white/15 mono-font tracking-[0.25em] uppercase select-none">
                <span className="w-1.5 h-1.5 bg-[#13ec92]/30 rounded-full shadow-[0_0_6px_rgba(19,236,146,0.3)]" />
                <span>Deep Research</span>
                <span className="text-white/8">·</span>
                <span>Powered by BioJarvis</span>
              </div>
            </div>
          </div>
        ) : (
          <MessageList
            messages={messages}
            loading={loading}
            onStructureSelect={onStructureSelect}
            onOpenCompare={onOpenCompare}
            showIntentDebug={isDev && showIntentDebug}
            onIntentFeedback={handleIntentFeedback}
          />
        )}
      </div>

      {/* Input area when messages exist - Glass effect */}
      {messages.length > 0 && (
        <div className="shrink-0 px-3 pb-3 pt-2">
          <InputBar onSend={handleSendMessage} loading={loading} />
        </div>
      )}
    </div>
  );
}
