"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  StructureData,
  StructureAnnotation,
  ANNOTATION_COLORS,
} from "@/types/app";
import { AnnotationCards } from "./AnnotationCards";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  Box,
  ShieldCheck,
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
  Maximize2,
  Minimize2,
  Link2,
  Zap,
  Thermometer,
  Droplets,
  Ruler,
  FileDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Viewer {
  addModel: (data: string, format: string) => object;
  setStyle: (selector: object, style: object) => void;
  setBackgroundColor: (color: string) => void;
  zoomTo: (selector?: object, animationDuration?: number) => void;
  zoom: (factor: number) => void;
  rotate: (angle: number, axis: string) => void;
  spin: (enable: boolean | string) => void;
  render: () => void;
  clear: () => void;
  center: (selector?: object) => void;
  addSurface: (type: unknown, style: object, selector?: object) => void;
  removeAllSurfaces: () => void;
  addLabel: (text: string, options: object, selector?: object) => void;
  removeAllLabels: () => void;
  resize: () => void;
  selectedAtoms: (selector: object) => any[];
  addCylinder: (spec: object) => void;
  removeAllShapes: () => void;
  setClickable: (
    selector: object,
    clickable: boolean,
    callback?: (atom: any, viewer?: any, event?: any, container?: any) => void,
  ) => void;
}

type ViewStyle = "cartoon" | "stick" | "sphere" | "surface";

const styleIcons: Record<
  ViewStyle,
  { icon: React.ElementType; label: string }
> = {
  cartoon: { icon: Layers, label: "Cartoon" },
  stick: { icon: Atom, label: "Stick" },
  sphere: { icon: CircleDot, label: "Sphere" },
  surface: { icon: Waves, label: "Surface" },
};

interface MoleculeViewerCardProps {
  structure: StructureData;
  index: number;
  scriptLoaded: boolean;
  isNew?: boolean;
  isActive?: boolean;
  clearFocusSignal?: number;
  focusResidueRequest?: {
    structureIndex: number;
    residueNumber: number;
    chain?: string;
    source?: "A-only" | "B-only";
    requestId: number;
  };
}

