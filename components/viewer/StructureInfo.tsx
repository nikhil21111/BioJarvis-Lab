"use client";

import { ExternalLink, Target, Pill } from "lucide-react";

interface StructureInfoProps {
  pdbId: string;
  title: string;
  resolution: string;
  method: string;
  highlight?: string[];
  ligand?: string;
}

export function StructureInfo({
  pdbId,
  title,
  resolution,
  method,
  highlight,
  ligand,
}: StructureInfoProps) {
  return (
    <div className="bg-white border-t p-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-[#13ec92]">{pdbId}</span>
            <a
              href={`https://www.rcsb.org/structure/${pdbId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/30 hover:text-[#13ec92]"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
          <p className="text-sm text-white/50 truncate" title={title}>
            {title}
          </p>
          <div className="flex items-center gap-4 mt-1 text-xs text-white/30">
            <span>Resolution: {resolution}</span>
            <span>Method: {method}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1 text-xs">
          {highlight && highlight.length > 0 && (
            <div className="flex items-center gap-1 text-red-600">
              <Target className="w-3 h-3" />
              <span>Binding site: {highlight.join(", ")}</span>
            </div>
          )}
          {ligand && (
            <div className="flex items-center gap-1 text-green-600">
              <Pill className="w-3 h-3" />
              <span>Ligand: {ligand}</span>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 pt-2 border-t border-white/10 text-xs text-white/30">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>Binding residues</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>Drug/Ligand</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-gradient-to-r from-blue-500 via-green-500 to-red-500" />
          <span>N→C terminus</span>
        </div>
      </div>
    </div>
  );
}
