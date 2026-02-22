"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Script from "next/script";
import { StructureData } from "@/types/app";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  Box,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Camera,
  Atom,
  Layers,
  CircleDot,
  Waves,
  Play,
  Pause,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MoleculeViewerProps {
  structure: StructureData | null;
}

declare global {
  interface Window {
    $3Dmol: {
      createViewer: (element: HTMLElement, config?: object) => Viewer;
    };
  }
}

interface Viewer {
  addModel: (data: string, format: string) => object;
  setStyle: (selector: object, style: object) => void;
  setBackgroundColor: (color: string) => void;
  zoomTo: (selector?: object) => void;
  zoom: (factor: number) => void;
  rotate: (angle: number, axis: string) => void;
  spin: (enable: boolean | string) => void;
  render: () => void;
  clear: () => void;
  center: (selector?: object) => void;
  png: () => string;
  addSurface: (type: unknown, style: object, selector?: object) => void;
  removeAllSurfaces: () => void;
  addLabel: (text: string, options: object, selector?: object) => void;
  removeAllLabels: () => void;
  resize: () => void;
}

type ViewStyle = "cartoon" | "stick" | "sphere" | "surface";

const styleConfig: Record<
  ViewStyle,
  { icon: React.ElementType; label: string }
> = {
  cartoon: { icon: Layers, label: "Cartoon" },
  stick: { icon: Atom, label: "Stick" },
  sphere: { icon: CircleDot, label: "Sphere" },
  surface: { icon: Waves, label: "Surface" },
};

