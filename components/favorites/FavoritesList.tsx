"use client";

import { Favorite } from "@/types/database";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { Star, Trash2, MessageSquare, ExternalLink } from "lucide-react";

interface FavoritesListProps {
  items: Favorite[];
  onSelect: (item: Favorite) => void;
  onDelete: (id: string) => void;
}

export function FavoritesList({
  items,
  onSelect,
  onDelete,
}: FavoritesListProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-white/30">
        <Star className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">No favorites yet</p>
        <p className="text-sm mt-1">Star queries to save them here</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="grid gap-4 p-4 sm:grid-cols-1 lg:grid-cols-2">
        {items.map((item) => (
          <Card
            key={item.id}
            className="p-4 cursor-pointer hover:bg-white/5 transition-all"
            onClick={() => onSelect(item)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {/* Title or query */}
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  <p className="font-medium text-white truncate">
                    {item.title || item.query}
                  </p>
                </div>

                {/* Notes if any */}
                {item.notes && (
                  <p className="text-sm text-white/50 mt-1 line-clamp-2">
                    {item.notes}
                  </p>
                )}

                {/* Query preview */}
                <p className="text-sm text-white/30 mt-2 line-clamp-2">
                  <MessageSquare className="w-3 h-3 inline mr-1" />
                  {item.query}
                </p>

                {/* Metadata */}
                <div className="flex items-center gap-4 mt-3 text-xs text-white/30">
                  <span>
                    Saved{" "}
                    {formatDistanceToNow(new Date(item.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                  {item.query_id && (
                    <span className="flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" />
                      Linked to history
                    </span>
                  )}
                </div>
              </div>

              {/* Delete button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item.id);
                }}
                className="h-8 w-8 text-white/30 hover:text-red-500"
                title="Remove from favorites"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
