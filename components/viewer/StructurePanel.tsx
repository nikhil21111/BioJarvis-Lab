"use client";

import { useRef, useEffect, useState } from "react";
import Script from "next/script";
import { StructureData } from "@/types/app";
import { MoleculeViewerCard } from "./MoleculeViewerCard";
import { PocketComparisonPanel } from "./PocketComparisonPanel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Box, Layers } from "lucide-react";

type WindowWith3Dmol = Window & { $3Dmol?: unknown };

interface StructurePanelProps {
  structures: StructureData[];
  newestIndex?: number; // index of the most recently added structure
  selectedIndex?: number; // index selected from chat message structure card
  isActive?: boolean; // true when visible on mobile tab
  compareJumpToken?: number;
}

export function StructurePanel({
  structures,
  newestIndex,
  selectedIndex,
  isActive,
  compareJumpToken,
}: StructurePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(() =>
    typeof window !== "undefined"
      ? Boolean((window as WindowWith3Dmol).$3Dmol)
      : false,
  );
  const [clearFocusSignal, setClearFocusSignal] = useState(0);
  const [residueFocusRequest, setResidueFocusRequest] = useState<{
    structureIndex: number;
    residueNumber: number;
    chain?: string;
    source?: "A-only" | "B-only";
    requestId: number;
  } | null>(null);
  const comparePanelRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(structures.length);

  const scrollToStructureCard = (index: number) => {
    const panel = panelRef.current;
    if (!panel) return;

    const target = panel.querySelector(
      `#structure-card-${index}`,
    ) as HTMLElement | null;
    if (!target) return;

    const viewport = target.closest(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement | null;

    if (viewport) {
      const targetRect = target.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      const top = targetRect.top - viewportRect.top + viewport.scrollTop - 12;
      viewport.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Robust script detection: Next.js Script onLoad only fires once.
  // If the component remounts, we need to detect that $3Dmol is already loaded.
  useEffect(() => {
    if (scriptLoaded) return;
    // Poll for it in case the script is still loading
    const interval = setInterval(() => {
      if (typeof window !== "undefined" && (window as WindowWith3Dmol).$3Dmol) {
        setScriptLoaded(true);
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [scriptLoaded]);

  // Auto-scroll to the newest structure when added
  useEffect(() => {
    if (structures.length > prevCountRef.current) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 200);
    }
    prevCountRef.current = structures.length;
  }, [structures.length]);

  // Scroll to a structure selected from the chat message card
  useEffect(() => {
    if (selectedIndex === undefined || selectedIndex < 0) return;
    if (selectedIndex >= structures.length) return;

    // On mobile, viewer tab may need a tick to mount and become visible
    setTimeout(() => scrollToStructureCard(selectedIndex), isActive ? 80 : 150);
  }, [selectedIndex, structures.length, isActive]);

  useEffect(() => {
    if (!residueFocusRequest) return;
    if (residueFocusRequest.structureIndex < 0) return;
    if (residueFocusRequest.structureIndex >= structures.length) return;

    setTimeout(
      () => scrollToStructureCard(residueFocusRequest.structureIndex),
      isActive ? 80 : 150,
    );
  }, [residueFocusRequest, structures.length, isActive]);

  useEffect(() => {
    if (!compareJumpToken) return;
    if (structures.length < 2) return;

    const resetTimer = setTimeout(() => {
      setResidueFocusRequest(null);
      setClearFocusSignal((prev) => prev + 1);
    }, 0);

    const scrollToCompare = () => {
      comparePanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    };
    const scrollTimer = setTimeout(scrollToCompare, isActive ? 80 : 150);

    return () => {
      clearTimeout(resetTimer);
      clearTimeout(scrollTimer);
    };
  }, [compareJumpToken, structures.length, isActive]);

  return (
    <div ref={panelRef} className="h-full flex flex-col">
      <Script
        src="https://3dmol.org/build/3Dmol-min.js"
        onLoad={() => setScriptLoaded(true)}
      />

      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-white/10 flex items-center justify-between bg-[#0a0a0a]/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 bg-[#13ec92]/10 rounded-lg border border-[#13ec92]/20">
            <Layers className="w-4.5 h-4.5 text-[#13ec92]" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-200 text-sm">
              3D Structures
            </h2>
            <p className="text-xs text-white/40">
              {structures.length === 0
                ? "No structures loaded"
                : `${structures.length} structure${structures.length > 1 ? "s" : ""} loaded`}
            </p>
          </div>
        </div>

        {structures.length > 1 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#13ec92]/10 border border-[#13ec92]/20">
            <Box className="w-3 h-3 text-[#13ec92]" />
            <span className="text-xs font-medium text-[#13ec92]">
              {structures.length}/5
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {structures.length === 0 ? (
          /* Empty state */
          <div className="h-full flex items-center justify-center">
            <div className="text-center px-6">
              <div className="relative mb-6">
                <div className="w-20 h-20 mx-auto bg-[#13ec92]/5 rounded-2xl flex items-center justify-center border border-[#13ec92]/10">
                  <Box className="w-10 h-10 text-[#13ec92]/30" />
                </div>
                <div className="absolute -inset-4 bg-[#13ec92]/5 rounded-3xl blur-xl" />
              </div>
              <h3 className="text-base font-medium text-slate-300 mb-2">
                No structure loaded
              </h3>
              <p className="text-sm text-white/40 max-w-xs">
                Ask a question about a drug or protein to visualize its 3D
                structure
              </p>
            </div>
          </div>
        ) : (
          /* Structure cards — vertical scroll */
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {structures.length >= 2 && (
                <div ref={comparePanelRef}>
                  <PocketComparisonPanel
                    structures={structures}
                    onFocusResidue={({
                      structureIndex,
                      residueNumber,
                      chain,
                      source,
                    }) =>
                      setResidueFocusRequest({
                        structureIndex,
                        residueNumber,
                        chain,
                        source,
                        requestId: Date.now(),
                      })
                    }
                  />
                </div>
              )}

              {structures.map((structure, i) => (
                <div id={`structure-card-${i}`} key={`${structure.pdbId}-${i}`}>
                  <MoleculeViewerCard
                    structure={structure}
                    index={i + 1}
                    scriptLoaded={scriptLoaded}
                    isNew={newestIndex !== undefined && i === newestIndex}
                    isActive={isActive}
                    focusResidueRequest={
                      residueFocusRequest?.structureIndex === i
                        ? residueFocusRequest
                        : undefined
                    }
                    clearFocusSignal={clearFocusSignal}
                  />
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