export function MoleculeViewerCard({
  structure,
  index,
  scriptLoaded,
  isNew,
  isActive,
  clearFocusSignal,
  focusResidueRequest,
}: MoleculeViewerCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerInstance = useRef<Viewer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentStyle, setCurrentStyle] = useState<ViewStyle>("cartoon");
  const currentStyleRef = useRef<ViewStyle>("cartoon");
  const [spinning, setSpinning] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showProvenancePanel, setShowProvenancePanel] = useState(false);
  const [showProvenanceDetails, setShowProvenanceDetails] = useState(false);
  const [structureInfo, setStructureInfo] = useState<{
    title: string;
    resolution: string;
    method: string;
  } | null>(null);
  const [annotations, setAnnotations] = useState<StructureAnnotation[]>([]);
  const [focusedAnnotationId, setFocusedAnnotationId] = useState<string | null>(
    null,
  );
  const [showHBonds, setShowHBonds] = useState(false);
  const [showSaltBridges, setShowSaltBridges] = useState(false);
  const [showBFactor, setShowBFactor] = useState(false);
  const [showHydrophobic, setShowHydrophobic] = useState(false);

  // Surface coloring mode
  type SurfaceMode = "default" | "electrostatic" | "hydrophobic" | "bfactor";
  const [surfaceMode, setSurfaceMode] = useState<SurfaceMode>("default");
  const surfaceModeRef = useRef<SurfaceMode>("default");

  // Interaction statistics — populated by toggle functions
  const [interactionStats, setInteractionStats] = useState<{
    hbonds: {
      total: number;
      backbone: number;
      sidechain: number;
      protLig: number;
    } | null;
    saltBridges: number | null;
    hydrophobic: number | null;
  }>({ hbonds: null, saltBridges: null, hydrophobic: null });

  // Distance measurement state
  const [measuringDistance, setMeasuringDistance] = useState(false);
  const [distanceAtoms, setDistanceAtoms] = useState<any[]>([]);
  const [measuredDistance, setMeasuredDistance] = useState<number | null>(null);
  const measureAtomsRef = useRef<any[]>([]);
  const lastClearFocusSignalRef = useRef<number | undefined>(undefined);
  const [focusedResidueHint, setFocusedResidueHint] = useState<string | null>(
    null,
  );

  // ──────────────────────────────────────────────────────────────
  // Druggability score — heuristic based on binding pocket properties
  // Score 0-100: considers pocket size, hydrophobicity, enclosure
  // ──────────────────────────────────────────────────────────────
  const druggabilityScore = useMemo(() => {
    if (
      !structure.bindingSite ||
      !structure.bindingSite.residues ||
      structure.bindingSite.residues.length === 0
    ) {
      return null;
    }
    const residues = structure.bindingSite.residues;
    const n = residues.length;

    // Factor 1: Pocket size (ideal 10-30 residues)
    let sizeScore: number;
    if (n >= 10 && n <= 30) sizeScore = 100;
    else if (n < 10) sizeScore = (n / 10) * 80;
    else if (n <= 50) sizeScore = 100 - ((n - 30) / 20) * 30;
    else sizeScore = 40;

    // Factor 2: Hydrophobic ratio (druggable pockets tend to be 40-60% hydrophobic)
    const hydrophobicResidues = [
      "ALA",
      "VAL",
      "LEU",
      "ILE",
      "PHE",
      "TRP",
      "MET",
      "PRO",
    ];
    const hpCount = residues.filter((r: any) =>
      hydrophobicResidues.includes(r.name),
    ).length;
    const hpRatio = hpCount / n;
    let hpScore: number;
    if (hpRatio >= 0.35 && hpRatio <= 0.65) hpScore = 100;
    else if (hpRatio < 0.35) hpScore = (hpRatio / 0.35) * 70;
    else hpScore = Math.max(40, 100 - ((hpRatio - 0.65) / 0.35) * 60);

    // Factor 3: Charged residue presence (some charge is good for specificity)
    const chargedResidues = ["ASP", "GLU", "LYS", "ARG", "HIS"];
    const chargedCount = residues.filter((r: any) =>
      chargedResidues.includes(r.name),
    ).length;
    const chargedRatio = chargedCount / n;
    const chargeScore = chargedRatio >= 0.1 && chargedRatio <= 0.4 ? 90 : 60;

    // Factor 4: Has a ligand already bound (strong signal)
    const ligandBonus = structure.ligand ? 15 : 0;

    // Weighted average
    const raw =
      sizeScore * 0.3 + hpScore * 0.35 + chargeScore * 0.15 + ligandBonus;
    return Math.min(100, Math.round(raw));
  }, [structure]);

  const druggabilityLabel = useMemo(() => {
    if (druggabilityScore === null) return null;
    if (druggabilityScore >= 75)
      return {
        text: "High",
        color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
      };
    if (druggabilityScore >= 50)
      return {
        text: "Medium",
        color: "text-amber-400 bg-amber-500/15 border-amber-500/30",
      };
    return {
      text: "Low",
      color: "text-red-400 bg-red-500/15 border-red-500/30",
    };
  }, [druggabilityScore]);

  const provenanceItems = useMemo(() => {
    const provenance = structure.annotationProvenance;

    const items = [
      {
        key: "structure",
        label: "Structure",
        confidence: provenance?.structureConfidence,
        evidence:
          provenance?.structureEvidence ||
          (structure.isAlphaFold
            ? "Predicted model mapped from AlphaFold/PDB"
            : "Experimental structure from PDB"),
      },
      {
        key: "binding",
        label: "Binding Site",
        confidence: provenance?.bindingSiteConfidence,
        evidence:
          provenance?.bindingSiteEvidence ||
          (structure.bindingSite?.source === "uniprot-fallback"
            ? "Fallback from UniProt feature/domain mapping"
            : structure.bindingSite?.residues?.length
              ? "Binding residues from PDB/PDBe annotations"
              : undefined),
      },
      {
        key: "mutation",
        label: "Mutations",
        confidence: provenance?.mutationConfidence,
        evidence:
          provenance?.mutationEvidence ||
          (structure.mutations?.length
            ? "Mutation annotations from curated variant sources"
            : undefined),
      },
      {
        key: "ligand",
        label: "Ligand",
        confidence: provenance?.ligandConfidence,
        evidence:
          provenance?.ligandEvidence ||
          (structure.ligand
            ? `${structure.ligandFullName || structure.ligand} mapped to this structure`
            : undefined),
      },
    ].filter((item) => item.evidence);

    const confidenceCount = items.filter((item) => item.confidence).length;
    return {
      items,
      confidenceCount,
    };
  }, [structure]);

  const structureReliabilityHint = useMemo(() => {
    if (structure.isAlphaFold) {
      return {
        toneClass: "border-amber-500/25 bg-amber-500/10 text-amber-200",
        label: "Predicted structure",
        note: "Use for hypothesis generation; verify critical claims against experimental structures/literature.",
      };
    }

    if (structure.bindingSite?.source === "uniprot-fallback") {
      return {
        toneClass: "border-sky-500/25 bg-sky-500/10 text-sky-200",
        label: "Experimental structure + inferred pocket",
        note: "Structure is experimental, but binding site uses UniProt fallback mapping.",
      };
    }

    return {
      toneClass: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
      label: "Experimental structure",
      note: "Direct PDB/PDBe-derived structural context with higher interpretability confidence.",
    };
  }, [structure.isAlphaFold, structure.bindingSite?.source]);

  currentStyleRef.current = currentStyle;

  // Apply base molecular representation style.
  // skipRender: when true, skips the final viewer.render() so the caller
  // can layer annotation styles on top before rendering once.
  const applyStyle = useCallback(
    (viewer: Viewer, style: ViewStyle, skipRender = false) => {
      viewer.removeAllSurfaces();
      if (style === "surface") {
        viewer.setStyle({}, { cartoon: { color: "spectrum", opacity: 0.5 } });
        // Apply surface coloring based on surfaceMode
        const mode = surfaceModeRef.current;
        if (mode === "electrostatic") {
          // Charge-based coloring: red (negative, ASP/GLU) → white → blue (positive, LYS/ARG/HIS)
          viewer.addSurface("VDW", {
            opacity: 0.85,
            colorfunc: (atom: any) => {
              const neg = ["ASP", "GLU"];
              const pos = ["LYS", "ARG", "HIS"];
              if (neg.includes(atom.resn)) return "red";
              if (pos.includes(atom.resn)) return "blue";
              return "white";
            },
          });
        } else if (mode === "hydrophobic") {
          // Hydrophobicity coloring: orange (hydrophobic) → cyan (hydrophilic)
          viewer.addSurface("VDW", {
            opacity: 0.85,
            colorfunc: (atom: any) => {
              const hp = [
                "ALA",
                "VAL",
                "LEU",
                "ILE",
                "PHE",
                "TRP",
                "MET",
                "PRO",
              ];
              const polar = ["SER", "THR", "ASN", "GLN", "TYR", "CYS"];
              const charged = ["ASP", "GLU", "LYS", "ARG", "HIS"];
              if (hp.includes(atom.resn)) return "#E8860C";
              if (polar.includes(atom.resn)) return "#6ECFCF";
              if (charged.includes(atom.resn)) return "#4EA4F0";
              return "#CCCCCC";
            },
          });
        } else if (mode === "bfactor") {
          // Temperature factor: blue (low/rigid) → red (high/flexible)
          viewer.addSurface("VDW", {
            opacity: 0.85,
            colorfunc: (atom: any) => {
              const b = atom.b || 0;
              if (b < 20) return "#3B82F6";
              if (b < 40) return "#22C55E";
              if (b < 60) return "#EAB308";
              if (b < 80) return "#F97316";
              return "#EF4444";
            },
          });
        } else {
          viewer.addSurface("VDW", {
            opacity: 0.8,
            colorscheme: "whiteCarbon",
          });
        }
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
      if (!skipRender) {
        viewer.render();
      }
    },
    [],
  );

  // Build annotation objects from structure data
  const buildAnnotations = useCallback(
    (struct: StructureData): StructureAnnotation[] => {
      const built: StructureAnnotation[] = [];

      // 1. Binding site annotation
      if (struct.bindingSite?.residues?.length) {
        const bindingConfidence =
          struct.annotationProvenance?.bindingSiteConfidence ||
          (struct.bindingSite.source === "pdb" ? "high" : "medium");
        const bindingEvidence =
          struct.annotationProvenance?.bindingSiteEvidence ||
          (struct.bindingSite.source === "pdb"
            ? "PDB/PDBe binding-site residues"
            : struct.bindingSite.source === "uniprot-fallback"
              ? "UniProt feature fallback"
              : undefined);
        built.push({
          id: `${struct.pdbId}-binding`,
          type: "binding-site",
          label: struct.bindingSite.name || "Binding Site",
          description: `${struct.bindingSite.residues.length} residues form the binding pocket${struct.ligand ? ` for ${struct.ligand}` : ""}`,
          confidence: bindingConfidence,
          evidence: bindingEvidence,
          isInferred: struct.bindingSite.source === "uniprot-fallback",
          color: ANNOTATION_COLORS["binding-site"],
          residues: struct.bindingSite.residues,
          isVisible: true,
        });
      }

      // 2. Ligand annotation
      if (struct.ligand) {
        // Derive the chain from binding site residues so we target a single
        // ligand instance instead of averaging across all chains in a multimer
        const ligandChain = struct.bindingSite?.residues?.find(
          (r) => !!r.chain,
        )?.chain;
        built.push({
          id: `${struct.pdbId}-ligand`,
          type: "ligand",
          label: struct.ligandFullName || struct.ligand,
          description: `Drug/ligand molecule (${struct.ligand}) present in the crystal structure`,
          confidence: struct.annotationProvenance?.ligandConfidence || "high",
          evidence:
            struct.annotationProvenance?.ligandEvidence ||
            "Ligand record from structure model",
          color: ANNOTATION_COLORS["ligand"],
          residues: [],
          ligandName: struct.ligand,
          ligandChain,
          isVisible: true,
        });
      }

      // 3. Mutation annotations (grouped in one card with multiple tags)
      // Note: mutations are pre-filtered in loadStructure to only include
      // positions that exist in the PDB model
      if (struct.mutations?.length) {
        const mutationTag = (mut: {
          original?: string;
          position?: number;
          mutated?: string;
          label?: string;
        }) => {
          const fallback =
            `${mut.original || ""}${mut.position || ""}${mut.mutated || ""}`.trim();
          const raw = (mut.label || "").trim();
          const canonicalPattern = /^[A-Z]\d+[A-Z]$/;
          if (canonicalPattern.test(raw)) return raw;
          if (canonicalPattern.test(fallback)) return fallback;
          return raw || fallback || `Mut${mut.position || ""}`;
        };

        const mutationConfidence =
          struct.annotationProvenance?.mutationConfidence ||
          (struct.mutations.some(
            (m: any) => m.clinicalSignificance || m.diseaseAssociation,
          )
            ? "high"
            : "low");

        const mutationLabels = struct.mutations.map((mut) => mutationTag(mut));
        const uniquePositionCount = new Set(
          struct.mutations.map((mut) => mut.position),
        ).size;
        let description =
          mutationLabels.length > 6
            ? `Grouped mutation sites: ${mutationLabels.slice(0, 6).join(", ")} +${mutationLabels.length - 6} more.`
            : `Grouped mutation sites: ${mutationLabels.join(", ")}.`;
        if (uniquePositionCount < struct.mutations.length) {
          description +=
            " Some variants share the same residue position (alternative substitutions at one site).";
        }

        const mutationResidues = struct.mutations.map((mut) => {
          const mutChain =
            struct.bindingSite?.residues?.find(
              (res) => res.number === mut.position && !!res.chain,
            )?.chain ||
            struct.bindingSite?.residues?.find((res) => !!res.chain)?.chain;

          return {
            chain: mutChain,
            number: mut.position,
            name: mutationTag(mut),
          };
        });

        const mutationDetails = struct.mutations
          .map((mut) => {
            const tag = mutationTag(mut);
            const bindingResidue = struct.bindingSite?.residues?.find(
              (res) => res.number === mut.position,
            );
            const chain =
              bindingResidue?.chain ||
              struct.bindingSite?.residues?.find((res) => !!res.chain)?.chain;

            return {
              tag,
              position: mut.position,
              chain,
              original: mut.original,
              mutated: mut.mutated,
              clinicalSignificance: (mut as any).clinicalSignificance,
              diseaseAssociation: (mut as any).diseaseAssociation,
              evidenceTier: (mut as any).evidenceTier,
              inBindingPocket: Boolean(bindingResidue),
              distanceToLigand: bindingResidue?.distance,
            };
          })
          .sort((a, b) => {
            const riskScore = (detail: {
              clinicalSignificance?: string;
              diseaseAssociation?: string;
            }) => {
              const text =
                `${detail.clinicalSignificance || ""} ${detail.diseaseAssociation || ""}`.toLowerCase();
              if (
                text.includes("pathogenic") ||
                text.includes("drug resistance") ||
                text.includes("resistance") ||
                text.includes("oncogenic")
              ) {
                return 3;
              }
              if (
                text.includes("likely pathogenic") ||
                text.includes("risk factor") ||
                text.includes("association") ||
                text.includes("uncertain")
              ) {
                return 2;
              }
              return 1;
            };

            const riskDelta = riskScore(b) - riskScore(a);
            if (riskDelta !== 0) return riskDelta;

            const pocketDelta =
              Number(b.inBindingPocket) - Number(a.inBindingPocket);
            if (pocketDelta !== 0) return pocketDelta;

            return a.position - b.position;
          });

        built.push({
          id: `${struct.pdbId}-mutations`,
          type: "mutation",
          label: "Mutation Sites",
          description,
          confidence: mutationConfidence,
          evidence: struct.annotationProvenance?.mutationEvidence,
          isInferred: mutationConfidence === "low",
          color: ANNOTATION_COLORS["mutation"],
          residues: mutationResidues,
          mutationDetails,
          isVisible: true,
        });
      }

      return built;
    },
    [],
  );

  // Apply annotation highlighting on the 3Dmol viewer.
  // IMPORTANT: This ONLY applies annotation overlays (binding sites, ligands,
  // mutations) on top of whatever base style is already set.
  // It does NOT reset the base style or call zoomTo — so it will never
  // affect the current camera/focus position.
  //
  // All residue positions are validated against the loaded PDB model before
  // rendering — any residue not found in the structure is silently skipped
  // to prevent labels floating at (0,0,0) outside the molecule.
  const applyAnnotations = useCallback(
    (viewer: Viewer, annotationList: StructureAnnotation[]) => {
      // Clear old labels before re-adding
      viewer.removeAllLabels();

      const resolveResidueChain = (resi: number, preferredChain?: string) => {
        if (preferredChain) {
          const preferredAtoms = viewer.selectedAtoms({
            resi,
            chain: preferredChain,
          });
          if (preferredAtoms && preferredAtoms.length > 0) {
            return preferredChain;
          }
        }
        const atoms = viewer.selectedAtoms({ resi, atom: "CA" });
        if (atoms && atoms.length > 0 && atoms[0]?.chain) {
          return atoms[0].chain as string;
        }
        const anyAtoms = viewer.selectedAtoms({ resi });
        if (anyAtoms && anyAtoms.length > 0 && anyAtoms[0]?.chain) {
          return anyAtoms[0].chain as string;
        }
        return undefined;
      };

      // Helper: check if a residue exists in the loaded PDB model
      const residueExists = (resi: number, chain?: string): boolean => {
        if (chain) {
          const atoms = viewer.selectedAtoms({ resi, chain, atom: "CA" });
          if (atoms && atoms.length > 0) return true;
          // Fallback: try any atom at this position (for non-standard residues)
          const anyAtom = viewer.selectedAtoms({ resi, chain });
          if (anyAtom && anyAtom.length > 0) return true;
        }

        const atoms = viewer.selectedAtoms({ resi, atom: "CA" });
        if (atoms && atoms.length > 0) return true;
        const anyAtom = viewer.selectedAtoms({ resi });
        return anyAtom && anyAtom.length > 0;
      };

      for (const ann of annotationList) {
        if (!ann.isVisible) continue;

        if (ann.type === "binding-site" && ann.residues.length > 0) {
          // Filter binding site residues to only those present in the model
          const validResidues = ann.residues.filter((res) => {
            const resolvedChain = resolveResidueChain(res.number, res.chain);
            return residueExists(res.number, resolvedChain || res.chain);
          });
          if (validResidues.length === 0) continue;

          // Group residues by chain for proper selection
          const chainGroups: Record<string, number[]> = {};
          for (const res of validResidues) {
            const chain = resolveResidueChain(res.number, res.chain);
            if (!chain) continue;
            if (!chainGroups[chain]) chainGroups[chain] = [];
            chainGroups[chain].push(res.number);
          }

          for (const [chain, resiNums] of Object.entries(chainGroups)) {
            viewer.setStyle(
              { resi: resiNums, chain },
              { stick: { color: ann.color, radius: 0.2 } },
            );
          }

          // Labels for key residues (up to 5) — only for validated positions
          validResidues.slice(0, 5).forEach((res) => {
            const chain = resolveResidueChain(res.number, res.chain);
            if (!chain) return;
            viewer.addLabel(
              `${res.name} ${res.number}`,
              {
                fontSize: 11,
                fontColor: "white",
                backgroundColor: "rgba(255, 100, 0, 0.75)",
                borderRadius: 4,
                padding: 2,
              },
              { resi: res.number, chain, atom: "CA" },
            );
          });
        }

        if (ann.type === "ligand" && ann.ligandName) {
          // Verify ligand exists in the model before styling/labeling
          const ligandAtoms = viewer.selectedAtoms({ resn: ann.ligandName });
          if (!ligandAtoms || ligandAtoms.length === 0) continue;

          const resolvedLigandChain =
            ann.ligandChain || (ligandAtoms[0]?.chain as string | undefined);
          const ligSel = resolvedLigandChain
            ? { resn: ann.ligandName, chain: resolvedLigandChain }
            : { resn: ann.ligandName };
          const ligAtoms = viewer.selectedAtoms(ligSel);
          if (!ligAtoms || ligAtoms.length === 0) continue;

          viewer.setStyle(ligSel, {
            stick: { color: ann.color, radius: 0.25 },
            ball: { color: ann.color, scale: 0.3 },
          });
          viewer.addLabel(
            ann.ligandName,
            {
              fontSize: 13,
              fontColor: "white",
              backgroundColor: "rgba(0, 200, 83, 0.85)",
              borderRadius: 6,
              padding: 4,
            },
            ligSel,
          );
        }

        if (ann.type === "mutation" && ann.residues.length > 0) {
          const groupedSites = new Map<
            string,
            { resi: number; chain: string; tags: Set<string> }
          >();

          for (const res of ann.residues) {
            const resolvedChain = resolveResidueChain(res.number, res.chain);
            if (!residueExists(res.number, resolvedChain || res.chain))
              continue;
            if (!resolvedChain) continue;

            const key = `${resolvedChain}:${res.number}`;
            if (!groupedSites.has(key)) {
              groupedSites.set(key, {
                resi: res.number,
                chain: resolvedChain,
                tags: new Set<string>(),
              });
            }
            groupedSites
              .get(key)
              ?.tags.add(res.name || ann.label.replace(" Mutation", ""));
          }

          for (const site of groupedSites.values()) {
            viewer.setStyle(
              { resi: site.resi, chain: site.chain },
              { sphere: { color: ann.color, scale: 0.4 } },
            );

            const tags = Array.from(site.tags);
            const labelText =
              tags.length > 3
                ? `${tags.slice(0, 3).join("/")} +${tags.length - 3}`
                : tags.join("/");

            viewer.addLabel(
              labelText,
              {
                fontSize: 12,
                fontColor: "white",
                backgroundColor: "rgba(255, 23, 68, 0.85)",
                borderRadius: 4,
                padding: 3,
              },
              { resi: site.resi, chain: site.chain, atom: "CA" },
            );
          }
        }
      }

      viewer.render();
    },
    [],
  );

  const loadStructure = useCallback(
    async (struct: StructureData) => {
      if (!viewerRef.current) return;

      // Wait for $3Dmol to be available (script may still be loading)
      if (!(window as any).$3Dmol) {
        // Retry up to 20 times (4 seconds total)
        let retries = 0;
        while (!(window as any).$3Dmol && retries < 20) {
          await new Promise((r) => setTimeout(r, 200));
          retries++;
        }
        if (!(window as any).$3Dmol) {
          setError(
            "3D viewer library failed to load. Please refresh the page.",
          );
          return;
        }
      }

      setLoading(true);
      setError("");
      setStructureInfo(null);

      try {
        if (!viewerInstance.current) {
          viewerInstance.current = (window as any).$3Dmol.createViewer(
            viewerRef.current,
            {
              backgroundColor: "0x1a1a2e",
              antialias: true,
            },
          );
          // Ensure canvas matches container dimensions after creation
          viewerInstance.current!.resize();
        }

        const viewer = viewerInstance.current!;
        viewer.clear();

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
          if (fileFormat === "pdb") {
            const cifResponse = await fetch(
              `https://files.rcsb.org/download/${struct.pdbId}.cif`,
            );
            if (!cifResponse.ok)
              throw new Error(`Structure ${struct.pdbId} not found`);
            const cifData = await cifResponse.text();
            viewer.addModel(cifData, "cif");
          } else {
            throw new Error(`Structure ${struct.pdbId} not found`);
          }
        } else {
          const structData = await response.text();
          viewer.addModel(structData, fileFormat);
        }

        // Apply base style (skip render — we'll render once after annotations)
        applyStyle(viewer, currentStyleRef.current, true);

        // ── Validate ALL annotation data against the loaded PDB model ──
        // Any residue/ligand not physically present in the crystallized
        // structure is removed so labels never float at (0,0,0).
        let validatedStruct = struct;

        // Helper: check if a residue exists anywhere in this PDB
        const residueInModel = (
          resi: number,
          preferredChain?: string,
        ): boolean => {
          // Try preferred chain first
          if (preferredChain) {
            const atoms = viewer.selectedAtoms({
              resi,
              chain: preferredChain,
              atom: "CA",
            });
            if (atoms && atoms.length > 0) return true;
            // Try any atom at that position in preferred chain
            const any = viewer.selectedAtoms({ resi, chain: preferredChain });
            if (any && any.length > 0) return true;
          }
          // Try common chains
          for (const chain of ["A", "B", "C", "D"]) {
            const atoms = viewer.selectedAtoms({ resi, chain, atom: "CA" });
            if (atoms && atoms.length > 0) return true;
          }
          // Last resort: no chain filter
          const anyAtoms = viewer.selectedAtoms({ resi, atom: "CA" });
          return anyAtoms && anyAtoms.length > 0;
        };

        // 1. Validate mutations
        if (struct.mutations?.length) {
          const validMutations = struct.mutations.filter((mut) =>
            residueInModel(mut.position),
          );
          if (validMutations.length !== struct.mutations.length) {
            console.log(
              `[Viewer] Filtered mutations: ${struct.mutations.length} → ${validMutations.length} (removed ${struct.mutations.length - validMutations.length} positions not in PDB)`,
            );
          }
          validatedStruct = {
            ...validatedStruct,
            mutations: validMutations.length > 0 ? validMutations : undefined,
          };
        }

        // 2. Validate binding site residues
        if (struct.bindingSite?.residues?.length) {
          const validResidues = struct.bindingSite.residues.filter((res) =>
            residueInModel(res.number, res.chain || undefined),
          );
          if (validResidues.length !== struct.bindingSite.residues.length) {
            console.log(
              `[Viewer] Filtered binding site residues: ${struct.bindingSite.residues.length} → ${validResidues.length} (removed ${struct.bindingSite.residues.length - validResidues.length} positions not in PDB)`,
            );
          }
          validatedStruct = {
            ...validatedStruct,
            bindingSite:
              validResidues.length > 0
                ? { ...struct.bindingSite, residues: validResidues }
                : undefined,
          };
        }

        // 3. Validate ligand existence in the model
        if (struct.ligand) {
          const ligAtoms = viewer.selectedAtoms({ resn: struct.ligand });
          if (!ligAtoms || ligAtoms.length === 0) {
            console.log(
              `[Viewer] Ligand "${struct.ligand}" not found in PDB model — removing annotation`,
            );
            validatedStruct = {
              ...validatedStruct,
              ligand: undefined,
              ligandFullName: undefined,
            };
          }
        }

        // Build annotations (binding sites, ligand, mutations) from validated data
        const builtAnnotations = buildAnnotations(validatedStruct);
        setAnnotations(builtAnnotations);

        // Apply annotation overlays on top of base style — single render pass
        if (builtAnnotations.length > 0) {
          applyAnnotations(viewer, builtAnnotations);
        }

        viewer.zoomTo();
        viewer.render();

        // Set structure info
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

        setHasLoaded(true);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load structure",
        );
      } finally {
        setLoading(false);
      }
    },
    [applyStyle, buildAnnotations, applyAnnotations],
  );

  // Load when script is ready
  useEffect(() => {
    if (scriptLoaded && !hasLoaded) {
      loadStructure(structure);
    }
  }, [scriptLoaded, hasLoaded, loadStructure, structure]);

  // Resize viewer when fullscreen state changes
  useEffect(() => {
    if (viewerInstance.current) {
      setTimeout(() => {
        viewerInstance.current?.resize();
        viewerInstance.current?.render();
      }, 100);
    }
  }, [isFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const currentlyFullscreen =
        document.fullscreenElement === containerRef.current;
      setIsFullscreen(currentlyFullscreen);

      if (viewerInstance.current) {
        setTimeout(() => {
          viewerInstance.current?.resize();
          viewerInstance.current?.render();
        }, 100);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // ResizeObserver: resize 3Dmol canvas when container dimensions change
  useEffect(() => {
    const el = viewerRef.current;
    if (!el || !viewerInstance.current) return;

    const ro = new ResizeObserver(() => {
      if (viewerInstance.current && el.offsetWidth > 0 && el.offsetHeight > 0) {
        viewerInstance.current.resize();
        viewerInstance.current.render();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasLoaded]);

  // Mobile tab switch: resize & re-render when tab becomes active
  // The container always has full dimensions (absolute inset-0) so ResizeObserver
  // won't fire on opacity change — we must explicitly trigger resize here.
  useEffect(() => {
    if (isActive && viewerInstance.current && hasLoaded) {
      // Small delay to let the opacity transition expose the canvas
      const timer = setTimeout(() => {
        viewerInstance.current?.resize();
        viewerInstance.current?.render();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isActive, hasLoaded]);

  // Focus residue requested by Pocket Comparison chip click
  useEffect(() => {
    if (!focusResidueRequest) return;
    if (!viewerInstance.current || !hasLoaded) return;

    let selector = focusResidueRequest.chain
      ? {
          resi: focusResidueRequest.residueNumber,
          chain: focusResidueRequest.chain,
        }
      : { resi: focusResidueRequest.residueNumber };

    if (focusResidueRequest.chain) {
      const chained = viewerInstance.current.selectedAtoms(selector);
      if (!chained || chained.length === 0) {
        selector = { resi: focusResidueRequest.residueNumber };
      }
    }

    const existingAtoms = viewerInstance.current.selectedAtoms(selector);
    const residueTag = focusResidueRequest.chain
      ? `${focusResidueRequest.chain}:${focusResidueRequest.residueNumber}`
      : `${focusResidueRequest.residueNumber}`;
    const sourceText = focusResidueRequest.source
      ? ` (${focusResidueRequest.source})`
      : "";

    if (!existingAtoms || existingAtoms.length === 0) {
      setFocusedResidueHint(
        `Residue ${residueTag}${sourceText} is not present in this structure model`,
      );
      return;
    }

    applyStyle(viewerInstance.current, currentStyleRef.current, true);
    if (annotations.length > 0) {
      applyAnnotations(viewerInstance.current, annotations);
    }

    viewerInstance.current.setStyle(selector, {
      stick: { color: "#FDE047", radius: 0.28 },
      sphere: { color: "#FDE047", radius: 0.42 },
    });

    viewerInstance.current.addLabel(
      `Focused residue ${residueTag}`,
      {
        fontSize: 12,
        fontColor: "black",
        backgroundColor: "rgba(253, 224, 71, 0.95)",
        borderRadius: 4,
        padding: 4,
      },
      selector,
    );

    viewerInstance.current.zoomTo(selector, 500);
    viewerInstance.current.render();

    setFocusedResidueHint(`Focused residue ${residueTag}${sourceText}`);
  }, [
    focusResidueRequest,
    hasLoaded,
    applyStyle,
    applyAnnotations,
    annotations,
  ]);

  const handleClearFocusedResidue = useCallback(() => {
    if (!viewerInstance.current) return;

    applyStyle(viewerInstance.current, currentStyleRef.current, true);
    if (annotations.length > 0) {
      applyAnnotations(viewerInstance.current, annotations);
    } else {
      viewerInstance.current.render();
    }
    setFocusedResidueHint(null);
  }, [applyStyle, applyAnnotations, annotations]);

  useEffect(() => {
    if (clearFocusSignal === undefined) return;
    if (lastClearFocusSignalRef.current === clearFocusSignal) return;
    lastClearFocusSignalRef.current = clearFocusSignal;
    handleClearFocusedResidue();
  }, [clearFocusSignal, handleClearFocusedResidue]);

  const handleStyleChange = (style: ViewStyle) => {
    setCurrentStyle(style);
    if (viewerInstance.current) {
      // Apply base style without rendering (skip render)
      applyStyle(viewerInstance.current, style, true);
      // Re-apply annotation highlights on top of the new base style.
      // applyAnnotations clears old labels and renders once at the end.
      // This does NOT affect zoom/focus — camera position is preserved.
      if (annotations.length > 0) {
        applyAnnotations(viewerInstance.current, annotations);
      } else {
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

  // ──────────────────────────────────────────────────────────────
  // Scientifically accurate hydrogen bond detection
  // ──────────────────────────────────────────────────────────────
  // H-bonds form between a donor (D-H) and acceptor (A) where:
  //   • D is N or O (electronegative atom with bonded H)
  //   • A is N, O, or S (lone-pair bearing atom)
  //   • D...A distance: 2.5–3.5 Å (heavy-atom criterion)
  //   • Same-residue pairs are excluded (peptide bonds aren't H-bonds)
  //   • Water molecules (HOH) are excluded
  // DRUG-FOCUSED: Only shows protein-ligand H-bonds (HETATM ↔ protein),
  // which are the most actionable for drug discovery. These anchor the
  // drug molecule in the binding pocket and determine binding affinity.
  // Each bond is labeled with its distance in Ångströms.
  // ──────────────────────────────────────────────────────────────
  const handleToggleHBonds = useCallback(() => {
    const viewer = viewerInstance.current;
    if (!viewer) return;

    const next = !showHBonds;
    setShowHBonds(next);
    viewer.removeAllShapes();
    // Clear conflicting features
    if (showSaltBridges) {
      setShowSaltBridges(false);
      setInteractionStats((prev) => ({ ...prev, saltBridges: null }));
    }
    if (showHydrophobic) {
      setShowHydrophobic(false);
      setInteractionStats((prev) => ({ ...prev, hydrophobic: null }));
    }

    // Collect H-bond labels to add AFTER annotation re-apply
    const pendingLabels: Array<{ text: string; opts: object }> = [];

    if (next) {
      try {
        // Get the actual drug/ligand residue name (e.g. "AIN")
        const ligandName = structure.ligand;
        if (!ligandName) {
          console.log("No ligand defined — cannot show drug H-bonds");
          setShowHBonds(false);
          applyStyle(viewer, currentStyleRef.current, true);
          applyAnnotations(viewer, annotations);
          viewer.render();
          return;
        }

        // Get drug atoms (only the actual ligand, not all HETATM)
        const drugAtoms = viewer.selectedAtoms({ resn: ligandName });
        if (drugAtoms.length === 0) {
          console.log("No drug atoms found for", ligandName);
          setShowHBonds(false);
          applyStyle(viewer, currentStyleRef.current, true);
          applyAnnotations(viewer, annotations);
          viewer.render();
          return;
        }

        // Get polar drug atoms (N, O, S that can form H-bonds)
        const drugPolar = drugAtoms.filter(
          (a: any) => a.elem === "N" || a.elem === "O" || a.elem === "S",
        );

        // Get protein polar atoms (non-HETATM, excluding water)
        const proteinN = viewer.selectedAtoms({ elem: "N", hetflag: false });
        const proteinO = viewer.selectedAtoms({ elem: "O", hetflag: false });
        const proteinS = viewer.selectedAtoms({ elem: "S", hetflag: false });
        const proteinPolar = [...proteinN, ...proteinO, ...proteinS];

        const HBOND_MIN = 2.5;
        const HBOND_MAX = 3.5;
        let bondCount = 0;
        const drawn = new Set<string>();

        const dist3d = (a: any, b: any) => {
          const dx = a.x - b.x,
            dy = a.y - b.y,
            dz = a.z - b.z;
          return Math.sqrt(dx * dx + dy * dy + dz * dz);
        };

        // Check every drug polar atom against every protein polar atom
        for (const drug of drugPolar) {
          for (const prot of proteinPolar) {
            if (drug.elem === "S" && prot.elem === "S") continue;

            const d = dist3d(drug, prot);
            if (d < HBOND_MIN || d > HBOND_MAX) continue;

            const key =
              Math.min(drug.serial, prot.serial) +
              "-" +
              Math.max(drug.serial, prot.serial);
            if (drawn.has(key)) continue;
            drawn.add(key);

            let color: string;
            let radius: number;
            if (d <= 2.8) {
              color = "0x00E676";
              radius = 0.08;
            } else if (d <= 3.2) {
              color = "0x66BB6A";
              radius = 0.06;
            } else {
              color = "0xA5D6A7";
              radius = 0.04;
            }

            viewer.addCylinder({
              start: { x: drug.x, y: drug.y, z: drug.z },
              end: { x: prot.x, y: prot.y, z: prot.z },
              radius,
              color,
              dashed: true,
              dashLength: 0.15,
              gapLength: 0.12,
              fromCap: 1,
              toCap: 1,
            });

            pendingLabels.push({
              text:
                d.toFixed(1) +
                "\u00c5 " +
                prot.resn +
                prot.resi +
                ":" +
                prot.atom +
                "\u2194" +
                drug.atom,
              opts: {
                position: {
                  x: (drug.x + prot.x) / 2,
                  y: (drug.y + prot.y) / 2,
                  z: (drug.z + prot.z) / 2,
                },
                backgroundColor: d <= 2.8 ? "#064e3b" : "#14532d",
                fontColor: "white",
                fontSize: 10,
                backgroundOpacity: 0.85,
              },
            });

            bondCount++;
          }
        }

        console.log("Drug-protein H-bonds detected:", bondCount);
        setInteractionStats((prev) => ({
          ...prev,
          hbonds: {
            total: bondCount,
            backbone: 0,
            sidechain: 0,
            protLig: bondCount,
          },
        }));
      } catch (e) {
        console.warn("H-bond visualization error:", e);
      }
    } else {
      setInteractionStats((prev) => ({ ...prev, hbonds: null }));
    }

    // Re-apply annotations first (this clears then re-adds annotation labels)
    applyStyle(viewer, currentStyleRef.current, true);
    applyAnnotations(viewer, annotations);

    // Now add H-bond distance labels ON TOP of annotation labels
    for (const lbl of pendingLabels) {
      viewer.addLabel(lbl.text, lbl.opts);
    }
    viewer.render();
  }, [
    showHBonds,
    showSaltBridges,
    showHydrophobic,
    structure.ligand,
    applyStyle,
    applyAnnotations,
    annotations,
  ]);

  // ──────────────────────────────────────────────────────────────
  // Salt bridge detection: electrostatic interactions between
  // charged residues (ASP/GLU carboxylate ↔ LYS/ARG/HIS amines)
  // Distance: < 4.0 Å between charged heavy atoms
  // ──────────────────────────────────────────────────────────────
  const handleToggleSaltBridges = useCallback(() => {
    const viewer = viewerInstance.current;
    if (!viewer) return;

    const next = !showSaltBridges;
    setShowSaltBridges(next);
    viewer.removeAllShapes();
    // Reset conflicting features since shapes are shared
    if (showHBonds) {
      setShowHBonds(false);
      setInteractionStats((prev) => ({ ...prev, hbonds: null }));
    }
    if (showHydrophobic) {
      setShowHydrophobic(false);
      setInteractionStats((prev) => ({ ...prev, hydrophobic: null }));
    }

    if (next) {
      try {
        // Negative: ASP (OD1, OD2), GLU (OE1, OE2) carboxylate oxygens
        const negAtoms = viewer.selectedAtoms({
          resn: ["ASP", "GLU"],
          atom: ["OD1", "OD2", "OE1", "OE2"],
        });

        // Positive: LYS (NZ), ARG (NH1, NH2, NE), HIS (ND1, NE2)
        const posAtoms = viewer.selectedAtoms({
          resn: ["LYS", "ARG", "HIS"],
          atom: ["NZ", "NH1", "NH2", "NE", "ND1", "NE2"],
        });

        const SALT_MAX = 4.0;
        let count = 0;
        const drawn = new Set<string>();

        for (const neg of negAtoms) {
          for (const pos of posAtoms) {
            if (neg.resi === pos.resi && neg.chain === pos.chain) continue;
            const dx = neg.x - pos.x,
              dy = neg.y - pos.y,
              dz = neg.z - pos.z;
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (d > SALT_MAX) continue;

            const key =
              Math.min(neg.serial, pos.serial) +
              "-" +
              Math.max(neg.serial, pos.serial);
            if (drawn.has(key)) continue;
            drawn.add(key);

            viewer.addCylinder({
              start: { x: neg.x, y: neg.y, z: neg.z },
              end: { x: pos.x, y: pos.y, z: pos.z },
              radius: 0.07,
              color: "0xFF6D00",
              dashed: true,
              dashLength: 0.2,
              gapLength: 0.1,
              fromCap: 1,
              toCap: 1,
            });
            count++;
          }
        }

        console.log("Salt bridges detected:", count);
        setInteractionStats((prev) => ({ ...prev, saltBridges: count }));
      } catch (e) {
        console.warn("Salt bridge error:", e);
      }
    } else {
      setInteractionStats((prev) => ({ ...prev, saltBridges: null }));
    }

    // Re-apply annotation overlays
    applyStyle(viewer, currentStyleRef.current, true);
    applyAnnotations(viewer, annotations);
  }, [
    showSaltBridges,
    showHBonds,
    showHydrophobic,
    applyStyle,
    applyAnnotations,
    annotations,
  ]);

  // ──────────────────────────────────────────────────────────────
  // B-factor (temperature factor) coloring — shows structural
  // flexibility/disorder. High B-factor = floppy loops (red),
  // low B-factor = rigid core (blue). Critical for drug design:
  // binding sites in rigid regions are more druggable.
  // ──────────────────────────────────────────────────────────────
  const handleToggleBFactor = useCallback(() => {
    const viewer = viewerInstance.current;
    if (!viewer) return;

    const next = !showBFactor;
    setShowBFactor(next);

    if (next) {
      // Color by B-factor using blue (rigid) → red (flexible) gradient
      viewer.setStyle(
        {},
        {
          cartoon: {
            colorfunc: (atom: any) => {
              // Normalize B-factor: typical range 5–80 Å²
              const b = atom.b || 0;
              const norm = Math.max(0, Math.min(1, (b - 5) / 75));
              // Blue (0,0,255) → White (255,255,255) → Red (255,0,0)
              let r: number, g: number, bl: number;
              if (norm < 0.5) {
                const t = norm * 2;
                r = Math.round(t * 255);
                g = Math.round(t * 255);
                bl = 255;
              } else {
                const t = (norm - 0.5) * 2;
                r = 255;
                g = Math.round(255 * (1 - t));
                bl = Math.round(255 * (1 - t));
              }
              return "rgb(" + r + "," + g + "," + bl + ")";
            },
          },
        },
      );
      // Keep ligands visible
      viewer.setStyle(
        { hetflag: true, not: { resn: "HOH" } },
        {
          stick: { colorscheme: "Jmol", radius: 0.2 },
          ball: { colorscheme: "Jmol", scale: 0.3 },
        },
      );
      viewer.setStyle({ resn: "HOH" }, {});
      // Re-apply annotation labels on top of B-factor coloring
      if (annotations.length > 0) {
        // Don't call removeAllLabels — just add annotation labels
        for (const ann of annotations) {
          if (!ann.isVisible) continue;
          if (ann.type === "binding-site" && ann.residues.length > 0) {
            ann.residues.slice(0, 5).forEach((res) => {
              viewer.addLabel(
                res.name + " " + res.number,
                {
                  fontSize: 11,
                  fontColor: "white",
                  backgroundColor: "rgba(255, 100, 0, 0.75)",
                  borderRadius: 4,
                  padding: 2,
                },
                res.chain
                  ? { resi: res.number, chain: res.chain, atom: "CA" }
                  : { resi: res.number, atom: "CA" },
              );
            });
          }
          if (ann.type === "ligand" && ann.ligandName) {
            const ligSel = ann.ligandChain
              ? { resn: ann.ligandName, chain: ann.ligandChain }
              : { resn: ann.ligandName };
            viewer.addLabel(
              ann.ligandName,
              {
                fontSize: 13,
                fontColor: "white",
                backgroundColor: "rgba(0, 200, 83, 0.85)",
                borderRadius: 6,
                padding: 4,
              },
              ligSel,
            );
          }
          if (ann.type === "mutation" && ann.residues.length > 0) {
            for (const res of ann.residues) {
              viewer.addLabel(
                ann.label.replace(" Mutation", ""),
                {
                  fontSize: 12,
                  fontColor: "white",
                  backgroundColor: "rgba(255, 23, 68, 0.85)",
                  borderRadius: 4,
                  padding: 3,
                },
                res.chain
                  ? { resi: res.number, chain: res.chain, atom: "CA" }
                  : { resi: res.number, atom: "CA" },
              );
            }
          }
        }
      }
    } else {
      // Restore current style
      applyStyle(viewer, currentStyleRef.current, true);
      if (annotations.length > 0) {
        applyAnnotations(viewer, annotations);
      }
    }

    viewer.render();
  }, [showBFactor, applyStyle, applyAnnotations, annotations]);

  // ──────────────────────────────────────────────────────────────
  // Hydrophobic contacts: interactions between non-polar residues
  // (ALA, VAL, LEU, ILE, PHE, TRP, MET, PRO) carbon atoms
  // within 4.5 Å — important for protein folding & drug binding
  // ──────────────────────────────────────────────────────────────
  const handleToggleHydrophobic = useCallback(() => {
    const viewer = viewerInstance.current;
    if (!viewer) return;

    const next = !showHydrophobic;
    setShowHydrophobic(next);
    viewer.removeAllShapes();
    if (showHBonds) {
      setShowHBonds(false);
      setInteractionStats((prev) => ({ ...prev, hbonds: null }));
    }
    if (showSaltBridges) {
      setShowSaltBridges(false);
      setInteractionStats((prev) => ({ ...prev, saltBridges: null }));
    }

    if (next) {
      try {
        const hydrophobicRes = [
          "ALA",
          "VAL",
          "LEU",
          "ILE",
          "PHE",
          "TRP",
          "MET",
          "PRO",
        ];
        // Get sidechain carbon atoms from hydrophobic residues
        const carbons = viewer.selectedAtoms({
          resn: hydrophobicRes,
          elem: "C",
          not: { atom: ["C", "CA"] }, // exclude backbone C and CA
        });

        // Get drug-specific carbons (not all HETATM — avoids ions/buffers)
        const ligandName = structure.ligand;
        const ligCarbons = ligandName
          ? viewer.selectedAtoms({ resn: ligandName, elem: "C" })
          : [];

        const HP_MAX = 4.5;
        const HP_MIN = 3.0;
        let count = 0;
        const MAX_HP = 300;
        const drawn = new Set<string>();

        // Protein-ligand hydrophobic contacts (highest priority)
        for (const lc of ligCarbons) {
          if (count >= MAX_HP) break;
          for (const pc of carbons) {
            if (count >= MAX_HP) break;
            const dx = lc.x - pc.x,
              dy = lc.y - pc.y,
              dz = lc.z - pc.z;
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (d < HP_MIN || d > HP_MAX) continue;

            const key =
              Math.min(lc.serial, pc.serial) +
              "-" +
              Math.max(lc.serial, pc.serial);
            if (drawn.has(key)) continue;
            drawn.add(key);

            viewer.addCylinder({
              start: { x: lc.x, y: lc.y, z: lc.z },
              end: { x: pc.x, y: pc.y, z: pc.z },
              radius: 0.04,
              color: "0xFFD600",
              dashed: true,
              dashLength: 0.1,
              gapLength: 0.15,
              fromCap: 1,
              toCap: 1,
            });
            count++;
          }
        }

        console.log("Hydrophobic contacts:", count);
        setInteractionStats((prev) => ({ ...prev, hydrophobic: count }));
      } catch (e) {
        console.warn("Hydrophobic contacts error:", e);
      }
    } else {
      setInteractionStats((prev) => ({ ...prev, hydrophobic: null }));
    }

    // Re-apply annotation overlays
    applyStyle(viewer, currentStyleRef.current, true);
    applyAnnotations(viewer, annotations);
  }, [
    showHydrophobic,
    showHBonds,
    showSaltBridges,
    structure.ligand,
    applyStyle,
    applyAnnotations,
    annotations,
  ]);

  const handleScreenshot = () => {
    const viewerElement = viewerRef.current;
    const canvas = viewerElement?.querySelector("canvas") as
      | HTMLCanvasElement
      | null;

    if (!canvas) return;

    const png = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = png;
    link.download = `${structure.pdbId}_structure_${index}.png`;
    link.click();
  };

  const handleToggleFullscreen = async () => {
    const target = containerRef.current;
    if (!target) return;

    try {
      if (document.fullscreenElement === target) {
        await document.exitFullscreen();
      } else {
        await target.requestFullscreen();
      }
    } catch (error) {
      console.warn("Fullscreen toggle failed:", error);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // Surface mode change — electrostatic, hydrophobic, bfactor, default
  // ──────────────────────────────────────────────────────────────
  const handleSurfaceModeChange = useCallback(
    (mode: SurfaceMode) => {
      setSurfaceMode(mode);
      surfaceModeRef.current = mode;
      if (viewerInstance.current && currentStyleRef.current === "surface") {
        applyStyle(viewerInstance.current, "surface", true);
        applyAnnotations(viewerInstance.current, annotations);
      }
    },
    [applyStyle, applyAnnotations, annotations],
  );

  // ──────────────────────────────────────────────────────────────
  // Distance measurement tool: click two atoms to measure Å
  // Uses 3Dmol's setClickable API with a ref to avoid stale closures
  // ──────────────────────────────────────────────────────────────
  const handleToggleMeasure = useCallback(() => {
    const viewer = viewerInstance.current;
    if (!viewer) return;

    if (!measuringDistance) {
      // Entering measure mode
      measureAtomsRef.current = [];
      setDistanceAtoms([]);
      setMeasuredDistance(null);
      setMeasuringDistance(true);

      viewer.setClickable({}, true, (atom: any) => {
        if (!atom || atom.x === undefined) return;

        const atoms = measureAtomsRef.current;
        atoms.push(atom);
        setDistanceAtoms([...atoms]);

        if (atoms.length === 1) {
          // First atom picked — label it
          viewer.addLabel(atom.resn + atom.resi + ":" + atom.atom, {
            position: atom,
            backgroundColor: "#7C3AED",
            fontColor: "white",
            fontSize: 11,
            backgroundOpacity: 0.9,
          });
          viewer.render();
        } else if (atoms.length >= 2) {
          const a1 = atoms[0],
            a2 = atoms[1];
          const dx = a1.x - a2.x,
            dy = a1.y - a2.y,
            dz = a1.z - a2.z;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const rounded = Math.round(d * 100) / 100;
          setMeasuredDistance(rounded);

          // Label second atom
          viewer.addLabel(a2.resn + a2.resi + ":" + a2.atom, {
            position: a2,
            backgroundColor: "#7C3AED",
            fontColor: "white",
            fontSize: 11,
            backgroundOpacity: 0.9,
          });

          // Draw dashed measurement line
          viewer.addCylinder({
            start: { x: a1.x, y: a1.y, z: a1.z },
            end: { x: a2.x, y: a2.y, z: a2.z },
            radius: 0.06,
            color: "0x7C3AED",
            dashed: true,
            dashLength: 0.15,
            gapLength: 0.1,
            fromCap: 1,
            toCap: 1,
          });

          // Distance label at midpoint
          viewer.addLabel(d.toFixed(2) + " \u00c5", {
            position: {
              x: (a1.x + a2.x) / 2,
              y: (a1.y + a2.y) / 2,
              z: (a1.z + a2.z) / 2,
            },
            backgroundColor: "#7C3AED",
            fontColor: "white",
            fontSize: 14,
            backgroundOpacity: 0.9,
          });

          // Done — disable click and exit measure mode
          viewer.setClickable({}, false);
          viewer.render();
          setMeasuringDistance(false);
          measureAtomsRef.current = [];
        }
      });
      // IMPORTANT: render() required after setClickable for it to take effect
      viewer.render();
    } else {
      // Cancel measure mode
      viewer.setClickable({}, false);
      viewer.render();
      setMeasuringDistance(false);
      measureAtomsRef.current = [];
      setDistanceAtoms([]);
    }
  }, [measuringDistance]);

  // ──────────────────────────────────────────────────────────────
  // Export — supports TXT, CSV, JSON formats
  // ──────────────────────────────────────────────────────────────
  type ExportFormat = "txt" | "csv" | "json";
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleExportReport = useCallback(
    (format: ExportFormat = "txt") => {
      const pdbId = structure.pdbId;
      const timestamp = new Date().toISOString();

      if (format === "json") {
        // ── JSON Export: structured data for programmatic use ──
        const exportData = {
          metadata: {
            pdbId,
            title: structure.title || "",
            resolution: structureInfo?.resolution || null,
            method: structureInfo?.method || null,
            ligand: structure.ligand || null,
            generated: timestamp,
            generator: "BioJarvis",
          },
          bindingSite: structure.bindingSite
            ? {
                name: structure.bindingSite.name || "Binding Site",
                residueCount: structure.bindingSite.residues.length,
                residues: structure.bindingSite.residues.map((r: any) => ({
                  name: r.name,
                  number: r.number,
                  chain: r.chain || null,
                  distance: r.distance || null,
                })),
              }
            : null,
          interactions: {
            hBonds: interactionStats.hbonds
              ? {
                  total: interactionStats.hbonds.total,
                  backbone: interactionStats.hbonds.backbone,
                  sidechain: interactionStats.hbonds.sidechain,
                  proteinLigand: interactionStats.hbonds.protLig,
                }
              : null,
            saltBridges: interactionStats.saltBridges,
            hydrophobicContacts: interactionStats.hydrophobic,
          },
          druggability:
            druggabilityScore !== null
              ? {
                  score: druggabilityScore,
                  label: druggabilityLabel?.text || "N/A",
                }
              : null,
          mutations:
            structure.mutations?.map((m: any) => ({
              label: m.label,
              position: m.position,
              original: m.original,
              mutated: m.mutated,
              clinicalSignificance: m.clinicalSignificance || null,
              diseaseAssociation: m.diseaseAssociation || null,
            })) || [],
          annotations: annotations.map((a) => ({
            type: a.type,
            label: a.label,
            description: a.description,
            residues: a.residues.map((r: any) =>
              r.chain
                ? `${r.name}${r.number}(${r.chain})`
                : `${r.name}${r.number}(unknown)`,
            ),
          })),
          measuredDistance: measuredDistance,
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${pdbId}_report.json`;
        link.click();
        URL.revokeObjectURL(url);
      } else if (format === "csv") {
        // ── CSV Export: binding site residues + interactions table ──
        const csvRows: string[] = [];

        // Binding site residues table
        csvRows.push("Section,Residue,Number,Chain,Distance_A");
        if (structure.bindingSite?.residues) {
          for (const r of structure.bindingSite.residues) {
            csvRows.push(
              `Binding Site,${(r as any).name},${(r as any).number},${(r as any).chain || "unknown"},${(r as any).distance || ""}`,
            );
          }
        }
        csvRows.push("");

        // Interaction summary
        csvRows.push("Metric,Value");
        csvRows.push(`PDB ID,${pdbId}`);
        csvRows.push(`Ligand,${structure.ligand || "N/A"}`);
        csvRows.push(`Resolution,${structureInfo?.resolution || "N/A"}`);
        csvRows.push(
          `H-Bonds Total,${interactionStats.hbonds?.total ?? "N/A"}`,
        );
        csvRows.push(
          `H-Bonds Backbone,${interactionStats.hbonds?.backbone ?? "N/A"}`,
        );
        csvRows.push(
          `H-Bonds Sidechain,${interactionStats.hbonds?.sidechain ?? "N/A"}`,
        );
        csvRows.push(
          `H-Bonds Protein-Ligand,${interactionStats.hbonds?.protLig ?? "N/A"}`,
        );
        csvRows.push(`Salt Bridges,${interactionStats.saltBridges ?? "N/A"}`);
        csvRows.push(
          `Hydrophobic Contacts,${interactionStats.hydrophobic ?? "N/A"}`,
        );
        csvRows.push(`Druggability Score,${druggabilityScore ?? "N/A"}`);
        csvRows.push(`Druggability Label,${druggabilityLabel?.text || "N/A"}`);
        if (measuredDistance !== null)
          csvRows.push(`Measured Distance,${measuredDistance} A`);
        csvRows.push("");

        // Mutations table
        if (structure.mutations && structure.mutations.length > 0) {
          csvRows.push(
            "Mutation,Position,Original,Mutated,Significance,Disease",
          );
          for (const m of structure.mutations) {
            csvRows.push(
              `${m.label},${m.position},${m.original},${m.mutated},${(m as any).clinicalSignificance || ""},${(m as any).diseaseAssociation || ""}`,
            );
          }
        }

        const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${pdbId}_data.csv`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        // ── TXT Export: human-readable report (original) ──
        const lines: string[] = [];
        lines.push("BioJarvis Interaction Report");
        lines.push(
          "Structure: " +
            pdbId +
            (structure.title ? " - " + structure.title : ""),
        );
        lines.push("Generated: " + timestamp);
        lines.push("");

        if (structureInfo) {
          lines.push("Resolution: " + structureInfo.resolution);
          lines.push("Method: " + structureInfo.method);
          lines.push("");
        }

        if (structure.ligand) lines.push("Ligand: " + structure.ligand);

        if (structure.bindingSite) {
          lines.push(
            "Binding Site Residues: " + structure.bindingSite.residues.length,
          );
          lines.push(
            "Residues: " +
              structure.bindingSite.residues
                .map((r: any) => r.name + r.number + "(" + r.chain + ")")
                .join(", "),
          );
          lines.push("");
        }

        lines.push("--- Interaction Summary ---");
        const stats = interactionStats;
        if (stats.hbonds) {
          lines.push("H-Bonds Total: " + stats.hbonds.total);
          lines.push("  Backbone: " + stats.hbonds.backbone);
          lines.push("  Sidechain: " + stats.hbonds.sidechain);
          lines.push("  Protein-Ligand: " + stats.hbonds.protLig);
        } else {
          lines.push("H-Bonds: Not analyzed");
        }
        lines.push(
          "Salt Bridges: " +
            (stats.saltBridges !== null ? stats.saltBridges : "Not analyzed"),
        );
        lines.push(
          "Hydrophobic Contacts: " +
            (stats.hydrophobic !== null ? stats.hydrophobic : "Not analyzed"),
        );

        if (druggabilityScore !== null) {
          lines.push("");
          lines.push("--- Druggability Assessment ---");
          lines.push(
            "Score: " +
              druggabilityScore +
              "/100 (" +
              (druggabilityLabel?.text || "N/A") +
              ")",
          );
        }

        if (measuredDistance !== null) {
          lines.push("");
          lines.push("Measured Distance: " + measuredDistance + " Angstrom");
        }

        // Mutations
        if (structure.mutations && structure.mutations.length > 0) {
          lines.push("");
          lines.push("--- Known Mutations/Variants ---");
          for (const m of structure.mutations) {
            let line = `${m.label} (position ${m.position})`;
            if ((m as any).clinicalSignificance)
              line += ` [${(m as any).clinicalSignificance}]`;
            if ((m as any).diseaseAssociation)
              line += ` — ${(m as any).diseaseAssociation}`;
            lines.push(line);
          }
        }

        if (annotations.length > 0) {
          lines.push("");
          lines.push("--- Annotations ---");
          annotations.forEach((ann) => {
            lines.push(ann.type.toUpperCase() + ": " + ann.label);
            if (ann.description) lines.push("  " + ann.description);
            lines.push(
              "  Residues: " +
                ann.residues
                  .map(
                    (r: any) =>
                      r.name + r.number + "(" + (r.chain || "unknown") + ")",
                  )
                  .join(", "),
            );
          });
        }

        const blob = new Blob([lines.join("\n")], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${pdbId}_interaction_report.txt`;
        link.click();
        URL.revokeObjectURL(url);
      }
      setShowExportMenu(false);
    },
    [
      structure,
      structureInfo,
      interactionStats,
      measuredDistance,
      annotations,
      druggabilityScore,
      druggabilityLabel,
    ],
  );

  // Toggle annotation visibility on/off.
  // IMPORTANT: This re-applies base style + annotations but does NOT
  // call zoomTo — so the current focus/zoom position is preserved.
  const handleToggleAnnotation = useCallback(
    (annotationId: string) => {
      setAnnotations((prev) => {
        const updated = prev.map((a) =>
          a.id === annotationId ? { ...a, isVisible: !a.isVisible } : a,
        );
        // Re-apply base style (no render), then overlay annotations (renders once)
        if (viewerInstance.current) {
          applyStyle(viewerInstance.current, currentStyleRef.current, true);
          applyAnnotations(viewerInstance.current, updated);
        }
        return updated;
      });
    },
    [applyAnnotations, applyStyle],
  );

  // Focus/zoom the viewer to a specific annotation's residues
  const handleFocusAnnotation = useCallback(
    (
      annotation: StructureAnnotation,
      focusTarget?:
        | { type: "region" }
        | {
            type: "residue";
            residue: StructureAnnotation["residues"][number];
          }
        | { type: "ligand" },
    ) => {
      if (!viewerInstance.current) return;
      const viewer = viewerInstance.current;

      const target = focusTarget?.type || "region";

      if (target === "region") {
        // Toggle: if already focused on this annotation, zoom back to full structure
        setFocusedAnnotationId((prev) => {
          if (prev === annotation.id) {
            viewer.zoomTo();
            return null;
          }

          if (annotation.type === "ligand" && annotation.ligandName) {
            const ligSel = annotation.ligandChain
              ? { resn: annotation.ligandName, chain: annotation.ligandChain }
              : { resn: annotation.ligandName };
            viewer.zoomTo(ligSel, 500);
          } else if (annotation.residues.length > 0) {
            const resiNums = annotation.residues.map((r) => r.number);
            const chain = annotation.residues[0]?.chain;
            viewer.zoomTo(
              chain ? { resi: resiNums, chain } : { resi: resiNums },
              500,
            );
          }

          return annotation.id;
        });
        return;
      }

      if (target === "ligand" && annotation.ligandName) {
        const ligSel = annotation.ligandChain
          ? { resn: annotation.ligandName, chain: annotation.ligandChain }
          : { resn: annotation.ligandName };
        viewer.zoomTo(ligSel, 500);
        setFocusedAnnotationId(annotation.id);
        return;
      }

      if (target === "residue" && focusTarget?.type === "residue") {
        const residue = focusTarget.residue;
        const selector = residue.chain
          ? { resi: residue.number, chain: residue.chain }
          : { resi: residue.number };
        viewer.zoomTo(selector, 500);
        setFocusedAnnotationId(annotation.id);
      }
      // Don't call render() here — zoomTo() handles rendering after its animation
    },
    [],
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "rounded-2xl border transition-all duration-500",
        "bg-gradient-to-b from-slate-900/95 to-slate-800/95 backdrop-blur-xl",
        "border-white/10 shadow-lg",
        isFullscreen ? "overflow-y-auto" : "overflow-hidden",
        isNew &&
          "ring-2 ring-[#13ec92]/60 ring-offset-2 ring-offset-transparent animate-in fade-in slide-in-from-bottom-4 duration-500",
      )}
    >
      {/* Card Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-slate-800/80 to-slate-900/80">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#13ec92] text-black text-sm font-bold shrink-0">
            {index}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-[#13ec92] font-semibold">
                {structure.pdbId}
              </span>
              {structure.isAlphaFold && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  AlphaFold
                </span>
              )}
              {druggabilityScore !== null && druggabilityLabel && (
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded border font-medium",
                    druggabilityLabel.color,
                  )}
                  title={"Druggability: " + druggabilityScore + "/100"}
                >
                  {druggabilityLabel.text} ({druggabilityScore})
                </span>
              )}
            </div>
            {structureInfo && (
              <p className="text-xs text-white/40 truncate max-w-[200px] lg:max-w-[300px]">
                {structureInfo.title}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleScreenshot}
            className="w-7 h-7 text-white/40 hover:text-white hover:bg-white/10"
            title="Screenshot"
          >
            <Camera className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleFullscreen}
            className="w-7 h-7 text-white/40 hover:text-white hover:bg-white/10"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Compact toolbar */}
      <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between bg-slate-900/50">
        <div className="flex items-center gap-1">
          {(Object.keys(styleIcons) as ViewStyle[]).map((style) => {
            const { icon: Icon, label } = styleIcons[style];
            return (
              <Button
                key={style}
                variant="ghost"
                size="icon"
                onClick={() => handleStyleChange(style)}
                className={cn(
                  "w-7 h-7 transition-all",
                  currentStyle === style
                    ? "bg-[#13ec92]/20 text-white border border-[#13ec92]/40"
                    : "text-white/40 hover:text-white hover:bg-white/10",
                )}
                title={label}
              >
                <Icon className="w-3.5 h-3.5" />
              </Button>
            );
          })}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleZoom(1.2)}
            className="w-7 h-7 text-white/40 hover:text-white hover:bg-white/10"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleZoom(0.8)}
            className="w-7 h-7 text-white/40 hover:text-white hover:bg-white/10"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSpin}
            className={cn(
              "w-7 h-7 transition-all",
              spinning
                ? "text-[#13ec92] bg-[#13ec92]/20"
                : "text-white/40 hover:text-white hover:bg-white/10",
            )}
            title={spinning ? "Stop Spin" : "Spin"}
          >
            {spinning ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleReset}
            className="w-7 h-7 text-white/40 hover:text-white hover:bg-white/10"
            title="Reset View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleHBonds}
            className={cn(
              "w-7 h-7 transition-all",
              showHBonds
                ? "text-emerald-300 bg-emerald-500/20 border border-emerald-500/40"
                : "text-white/40 hover:text-white hover:bg-white/10",
            )}
            title={showHBonds ? "Hide Drug H-Bonds" : "Drug-Protein H-Bonds"}
          >
            <Link2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleSaltBridges}
            className={cn(
              "w-7 h-7 transition-all",
              showSaltBridges
                ? "text-orange-300 bg-orange-500/20 border border-orange-500/40"
                : "text-white/40 hover:text-white hover:bg-white/10",
            )}
            title={showSaltBridges ? "Hide Salt Bridges" : "Salt Bridges"}
          >
            <Zap className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleBFactor}
            className={cn(
              "w-7 h-7 transition-all",
              showBFactor
                ? "text-red-300 bg-red-500/20 border border-red-500/40"
                : "text-white/40 hover:text-white hover:bg-white/10",
            )}
            title={showBFactor ? "Hide B-Factor" : "B-Factor Coloring"}
          >
            <Thermometer className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleHydrophobic}
            className={cn(
              "w-7 h-7 transition-all",
              showHydrophobic
                ? "text-yellow-300 bg-yellow-500/20 border border-yellow-500/40"
                : "text-white/40 hover:text-white hover:bg-white/10",
            )}
            title={
              showHydrophobic ? "Hide Hydrophobic" : "Hydrophobic Contacts"
            }
          >
            <Droplets className="w-3.5 h-3.5" />
          </Button>
          <div className="w-px h-4 bg-white/10 mx-0.5" />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleMeasure}
            className={cn(
              "w-7 h-7 transition-all",
              measuringDistance
                ? "text-violet-300 bg-violet-500/20 border border-violet-500/40"
                : "text-white/40 hover:text-white hover:bg-white/10",
            )}
            title={measuringDistance ? "Cancel Measure" : "Measure Distance"}
          >
            <Ruler className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setShowProvenancePanel((prev) => {
                const next = !prev;
                if (!next) setShowProvenanceDetails(false);
                return next;
              });
            }}
            className={cn(
              "w-7 h-7 transition-all",
              showProvenancePanel
                ? "text-emerald-300 bg-emerald-500/20 border border-emerald-500/35"
                : "text-white/40 hover:text-white hover:bg-white/10",
            )}
            title={
              showProvenancePanel
                ? "Hide Evidence & Provenance"
                : "Show Evidence & Provenance"
            }
          >
            <ShieldCheck className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="w-7 h-7 text-white/40 hover:text-white hover:bg-white/10 relative"
            title="Export Report"
          >
            <FileDown className="w-3.5 h-3.5" />
          </Button>
          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-slate-800 border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[120px]">
              <button
                onClick={() => handleExportReport("txt")}
                className="w-full px-3 py-1.5 text-[11px] text-left text-slate-300 hover:bg-white/10 hover:text-white"
              >
                TXT Report
              </button>
              <button
                onClick={() => handleExportReport("csv")}
                className="w-full px-3 py-1.5 text-[11px] text-left text-slate-300 hover:bg-white/10 hover:text-white"
              >
                CSV Data
              </button>
              <button
                onClick={() => handleExportReport("json")}
                className="w-full px-3 py-1.5 text-[11px] text-left text-slate-300 hover:bg-white/10 hover:text-white"
              >
                JSON Export
              </button>
            </div>
          )}
        </div>
      </div>

      {showProvenancePanel && provenanceItems.items.length > 0 && (
        <div className="px-3 py-2 border-b border-white/5 bg-slate-900/45">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] text-white/80">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                <span className="font-medium">Evidence & Provenance</span>
              </div>
              <p className="text-[10px] text-white/45 mt-0.5 truncate">
                {provenanceItems.items.length} signals ·{" "}
                {provenanceItems.confidenceCount} confidence-tagged ·{" "}
                {structure.isAlphaFold
                  ? "Predicted structure context"
                  : "Experimental structure context"}
              </p>
              <div
                className={cn(
                  "mt-1 inline-flex max-w-full items-center gap-1.5 rounded px-1.5 py-0.5 border text-[10px]",
                  structureReliabilityHint.toneClass,
                )}
                title={structureReliabilityHint.note}
              >
                <span className="font-medium">
                  {structureReliabilityHint.label}
                </span>
                <span className="text-white/70 truncate">
                  {structureReliabilityHint.note}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowProvenanceDetails((prev) => !prev)}
              className="h-6 px-2 text-[10px] text-white/70 hover:text-white hover:bg-white/10"
            >
              {showProvenanceDetails ? "Hide details" : "View details"}
            </Button>
          </div>

          {showProvenanceDetails && (
            <div className="mt-2 space-y-1.5">
              {provenanceItems.items.map((item) => (
                <div
                  key={item.key}
                  className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5"
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-white/85 font-medium">
                      {item.label}
                    </span>
                    {item.confidence && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/15 text-white/60">
                        {item.confidence}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-white/55 mt-0.5 leading-relaxed">
                    {item.evidence}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Surface coloring mode selector — visible when surface style active */}
      {currentStyle === "surface" && (
        <div className="px-3 py-1.5 border-b border-white/5 bg-slate-900/40 flex items-center gap-2 text-[11px]">
          <span className="text-slate-400 mr-1">Surface:</span>
          {[
            {
              key: "default" as SurfaceMode,
              label: "Default",
              active: "bg-[#13ec92]/25 text-[#13ec92] border-[#13ec92]/40",
            },
            {
              key: "electrostatic" as SurfaceMode,
              label: "Charge",
              active: "bg-blue-500/25 text-blue-300 border-blue-500/40",
            },
            {
              key: "hydrophobic" as SurfaceMode,
              label: "Hydrophobic",
              active: "bg-orange-500/25 text-orange-300 border-orange-500/40",
            },
            {
              key: "bfactor" as SurfaceMode,
              label: "Flexibility",
              active: "bg-red-500/25 text-red-300 border-red-500/40",
            },
          ].map(({ key, label, active }) => (
            <button
              key={key}
              onClick={() => handleSurfaceModeChange(key)}
              className={cn(
                "px-2 py-0.5 rounded-full transition-all text-[10px] font-medium border",
                surfaceMode === key
                  ? active
                  : "text-slate-400 hover:text-white hover:bg-white/10 border-transparent",
              )}
            >
              {label}
            </button>
          ))}
          <div className="ml-auto text-slate-500">
            {surfaceMode === "electrostatic" &&
              "Red: negative · Blue: positive"}
            {surfaceMode === "hydrophobic" &&
              "Orange: hydrophobic · Cyan: polar"}
            {surfaceMode === "bfactor" && "Blue: rigid · Red: flexible"}
          </div>
        </div>
      )}

      {/* Interaction stats bar */}
      {(interactionStats.hbonds ||
        interactionStats.saltBridges !== null ||
        interactionStats.hydrophobic !== null ||
        measuredDistance !== null) && (
        <div className="px-3 py-1.5 border-b border-white/5 bg-slate-900/40 flex items-center gap-3 flex-wrap text-[11px]">
          {interactionStats.hbonds && (
            <div className="flex items-center gap-1.5">
              <Link2 className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-300 font-medium">
                {interactionStats.hbonds.total}
              </span>
              <span className="text-slate-400">drug H-bonds</span>
            </div>
          )}
          {interactionStats.saltBridges !== null && (
            <div className="flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-orange-400" />
              <span className="text-orange-300 font-medium">
                {interactionStats.saltBridges}
              </span>
              <span className="text-slate-400">salt bridges</span>
            </div>
          )}
          {interactionStats.hydrophobic !== null && (
            <div className="flex items-center gap-1.5">
              <Droplets className="w-3 h-3 text-yellow-400" />
              <span className="text-yellow-300 font-medium">
                {interactionStats.hydrophobic}
              </span>
              <span className="text-slate-400">hydrophobic</span>
            </div>
          )}
          {measuredDistance !== null && (
            <div className="flex items-center gap-1.5">
              <Ruler className="w-3 h-3 text-violet-400" />
              <span className="text-violet-300 font-medium">
                {measuredDistance} &#197;
              </span>
              <span className="text-slate-400">distance</span>
            </div>
          )}
        </div>
      )}

      {focusedResidueHint && (
        <div className="px-3 py-1.5 border-b border-yellow-500/20 bg-yellow-500/10 text-[11px] text-yellow-200 flex items-center justify-between gap-2">
          <span>{focusedResidueHint}</span>
          <button
            type="button"
            onClick={handleClearFocusedResidue}
            className="px-1.5 py-0.5 rounded border border-yellow-500/35 bg-yellow-500/10 text-yellow-100 hover:bg-yellow-500/20"
          >
            Remove focus
          </button>
        </div>
      )}

      {/* Measuring mode indicator */}
      {measuringDistance && (
        <div className="px-3 py-1.5 bg-violet-500/10 border-b border-violet-500/20 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          <span className="text-[11px] text-violet-300">
            {distanceAtoms.length === 0
              ? "Click first atom..."
              : "Click second atom..."}
          </span>
        </div>
      )}

      {/* 3D Viewer Canvas */}
      <div
        className={cn(
          "relative transition-all duration-300",
          isFullscreen ? "h-[74vh] min-h-[560px]" : "h-[420px]",
        )}
      >
        <div
          ref={viewerRef}
          className="absolute inset-0"
          style={{
            touchAction: "none",
            cursor: measuringDistance ? "crosshair" : undefined,
          }}
        />

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 border-3 border-[#13ec92]/30 rounded-full" />
                <div className="absolute inset-0 w-12 h-12 border-3 border-transparent border-t-[#13ec92] rounded-full animate-spin" />
              </div>
              <p className="text-[#13ec92] text-sm">Loading structure...</p>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3 text-center px-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <p className="text-sm text-red-300/80">{error}</p>
            </div>
          </div>
        )}

        {/* Waiting for script placeholder */}
        {!hasLoaded && !loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
            <div className="text-center">
              <Box className="w-8 h-8 text-[#13ec92]/30 mx-auto mb-2" />
              <p className="text-xs text-white/30">Preparing viewer...</p>
            </div>
          </div>
        )}
      </div>

      {/* Annotation cards — binding sites, ligand, mutations */}
      {annotations.length > 0 && (
        <AnnotationCards
          annotations={annotations}
          onToggleVisibility={handleToggleAnnotation}
          onFocusAnnotation={handleFocusAnnotation}
          focusedId={focusedAnnotationId}
        />
      )}

      {/* Structure info footer */}
      {structureInfo && (
        <div className="px-4 py-2.5 border-t border-white/5 bg-slate-900/60 flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-[#13ec92]/15 text-[#13ec92] border border-[#13ec92]/20">
            {structureInfo.resolution}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-white/10 text-white/60 border border-white/20">
            {structureInfo.method}
          </span>
        </div>
      )}
    </div>
  );
}
