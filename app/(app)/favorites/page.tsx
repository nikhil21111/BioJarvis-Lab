"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Favorite } from "@/types/database";
import { FavoritesList } from "@/components/favorites/FavoritesList";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Search } from "lucide-react";
import { toast } from "sonner";

function FavoritesContent() {
  const router = useRouter();
  const [items, setItems] = useState<Favorite[]>([]);
  const [filteredItems, setFilteredItems] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchFavorites();
  }, []);

  async function fetchFavorites() {
    try {
      const response = await fetch("/api/favorites");
      if (!response.ok) throw new Error("Failed to fetch favorites");
      const data = await response.json();
      setItems(data.favorites);
      setFilteredItems(data.favorites);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load favorites");
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(query: string) {
    setSearchQuery(query);
    if (!query) {
      setFilteredItems(items);
      return;
    }
    const filtered = items.filter(
      (item) =>
        item.query.toLowerCase().includes(query.toLowerCase()) ||
        (item.title &&
          item.title.toLowerCase().includes(query.toLowerCase())) ||
        (item.notes && item.notes.toLowerCase().includes(query.toLowerCase())),
    );
    setFilteredItems(filtered);
  }

  async function handleDelete(id: string) {
    try {
      const response = await fetch("/api/favorites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error("Failed to delete");

      setItems((prev) => prev.filter((item) => item.id !== id));
      setFilteredItems((prev) => prev.filter((item) => item.id !== id));

      toast.success("Removed from favorites");
    } catch {
      toast.error("Failed to remove from favorites");
    }
  }

  function handleSelect(item: Favorite) {
    // Navigate to dashboard with the query pre-filled
    router.push(`/dashboard?query=${encodeURIComponent(item.query)}`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0a0a0a]">
        <Loader2 className="w-8 h-8 animate-spin text-[#13ec92]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#0a0a0a] text-red-400">
        <AlertCircle className="w-12 h-12 mb-4" />
        <p>{error}</p>
        <Button
          onClick={fetchFavorites}
          className="mt-4 bg-[#13ec92] hover:bg-[#13ec92]/80 text-black"
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 gap-4 bg-[#0a0a0a]">
      {/* Header - Dark glass container */}
      <div className="p-4 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl">
        <h1 className="text-2xl font-bold text-white">Favorites</h1>
        <p className="text-white/40 text-sm mt-1">
          {items.length} saved queries
        </p>
      </div>

      {/* Search - Dark glass container */}
      <div className="p-4 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <Input
            type="text"
            placeholder="Search favorites..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10 bg-white/5 backdrop-blur-md border-white/10 text-white placeholder:text-white/30 focus:border-[#13ec92]/50 rounded-xl"
          />
        </div>
      </div>

      {/* Favorites list - Dark glass container */}
      <div className="flex-1 overflow-hidden bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl">
        <FavoritesList
          items={filteredItems}
          onSelect={handleSelect}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}

export default function FavoritesPage() {
  return (
    <AppLayout>
      <FavoritesContent />
    </AppLayout>
  );
}
