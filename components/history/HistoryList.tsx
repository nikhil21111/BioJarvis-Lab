"use client";

import { QueryHistory } from "@/types/database";
import { HistoryItem } from "./HistoryItem";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History } from "lucide-react";

export type HistoryThread = {
  id: string;
  conversationId: string;
  created_at: string;
  updated_at: string;
  latestQuestion: string;
  latestResponseText: string;
  mcp_tools_used: string[];
  items: QueryHistory[];
};

interface HistoryListProps {
  items: HistoryThread[];
  selectedId?: string;
  onSelect: (thread: HistoryThread) => void;
  onOpen: (thread: HistoryThread) => void;
  onDelete: (thread: HistoryThread) => void;
  onFavorite: (thread: HistoryThread) => void;
}

export function HistoryList({
  items,
  selectedId,
  onSelect,
  onOpen,
  onDelete,
  onFavorite,
}: HistoryListProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-white/30">
        <History className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">No history yet</p>
        <p className="text-sm mt-1">Your queries will appear here</p>
      </div>
    );
  }

  // Group items by date
  const groupedItems = items.reduce(
    (groups, item) => {
      const date = new Date(item.created_at).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(item);
      return groups;
    },
    {} as Record<string, HistoryThread[]>,
  );

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-4">
        {Object.entries(groupedItems).map(([date, dateItems]) => (
          <div key={date}>
            <h3 className="text-sm font-medium text-white/30 mb-2">{date}</h3>
            <div className="space-y-2">
              {dateItems.map((item) => (
                <HistoryItem
                  key={item.id}
                  item={item}
                  isSelected={item.id === selectedId}
                  onSelect={() => onSelect(item)}
                  onOpen={() => onOpen(item)}
                  onDelete={() => onDelete(item)}
                  onFavorite={() => onFavorite(item)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
