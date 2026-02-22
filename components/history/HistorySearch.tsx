"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Filter } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HistorySearchProps {
  onSearch: (query: string) => void;
  onFilter: (source: string | null) => void;
}

export function HistorySearch({ onSearch, onFilter }: HistorySearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  function handleSearch(value: string) {
    setSearchQuery(value);
    onSearch(value);
  }

  function handleClear() {
    setSearchQuery("");
    onSearch("");
  }

  function handleFilter(source: string | null) {
    setActiveFilter(source);
    onFilter(source);
  }

  const dataSources = ["PDB", "ChEMBL", "UniProt", "PubMed"];

  return (
    <div className="flex items-center gap-2 p-4 border-b border-white/10">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
        <Input
          type="text"
          placeholder="Search history..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#13ec92]/50"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-white/30 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={activeFilter ? "default" : "outline"}
            size="icon"
            className={
              activeFilter
                ? "h-10 w-10 bg-[#13ec92] hover:bg-[#13ec92]/80 text-black"
                : "h-10 w-10 bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white"
            }
          >
            <Filter className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="bg-slate-900 border-white/10"
        >
          <DropdownMenuItem
            onClick={() => handleFilter(null)}
            className="text-white/70 focus:bg-white/10 focus:text-white"
          >
            All Sources
          </DropdownMenuItem>
          {dataSources.map((source) => (
            <DropdownMenuItem
              key={source}
              onClick={() => handleFilter(source)}
              className="text-white/70 focus:bg-white/10 focus:text-white"
            >
              {source}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
