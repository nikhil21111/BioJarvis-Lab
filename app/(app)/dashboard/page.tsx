"use client";

import { useState, useCallback, useEffect } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { StructurePanel } from "@/components/viewer/StructurePanel";
import { AppLayout } from "@/components/layout/AppLayout";
import { StructureData, Message } from "@/types/app";
import { MessageSquare, Box } from "lucide-react";
import { cn } from "@/lib/utils";
import { nanoid } from "nanoid";

const MAX_STRUCTURES = 5;

export default function DashboardPage() {
  const [structures, setStructures] = useState<StructureData[]>([]);
  const [newestIndex, setNewestIndex] = useState<number | undefined>(undefined);
  const [compareJumpToken, setCompareJumpToken] = useState(0);
  const [selectedStructureIndex, setSelectedStructureIndex] = useState<
    number | undefined
  >(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatSessionKey, setChatSessionKey] = useState(0);
  const [activeTab, setActiveTab] = useState<"chat" | "viewer">("chat");
  const [structureJustLoaded, setStructureJustLoaded] = useState(false);

  const resetChatSession = useCallback(() => {
    sessionStorage.removeItem("loadHistory");
    sessionStorage.removeItem("loadHistoryThread");
    setMessages([]);
    setStructures([]);
    setNewestIndex(undefined);
    setSelectedStructureIndex(undefined);
    setCompareJumpToken(0);
    setStructureJustLoaded(false);
    setActiveTab("chat");
    setChatSessionKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    const pendingNewChat = sessionStorage.getItem("forceNewChat");
    if (pendingNewChat) {
      sessionStorage.removeItem("forceNewChat");
      resetChatSession();
    }

    const handleNewChat = () => resetChatSession();
    window.addEventListener("biojarvis:new-chat", handleNewChat);
    return () => {
      window.removeEventListener("biojarvis:new-chat", handleNewChat);
    };
  }, [resetChatSession]);

  const handleStructureUpdate = useCallback(
    (structure: StructureData | null) => {
      if (!structure) return;

      setStructures((prev) => {
        if (prev.length >= MAX_STRUCTURES) return prev;
        const newStructures = [...prev, structure];
        setNewestIndex(newStructures.length - 1);
        setSelectedStructureIndex(newStructures.length - 1);
        // Clear the "new" highlight after animation
        setTimeout(() => setNewestIndex(undefined), 2000);
        return newStructures;
      });

      // Trigger panel ring animation
      setStructureJustLoaded(true);
      setTimeout(() => setStructureJustLoaded(false), 2000);
    },
    [],
  );

  // Load conversation from history if navigated from history page
  useEffect(() => {
    try {
      const storedThread = sessionStorage.getItem("loadHistoryThread");
      if (storedThread) {
        sessionStorage.removeItem("loadHistoryThread");

        const thread = JSON.parse(storedThread) as {
          items?: Array<{
            question: string;
            created_at: string;
            response?: {
              text?: string;
              sources?: unknown[];
              evidenceClaims?: Message["evidenceClaims"];
              structure?: StructureData;
              compareStructures?: StructureData[];
              metadata?: {
                tokensUsed?: number;
                executionTime?: number;
                toolsCalled?: string[];
                intentRoute?: "text_only" | "structure_required";
                structureDecision?: string;
                conversationId?: string;
              };
            };
          }>;
        };

        const loadedMessages: Message[] = [];
        const loadedStructures: StructureData[] = [];

        for (const item of thread.items || []) {
          loadedMessages.push({
            id: nanoid(),
            role: "user",
            content: item.question,
            timestamp: new Date(item.created_at),
          });

          const structure = item.response?.structure;
          const compareStructures = item.response?.compareStructures;
          if (item.response?.text) {
            loadedMessages.push({
              id: nanoid(),
              role: "assistant",
              content: item.response.text,
              structure,
              compareStructures,
              sources: item.response.sources as Message["sources"],
              evidenceClaims: item.response
                .evidenceClaims as Message["evidenceClaims"],
              timestamp: new Date(item.created_at),
              metadata: item.response.metadata
                ? {
                    tokensUsed: item.response.metadata.tokensUsed,
                    executionTime: item.response.metadata.executionTime,
                    toolsCalled: item.response.metadata.toolsCalled,
                    intentRoute: item.response.metadata.intentRoute,
                    structureDecision: item.response.metadata.structureDecision,
                    conversationId: item.response.metadata.conversationId,
                  }
                : undefined,
            });

            if (structure?.pdbId && loadedStructures.length < MAX_STRUCTURES) {
              loadedStructures.push(structure);
            }
            if (Array.isArray(compareStructures)) {
              for (const compareStructure of compareStructures) {
                if (
                  compareStructure?.pdbId &&
                  loadedStructures.length < MAX_STRUCTURES
                ) {
                  loadedStructures.push(compareStructure);
                }
              }
            }
          }
        }

        setTimeout(() => {
          setMessages(loadedMessages);
          setStructures(loadedStructures);
          if (loadedStructures.length > 0) {
            setSelectedStructureIndex(loadedStructures.length - 1);
          }
        }, 0);
        return;
      }

      const stored = sessionStorage.getItem("loadHistory");
      if (!stored) return;
      sessionStorage.removeItem("loadHistory");

      const historyItem = JSON.parse(stored);
      const loadedMessages: Message[] = [];

      // Add the user's original question
      loadedMessages.push({
        id: nanoid(),
        role: "user",
        content: historyItem.question,
        timestamp: new Date(historyItem.created_at),
      });

      // Build structure from response.structure or fall back to top-level pdb_id
      let structureData: StructureData | undefined;
      if (historyItem.response?.structure?.pdbId) {
        structureData = {
          pdbId: historyItem.response.structure.pdbId,
          title: historyItem.response.structure.title,
          highlight: historyItem.response.structure.highlight,
          ligand: historyItem.response.structure.ligand,
          ligandFullName: historyItem.response.structure.ligandFullName,
          resolution: historyItem.response.structure.resolution,
          method: historyItem.response.structure.method,
          isAlphaFold: historyItem.response.structure.isAlphaFold,
          bindingSite: historyItem.response.structure.bindingSite,
          mutations: historyItem.response.structure.mutations,
        };
      } else if (historyItem.pdb_id) {
        // Fallback: use top-level pdb_id from history record
        structureData = {
          pdbId: historyItem.pdb_id,
        };
      }

      // Add the assistant's response
      if (historyItem.response) {
        loadedMessages.push({
          id: nanoid(),
          role: "assistant",
          content: historyItem.response.text,
          structure: structureData,
          compareStructures: historyItem.response.compareStructures,
          sources: historyItem.response.sources,
          evidenceClaims: historyItem.response.evidenceClaims,
          timestamp: new Date(historyItem.created_at),
          metadata: historyItem.response.metadata
            ? {
                tokensUsed: historyItem.response.metadata.tokensUsed,
                executionTime: historyItem.response.metadata.executionTime,
                toolsCalled: historyItem.response.metadata.toolsCalled,
                intentRoute: historyItem.response.metadata.intentRoute,
                structureDecision:
                  historyItem.response.metadata.structureDecision,
              }
            : undefined,
        });
      }

      setTimeout(() => {
        setMessages(loadedMessages);
      }, 0);

      // Load the 3D structure through the same path as normal chat
      if (structureData) {
        // Small delay to ensure StructurePanel is mounted with 3Dmol script loading
        setTimeout(() => {
          handleStructureUpdate(structureData!);
        }, 100);
      }
    } catch (e) {
      console.error("Failed to load history item:", e);
    }
  }, [handleStructureUpdate]);

  const structureLimitReached = structures.length >= MAX_STRUCTURES;
  const hasStructures = structures.length > 0;

  const handleMessagesUpdate = useCallback((newMessages: Message[]) => {
    setMessages(newMessages);
  }, []);

  const handleStructureSelect = useCallback(
    (structureIndex: number) => {
      const index = structureIndex - 1;
      if (index < 0 || index >= structures.length) return;
      setSelectedStructureIndex(index);
      setActiveTab("viewer");
    },
    [structures.length],
  );

  const handleOpenCompare = useCallback(() => {
    if (structures.length < 2) return;
    setSelectedStructureIndex(undefined);
    setActiveTab("viewer");
    setCompareJumpToken((prev) => prev + 1);
  }, [structures.length]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasStructures && activeTab === "viewer") {
        setActiveTab("chat");
      }
      if (!hasStructures) {
        setSelectedStructureIndex(undefined);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [hasStructures, activeTab]);

  return (
    <AppLayout>
      <div
        style={{
          height: "100%",
          padding: "16px",
          overflow: "hidden",
          boxSizing: "border-box",
          width: "100%",
          maxWidth: "100%",
        }}
      >
        {/* Desktop layout: chat only by default, split view after structure is generated */}
        <div
          className="hidden lg:grid h-full gap-4"
          style={{
            gridTemplateColumns: hasStructures
              ? "minmax(0, 1fr) minmax(0, 1fr)"
              : "minmax(0, 1fr)",
            overflow: "hidden",
          }}
        >
          <div
            style={{ height: "100%", overflow: "hidden", minWidth: 0 }}
            className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl"
          >
            <ChatPanel
              key={chatSessionKey}
              onStructureUpdate={handleStructureUpdate}
              onStructureSelect={handleStructureSelect}
              onOpenCompare={handleOpenCompare}
              canOpenCompare={structures.length >= 2}
              messages={messages}
              onMessagesChange={handleMessagesUpdate}
              structureLimitReached={structureLimitReached}
            />
          </div>

          {hasStructures && (
            <div
              className={cn(
                "h-full min-w-0 bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden relative transition-all duration-500",
                structureJustLoaded &&
                  "ring-2 ring-[#13ec92] ring-offset-2 ring-offset-transparent",
              )}
            >
              {structureJustLoaded && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 animate-bounce">
                  <div className="bg-[#13ec92] text-black px-4 py-2 rounded-full text-sm font-medium shadow-lg backdrop-blur-md flex items-center gap-2">
                    <Box className="w-4 h-4" />
                    Structure loaded!
                  </div>
                </div>
              )}

              <StructurePanel
                structures={structures}
                newestIndex={newestIndex}
                selectedIndex={selectedStructureIndex}
                compareJumpToken={compareJumpToken}
              />
            </div>
          )}
        </div>

        {/* Mobile layout */}
        <div className="flex lg:hidden h-full flex-col gap-2">
          <div className="flex bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/[0.08] overflow-hidden">
            <button
              onClick={() => setActiveTab("chat")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium transition-all",
                hasStructures ? "rounded-l-2xl" : "rounded-2xl",
                activeTab === "chat"
                  ? "bg-white/[0.06] text-[#13ec92] border-b-2 border-[#13ec92]"
                  : "text-white/40 hover:text-white/60 hover:bg-white/[0.06]",
              )}
            >
              <MessageSquare className="w-4 h-4" />
              Chat
            </button>

            {hasStructures && (
              <button
                onClick={() => setActiveTab("viewer")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium transition-all relative rounded-r-2xl",
                  activeTab === "viewer"
                    ? "bg-white/[0.06] text-[#13ec92] border-b-2 border-[#13ec92]"
                    : "text-white/40 hover:text-white/60 hover:bg-white/[0.06]",
                  structureJustLoaded &&
                    activeTab !== "viewer" &&
                    "animate-pulse",
                )}
              >
                <Box className="w-4 h-4" />
                3D Viewer
                <span
                  className={cn(
                    "inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white rounded-full",
                    structureJustLoaded
                      ? "bg-gradient-to-r from-green-500 to-emerald-500 animate-bounce"
                      : "bg-[#13ec92]",
                  )}
                >
                  {structures.length}
                </span>
              </button>
            )}
          </div>

          <div className="flex-1 bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden relative">
            <div
              className="absolute inset-0"
              style={{
                zIndex: activeTab === "chat" ? 10 : 0,
                opacity: activeTab === "chat" ? 1 : 0,
                pointerEvents: activeTab === "chat" ? "auto" : "none",
              }}
            >
              <ChatPanel
                onStructureUpdate={handleStructureUpdate}
                onStructureSelect={handleStructureSelect}
                onOpenCompare={handleOpenCompare}
                canOpenCompare={structures.length >= 2}
                messages={messages}
                onMessagesChange={handleMessagesUpdate}
                structureLimitReached={structureLimitReached}
              />
            </div>

            {hasStructures && (
              <div
                className="absolute inset-0"
                style={{
                  zIndex: activeTab === "viewer" ? 10 : 0,
                  opacity: activeTab === "viewer" ? 1 : 0,
                  pointerEvents: activeTab === "viewer" ? "auto" : "none",
                }}
              >
                <StructurePanel
                  structures={structures}
                  newestIndex={newestIndex}
                  selectedIndex={selectedStructureIndex}
                  isActive={activeTab === "viewer"}
                  compareJumpToken={compareJumpToken}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
