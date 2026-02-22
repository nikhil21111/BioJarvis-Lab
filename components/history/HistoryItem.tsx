"use client";

import { HistoryThread } from "./HistoryList";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { Trash2, Star, MessageSquare, Database } from "lucide-react";
import { cn } from "@/lib/utils";

interface HistoryItemProps {
  item: HistoryThread;
  isSelected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onDelete: () => void;
  onFavorite: () => void;
}

export function HistoryItem({
  item,
  isSelected,
  onSelect,
  onOpen,
  onDelete,
  onFavorite,
}: HistoryItemProps) {
  // Parse data sources from response if available
  const dataSources = extractDataSources(item.mcp_tools_used || []);
  const responseText = item.latestResponseText || "";

  return (
    <Card
      className={cn(
        "p-3 cursor-pointer transition-all hover:bg-white/5",
        isSelected && "ring-2 ring-[#13ec92] bg-[#13ec92]/10",
      )}
      onClick={() => {
        onSelect();
        onOpen();
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Query text */}
          <p className="font-medium text-white truncate">
            {item.latestQuestion}
          </p>

          {/* Response preview */}
          <p className="text-sm text-white/50 line-clamp-2 mt-1">
            {responseText.slice(0, 150)}...
          </p>

          {/* Metadata */}
          <div className="flex items-center gap-4 mt-2 text-xs text-white/30">
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {item.items.length} turns ·{" "}
              {formatDistanceToNow(new Date(item.updated_at), {
                addSuffix: true,
              })}
            </span>
            {dataSources.length > 0 && (
              <span className="flex items-center gap-1">
                <Database className="w-3 h-3" />
                {dataSources.join(", ")}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div
          className="flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={onFavorite}
            className="h-8 w-8 text-white/30 hover:text-yellow-500"
            title="Add to favorites"
          >
            <Star className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="h-8 w-8 text-white/30 hover:text-red-500"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function extractDataSources(tools: string[]): string[] {
  const sources: string[] = [];
  const toolsStr = tools.join(" ").toLowerCase();
  if (toolsStr.includes("pdb")) {
    sources.push("PDB");
  }
  if (toolsStr.includes("chembl")) {
    sources.push("ChEMBL");
  }
  if (toolsStr.includes("uniprot")) {
    sources.push("UniProt");
  }
  if (toolsStr.includes("pubmed")) {
    sources.push("PubMed");
  }
  return sources;
}