export function MoleculeViewer({ structure }: MoleculeViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerInstance = useRef<Viewer | null>(null);
  const loadedStructureRef = useRef<StructureData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [currentStyle, setCurrentStyle] = useState<ViewStyle>("cartoon");
  const [spinning, setSpinning] = useState(false);
  const [structureInfo, setStructureInfo] = useState<{
    title: string;
    resolution: string;
    method: string;
  } | null>(null);

  const loadStructure = useCallback(async (struct: StructureData) => {
    if (!viewerRef.current || !window.$3Dmol) return;

    setLoading(true);
    setError("");
    setStructureInfo(null);

    try {
      if (!viewerInstance.current) {
        viewerInstance.current = window.$3Dmol.createViewer(viewerRef.current, {
          backgroundColor: "0x1a1a2e",
          antialias: true,
        });
      }

      const viewer = viewerInstance.current;
      viewer.clear();

      // Determine file URL based on source (AlphaFold vs RCSB PDB)
      let structureUrl: string;
      let fileFormat: string;
      if (struct.isAlphaFold) {
        structureUrl = `https://alphafold.ebi.ac.uk/files/${struct.pdbId}-model_v4.cif`;
        fileFormat = "cif";
      } else {
        structureUrl = `https://files.rcsb.org/download/${struct.pdbId}.pdb`;
        fileFormat = "pdb";
      }

      const response = await fetch(structureUrl);
      if (!response.ok) {
        // Fallback to mmCIF if PDB fails
        if (fileFormat === "pdb") {
          const cifResponse = await fetch(
            `https://files.rcsb.org/download/${struct.pdbId}.cif`,
          );
          if (!cifResponse.ok) {
            throw new Error(`Structure ${struct.pdbId} not found`);
          }
          const cifData = await cifResponse.text();
          viewer.addModel(cifData, "cif");
        } else {
          throw new Error(`Structure ${struct.pdbId} not found`);
        }
      } else {
        const structData = await response.text();
        viewer.addModel(structData, fileFormat);
      }

      applyStyle(viewer, currentStyleRef.current);

      // Highlight binding site residues using proper residue numbers
      applyBindingSiteHighlight(viewer, struct);

      viewer.zoomTo();
      viewer.render();

      // Store the loaded structure so style changes can re-apply binding site
      loadedStructureRef.current = struct;

      // Set structure info from the structure data passed in (avoid duplicate fetch)
      if (struct.title) {
        setStructureInfo({
          title: struct.title,
          resolution: struct.resolution
            ? `${struct.resolution.toFixed(2)} Å`
            : struct.isAlphaFold
              ? "Predicted"
              : "N/A",
          method: struct.isAlphaFold
            ? "AlphaFold Prediction"
            : struct.method || "Unknown",
        });
      } else {
        // Fallback: fetch info from RCSB if not provided
        try {
          const infoResponse = await fetch(
            `https://data.rcsb.org/rest/v1/core/entry/${struct.pdbId}`,
          );
          if (infoResponse.ok) {
            const info = await infoResponse.json();
            setStructureInfo({
              title: info.struct?.title || "Unknown",
              resolution:
                info.rcsb_entry_info?.resolution_combined?.[0]?.toFixed(2) +
                  " Å" || "N/A",
              method: info.exptl?.[0]?.method || "Unknown",
            });
          }
        } catch {
          // Ignore info fetch errors
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load structure");
    } finally {
      setLoading(false);
    }
  }, []); // No dependency on currentStyle — style changes are handled separately

  // Ref to track current style without triggering loadStructure re-render
  const currentStyleRef = useRef<ViewStyle>(currentStyle);
  currentStyleRef.current = currentStyle;

  const applyStyle = (viewer: Viewer, style: ViewStyle) => {
    // Remove surfaces before changing style
    viewer.removeAllSurfaces();

    if (style === "surface") {
      // Surface uses addSurface() API, not setStyle()
      viewer.setStyle({}, { cartoon: { color: "spectrum", opacity: 0.5 } });
      viewer.addSurface("VDW", { opacity: 0.8, colorscheme: "whiteCarbon" });
    } else {
      const styles: Record<string, object> = {
        cartoon: { cartoon: { color: "spectrum" } },
        stick: { stick: { colorscheme: "Jmol", radius: 0.15 } },
        sphere: { sphere: { colorscheme: "Jmol", scale: 0.3 } },
      };
      viewer.setStyle({}, styles[style] || styles.cartoon);
    }
    // Always show HETATM atoms (ligands, cofactors, drugs) as sticks
    // so they remain visible in cartoon/surface modes where only
    // the protein backbone is rendered.
    viewer.setStyle(
      { hetflag: true, not: { resn: "HOH" } },
      {
        stick: { colorscheme: "Jmol", radius: 0.2 },
        ball: { colorscheme: "Jmol", scale: 0.3 },
      },
    );
    // Hide water molecules
    viewer.setStyle({ resn: "HOH" }, {});
    viewer.render();
  };

  // Re-apply binding site highlights without affecting zoom/focus
  const applyBindingSiteHighlight = (viewer: Viewer, struct: StructureData) => {
    if (!struct.bindingSite?.residues?.length) return;

    const residueNumbers = struct.bindingSite.residues.map((r) => r.number);
    const chainId = struct.bindingSite.residues[0]?.chain || "A";

    viewer.setStyle(
      { resi: residueNumbers, chain: chainId },
      { stick: { colorscheme: "orangeCarbon", radius: 0.2 } },
    );

    struct.bindingSite.residues.slice(0, 3).forEach((res) => {
      viewer.addLabel(
        `${res.name} ${res.number}`,
        {
          fontSize: 12,
          fontColor: "white",
          backgroundColor: "rgba(255, 100, 0, 0.7)",
          position: { x: 0, y: 0, z: 0 },
        },
        { resi: res.number, chain: res.chain, atom: "CA" },
      );
    });
  };

  useEffect(() => {
    if (structure && scriptLoaded) {
      loadStructure(structure);
    }
  }, [structure, scriptLoaded, loadStructure]);

  const handleStyleChange = (style: ViewStyle) => {
    setCurrentStyle(style);
    if (viewerInstance.current) {
      // Re-apply base style
      applyStyle(viewerInstance.current, style);
      // Re-apply binding site highlights so they survive style changes
      // This does NOT affect zoom/focus position
      if (loadedStructureRef.current) {
        viewerInstance.current.removeAllLabels();
        applyBindingSiteHighlight(
          viewerInstance.current,
          loadedStructureRef.current,
        );
        viewerInstance.current.render();
      }
    }
  };

  const handleZoom = (factor: number) => {
    viewerInstance.current?.zoom(factor);
    viewerInstance.current?.render();
  };

  const handleSpin = () => {
    if (viewerInstance.current) {
      viewerInstance.current.spin(spinning ? false : "y");
      setSpinning(!spinning);
    }
  };

  const handleReset = () => {
    viewerInstance.current?.zoomTo();
    viewerInstance.current?.render();
    setSpinning(false);
    viewerInstance.current?.spin(false);
  };

  const handleScreenshot = () => {
    if (viewerInstance.current) {
      const png = viewerInstance.current.png();
      const link = document.createElement("a");
      link.href = png;
      link.download = `${structure?.pdbId || "structure"}.png`;
      link.click();
    }
  };

  return (
    <div className="h-full flex flex-col">
      <Script
        src="https://3dmol.org/build/3Dmol-min.js"
        onLoad={() => setScriptLoaded(true)}
      />

      {/* Header */}
      <div className="shrink-0 p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-[#13ec92]/10 rounded-lg border border-[#13ec92]/20">
            <Box className="w-5 h-5 text-[#13ec92]" />
          </div>
          <div>
            <h2 className="font-semibold text-white">3D Structure Viewer</h2>
            <p className="text-xs text-white/40">
              {structure ? `PDB: ${structure.pdbId}` : "No structure loaded"}
            </p>
          </div>
        </div>

        {structure && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleScreenshot}
            className="text-white/40 hover:text-white hover:bg-white/10"
          >
            <Camera className="w-4 h-4 mr-2" />
            Screenshot
          </Button>
        )}
      </div>

      {/* Viewer container */}
      <div className="flex-1 relative">
        {!structure ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="relative mb-6">
                <div className="w-24 h-24 mx-auto bg-[#13ec92]/5 rounded-2xl flex items-center justify-center border border-white/10 backdrop-blur-sm">
                  <Box className="w-12 h-12 text-[#13ec92]/30" />
                </div>
                <div className="absolute -inset-4 bg-[#13ec92]/5 rounded-3xl blur-xl" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                No structure loaded
              </h3>
              <p className="text-sm text-white/40 max-w-xs">
                Ask a question about a drug or protein to visualize its 3D
                structure
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* 3D viewer */}
            <div
              ref={viewerRef}
              className="absolute inset-0"
              style={{ touchAction: "none" }}
            />

            {/* Loading overlay */}
            {loading && (
              <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-10">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-[#13ec92]/30 rounded-full" />
                    <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-[#13ec92] rounded-full animate-spin" />
                  </div>
                  <p className="text-[#13ec92]">Loading structure...</p>
                </div>
              </div>
            )}

            {/* Error overlay */}
            {error && (
              <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-10">
                <div className="flex flex-col items-center gap-4 text-center px-6">
                  <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-red-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white mb-1">
                      Failed to load structure
                    </h3>
                    <p className="text-sm text-red-300/70">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Style controls */}
            <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
              {(Object.keys(styleConfig) as ViewStyle[]).map((style) => {
                const { icon: Icon, label } = styleConfig[style];
                return (
                  <Button
                    key={style}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStyleChange(style)}
                    className={cn(
                      "justify-start backdrop-blur-sm border transition-all",
                      currentStyle === style
                        ? "bg-[#13ec92]/20 border-[#13ec92]/40 text-white"
                        : "bg-black/30 border-white/10 text-white/40 hover:text-white hover:bg-white/10",
                    )}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {label}
                  </Button>
                );
              })}
            </div>

            {/* Zoom and control buttons */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleZoom(1.2)}
                className="bg-black/30 backdrop-blur-sm border border-white/10 text-white/40 hover:text-white hover:bg-white/10"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleZoom(0.8)}
                className="bg-black/30 backdrop-blur-sm border border-white/10 text-white/40 hover:text-white hover:bg-white/10"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSpin}
                className={cn(
                  "backdrop-blur-sm border transition-all",
                  spinning
                    ? "bg-[#13ec92]/20 border-[#13ec92]/40 text-white"
                    : "bg-black/30 border-white/10 text-white/40 hover:text-white hover:bg-white/10",
                )}
              >
                {spinning ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleReset}
                className="bg-black/30 backdrop-blur-sm border border-white/10 text-white/40 hover:text-white hover:bg-white/10"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>

            {/* Structure info panel */}
            {structureInfo && (
              <div className="absolute bottom-4 left-4 right-4 z-10">
                <div className="bg-black/50 backdrop-blur-md rounded-xl border border-white/10 p-4">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-10 h-10 bg-[#13ec92]/10 rounded-lg flex items-center justify-center">
                      <Info className="w-5 h-5 text-[#13ec92]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white text-sm mb-1 line-clamp-2">
                        {structureInfo.title}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-[#13ec92]/20 text-[#13ec92] border border-[#13ec92]/30">
                          {structureInfo.resolution}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-white/10 text-white/60 border border-white/20">
                          {structureInfo.method}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
