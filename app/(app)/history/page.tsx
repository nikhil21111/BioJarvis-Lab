"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QueryHistory } from "@/types/database";
import { HistoryList } from "@/components/history/HistoryList";
import { HistorySearch } from "@/components/history/HistorySearch";
import { AppLayout } from "@/components/layout/AppLayout";
import { Loader2, AlertCircle, Trash2, Star } from "lucide-react";
import { toast } from "sonner";

type HistoryThread = {
  id: string;
  conversationId: string;
  created_at: string;
  updated_at: string;
  latestQuestion: string;
  latestResponseText: string;
  mcp_tools_used: string[];
  items: QueryHistory[];
};

function buildThreads(historyItems: QueryHistory[]): HistoryThread[] {
  const groups = new Map<string, QueryHistory[]>();
  const MAX_GAP_MS = 20 * 60 * 1000;
  const MAX_TURNS = 12;

  const byUser = new Map<string, QueryHistory[]>();
  for (const item of historyItems) {
    if (!byUser.has(item.user_id)) byUser.set(item.user_id, []);
    byUser.get(item.user_id)!.push(item);
  }

  for (const [userId, userItems] of byUser.entries()) {
    const sorted = [...userItems].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    let activeLegacyId: string | null = null;
    let activeLegacyLastTime = 0;
    let activeLegacyTurns = 0;

    for (const item of sorted) {
      const metadata = item.response?.metadata as
        | { conversationId?: string }
        | undefined;
      const persistedConversationId = metadata?.conversationId;

      let key: string;
      if (persistedConversationId) {
        key = persistedConversationId;
        activeLegacyId = null;
        activeLegacyTurns = 0;
      } else {
        const now = new Date(item.created_at).getTime();
        const canContinueLegacy =
          !!activeLegacyId &&
          now - activeLegacyLastTime <= MAX_GAP_MS &&
          activeLegacyTurns < MAX_TURNS;

        if (!canContinueLegacy) {
          activeLegacyId = `legacy_${userId.slice(0, 8)}_${now.toString(36)}`;
          activeLegacyTurns = 0;
        }

        key =
          activeLegacyId || `legacy_${userId.slice(0, 8)}_${now.toString(36)}`;
        activeLegacyLastTime = now;
        activeLegacyTurns += 1;
      }

      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
  }

  const threads: HistoryThread[] = [];
  for (const [conversationId, items] of groups.entries()) {
    const ordered = [...items].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const latest = ordered[ordered.length - 1];
    threads.push({
      id: latest.id,
      conversationId,
      created_at: ordered[0].created_at,
      updated_at: latest.created_at,
      latestQuestion: latest.question,
      latestResponseText: latest.response?.text || "",
      mcp_tools_used: latest.mcp_tools_used || [],
      items: ordered,
    });
  }

  return threads.sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

function HistoryContent() {
  const router = useRouter();
  const [items, setItems] = useState<QueryHistory[]>([]);
  const [threads, setThreads] = useState<HistoryThread[]>([]);
  const [filteredThreads, setFilteredThreads] = useState<HistoryThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedThread, setSelectedThread] = useState<HistoryThread | null>(
    null,
  );

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    try {
      const response = await fetch("/api/history");
      if (!response.ok) throw new Error("Failed to fetch history");
      const data = await response.json();
      const history = (data.history || []) as QueryHistory[];
      setItems(history);
      const grouped = buildThreads(history);
      setThreads(grouped);
      setFilteredThreads(grouped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(query: string) {
    if (!query) {
      setFilteredThreads(threads);
      return;
    }
    const filtered = threads.filter(
      (thread) =>
        thread.items.some(
          (item) =>
            item.question.toLowerCase().includes(query.toLowerCase()) ||
            (item.response?.text || "")
              .toLowerCase()
              .includes(query.toLowerCase()),
        ) || thread.latestQuestion.toLowerCase().includes(query.toLowerCase()),
    );
    setFilteredThreads(filtered);
  }

  function handleFilter(source: string | null) {
    if (!source) {
      setFilteredThreads(threads);
      return;
    }
    const filtered = threads.filter((thread) =>
      thread.items.some((item) =>
        (item.mcp_tools_used || [])
          .join(" ")
          .toLowerCase()
          .includes(source.toLowerCase()),
      ),
    );
    setFilteredThreads(filtered);
  }

  async function handleDeleteThread(thread: HistoryThread) {
    try {
      for (const item of thread.items) {
        const response = await fetch("/api/history", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id }),
        });
        if (!response.ok) throw new Error("Failed to delete");
      }

      const threadIds = new Set(thread.items.map((item) => item.id));
      const nextItems = items.filter((item) => !threadIds.has(item.id));
      setItems(nextItems);
      const nextThreads = buildThreads(nextItems);
      setThreads(nextThreads);
      setFilteredThreads(nextThreads);

      if (selectedThread?.conversationId === thread.conversationId) {
        setSelectedThread(null);
      }

      toast.success("Conversation deleted");
    } catch {
      toast.error("Failed to delete conversation");
    }
  }

  async function handleFavorite(thread: HistoryThread) {
    const latestItem = thread.items[thread.items.length - 1];
    try {
      const response = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: latestItem.question,
          queryId: latestItem.id,
        }),
      });
      if (!response.ok) throw new Error("Failed to add to favorites");
      toast.success("Added to favorites");
    } catch {
      toast.error("Failed to add to favorites");
    }
  }

  function handleSelect(thread: HistoryThread) {
    setSelectedThread(thread);
  }

  function handleOpenChat(thread: HistoryThread) {
    sessionStorage.setItem("loadHistoryThread", JSON.stringify(thread));
    router.push("/dashboard");
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#050505] gap-4">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
        <span className="mono-font text-[10px] uppercase tracking-widest text-white/20">
          Loading history...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#050505] gap-4">
        <AlertCircle className="w-8 h-8 text-red-400/60" />
        <p className="mono-font text-xs text-red-400/80">{error}</p>
        <button
          onClick={fetchHistory}
          className="glass-button px-6 py-2 mono-font text-xs uppercase tracking-wider text-white/60"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex gap-0 bg-[#050505]">
      <div className="film-grain"></div>

      {/* History list panel */}
      <div className="w-full lg:w-1/2 flex flex-col border-r border-white/[0.06]">
        {/* Header */}
        <div className="shrink-0 p-6 lg:p-8 border-b border-white/[0.06]">
          <div className="mono-font text-emerald-500 text-[10px] tracking-[0.4em] uppercase mb-2 flex items-center gap-4">
            <span className="editorial-line w-8"></span>
            Archive
          </div>
          <h1 className="text-3xl serif-font italic font-light text-white">
            Query History
          </h1>
          <p className="mono-font text-xs text-white/20 mt-2 uppercase tracking-widest">
            {threads.length} conversations
          </p>
        </div>

        {/* Search */}
        <HistorySearch onSearch={handleSearch} onFilter={handleFilter} />

        {/* List */}
        <div className="flex-1 overflow-hidden">
          <HistoryList
            items={filteredThreads}
            selectedId={selectedThread?.id}
            onSelect={handleSelect}
            onOpen={handleOpenChat}
            onDelete={handleDeleteThread}
            onFavorite={handleFavorite}
          />
        </div>
      </div>

      {/* Detail view */}
      <div className="hidden lg:flex lg:w-1/2 flex-col">
        {selectedThread ? (
          <div className="flex-1 overflow-auto p-8">
            <div className="mb-8">
              <div className="mono-font text-emerald-500 text-[10px] tracking-[0.4em] uppercase mb-4 flex items-center gap-4">
                <span className="editorial-line w-8"></span>
                Query Detail
              </div>
              <h2 className="text-xl font-light text-white serif-font italic leading-relaxed">
                {selectedThread.latestQuestion}
              </h2>
              <p className="mono-font text-[10px] text-white/20 mt-3 uppercase tracking-widest">
                {new Date(selectedThread.updated_at).toLocaleString()} ·{" "}
                {selectedThread.items.length} turns
              </p>
            </div>

            <div className="flex gap-3 mb-8">
              <button
                onClick={() => handleFavorite(selectedThread)}
                className="glass-button px-4 py-2 flex items-center gap-2 mono-font text-[10px] uppercase tracking-wider text-white/40 hover:text-emerald-500"
              >
                <Star className="w-3 h-3" />
                Save
              </button>
              <button
                onClick={() => handleDeleteThread(selectedThread)}
                className="glass-button px-4 py-2 flex items-center gap-2 mono-font text-[10px] uppercase tracking-wider text-white/40 hover:text-red-400"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
            </div>

            {/* Response */}
            <div className="chassis-module">
              <div className="chassis-header">
                <span className="mono-font text-[10px] uppercase tracking-widest text-white/30">
                  Response
                </span>
              </div>
              <div className="p-6">
                <div className="prose prose-invert prose-sm max-w-none text-white/60 leading-relaxed">
                  {(
                    selectedThread.items[selectedThread.items.length - 1]
                      .response?.text || ""
                  )
                    .split("\n")
                    .map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                </div>
              </div>
            </div>

            <button
              className="mt-8 w-full py-4 pill-button rounded-full mono-font text-xs uppercase tracking-widest font-bold"
              onClick={() => handleOpenChat(selectedThread)}
            >
              Continue Research →
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <span className="material-symbols-outlined text-white/10 text-5xl">
              science
            </span>
            <p className="mono-font text-[10px] uppercase tracking-widest text-white/15">
              Select a query to view details
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <AppLayout>
      <HistoryContent />
    </AppLayout>
  );
}
