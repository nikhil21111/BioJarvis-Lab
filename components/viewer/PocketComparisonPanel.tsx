"use client";

import { useMemo, useState } from "react";
import { StructureData } from "@/types/app";
import { ArrowRightLeft, GitCompareArrows, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface PocketComparisonPanelProps {
  structures: StructureData[];
  onFocusResidue?: (payload: {
    structureIndex: number;
    residueNumber: number;
    chain?: string;
    source: "A-only" | "B-only";
  }) => void;
}

type PocketProfile = {
  size: number;
  hydrophobic: number;
  polar: number;
  charged: number;
  mutationsInPocket: number;
  hasLigand: boolean;
  druggabilityScore: number | null;
};

const HYDROPHOBIC = new Set([
  "ALA",
  "VAL",
  "LEU",
  "ILE",
  "PHE",
  "TRP",
  "MET",
  "PRO",
]);
const POLAR = new Set(["SER", "THR", "ASN", "GLN", "TYR", "CYS", "GLY"]);
const CHARGED = new Set(["ASP", "GLU", "LYS", "ARG", "HIS"]);

function residueKey(chain: string | undefined, number: number) {
  return `${chain || "_"}:${number}`;
}

function toPocketSet(structure: StructureData) {
  const residues = structure.bindingSite?.residues || [];
  return new Set(residues.map((r) => residueKey(r.chain, r.number)));
}

function toResidueNameMap(structure: StructureData) {
  const residues = structure.bindingSite?.residues || [];
  const map = new Map<string, string>();
  for (const residue of residues) {
    map.set(residueKey(residue.chain, residue.number), residue.name);
  }
  return map;
}

function druggabilityFromStructure(structure: StructureData): number | null {
  const residues = structure.bindingSite?.residues || [];
  const n = residues.length;
  if (!n) return null;

  let sizeScore = 40;
  if (n >= 10 && n <= 30) sizeScore = 100;
  else if (n < 10) sizeScore = (n / 10) * 80;
  else if (n <= 50) sizeScore = 100 - ((n - 30) / 20) * 30;

  const hpCount = residues.filter((r) => HYDROPHOBIC.has(r.name)).length;
  const hpRatio = hpCount / n;
  let hpScore = 40;
  if (hpRatio >= 0.35 && hpRatio <= 0.65) hpScore = 100;
  else if (hpRatio < 0.35) hpScore = (hpRatio / 0.35) * 70;
  else hpScore = Math.max(40, 100 - ((hpRatio - 0.65) / 0.35) * 60);

  const chargedCount = residues.filter((r) => CHARGED.has(r.name)).length;
  const chargedRatio = chargedCount / n;
  const chargeScore = chargedRatio >= 0.1 && chargedRatio <= 0.4 ? 90 : 60;

  const ligandBonus = structure.ligand ? 15 : 0;
  const raw =
    sizeScore * 0.3 + hpScore * 0.35 + chargeScore * 0.15 + ligandBonus;
  return Math.min(100, Math.round(raw));
}

function buildProfile(structure: StructureData): PocketProfile {
  const residues = structure.bindingSite?.residues || [];
  const pocketPositions = new Set(
    residues.map((r) => residueKey(r.chain, r.number)),
  );

  const mutationsInPocket = (structure.mutations || []).filter((m) => {
    if (Number.isNaN(m.position)) return false;
    return pocketPositions.has(residueKey(undefined, m.position));
  }).length;

  return {
    size: residues.length,
    hydrophobic: residues.filter((r) => HYDROPHOBIC.has(r.name)).length,
    polar: residues.filter((r) => POLAR.has(r.name)).length,
    charged: residues.filter((r) => CHARGED.has(r.name)).length,
    mutationsInPocket,
    hasLigand: !!structure.ligand,
    druggabilityScore: druggabilityFromStructure(structure),
  };
}

function formatDelta(a: number, b: number) {
  const d = b - a;
  if (d === 0) return "0";
  return d > 0 ? `+${d}` : `${d}`;
}

function residueText(key: string, residueMap: Map<string, string>) {
  const parsed = parseResidueKey(key);
  const chainPrefix = parsed.chain ? `${parsed.chain}:` : "";
  const name = residueMap.get(key);
  return name
    ? `${name} ${chainPrefix}${parsed.residueNumber}`
    : `${chainPrefix}${parsed.residueNumber}`;
}

function parseResidueKey(key: string) {
  const [chainRaw, residueRaw] = key.split(":");
  const residueNumber = Number(residueRaw);
  return {
    chain: chainRaw && chainRaw !== "_" ? chainRaw : undefined,
    residueNumber,
  };
}

export function PocketComparisonPanel({
  structures,
  onFocusResidue,
}: PocketComparisonPanelProps) {
  const [leftIdx, setLeftIdx] = useState(Math.max(0, structures.length - 2));
  const [rightIdx, setRightIdx] = useState(Math.max(1, structures.length - 1));
  const [showAllLeftOnly, setShowAllLeftOnly] = useState(false);
  const [showAllRightOnly, setShowAllRightOnly] = useState(false);

  const safeLeftIdx = Math.min(leftIdx, structures.length - 1);
  const safeRightIdx = Math.min(rightIdx, structures.length - 1);
  const normalizedRightIdx =
    safeLeftIdx === safeRightIdx
      ? Math.min(structures.length - 1, safeLeftIdx + 1)
      : safeRightIdx;
  const left = structures[safeLeftIdx];
  const right = structures[normalizedRightIdx];

  const data = useMemo(() => {
    if (!left || !right) return null;

    const leftSet = toPocketSet(left);
    const rightSet = toPocketSet(right);
    const leftResidueMap = toResidueNameMap(left);
    const rightResidueMap = toResidueNameMap(right);

    const overlap = [...leftSet].filter((k) => rightSet.has(k));
    const leftOnly = [...leftSet].filter((k) => !rightSet.has(k));
    const rightOnly = [...rightSet].filter((k) => !leftSet.has(k));
    const unionCount = new Set([...leftSet, ...rightSet]).size;

    const overlapPct =
      unionCount > 0 ? Math.round((overlap.length / unionCount) * 100) : 0;

    const leftProfile = buildProfile(left);
    const rightProfile = buildProfile(right);

    return {
      overlapCount: overlap.length,
      overlapPct,
      leftOnly,
      rightOnly,
      leftResidueMap,
      rightResidueMap,
      leftProfile,
      rightProfile,
    };
  }, [left, right]);

  if (structures.length < 2 || !left || !right || !data) {
    return null;
  }

  const collapsedCount = 14;
  const leftOnlyVisible = showAllLeftOnly
    ? data.leftOnly
    : data.leftOnly.slice(0, collapsedCount);
  const rightOnlyVisible = showAllRightOnly
    ? data.rightOnly
    : data.rightOnly.slice(0, collapsedCount);

  const rows = [
    {
      label: "Pocket residues",
      a: data.leftProfile.size,
      b: data.rightProfile.size,
    },
    {
      label: "Hydrophobic residues",
      a: data.leftProfile.hydrophobic,
      b: data.rightProfile.hydrophobic,
    },
    {
      label: "Polar residues",
      a: data.leftProfile.polar,
      b: data.rightProfile.polar,
    },
    {
      label: "Charged residues",
      a: data.leftProfile.charged,
      b: data.rightProfile.charged,
    },
    {
      label: "Mutations in pocket",
      a: data.leftProfile.mutationsInPocket,
      b: data.rightProfile.mutationsInPocket,
    },
    {
      label: "Druggability score",
      a: data.leftProfile.druggabilityScore ?? 0,
      b: data.rightProfile.druggabilityScore ?? 0,
      enabled:
        data.leftProfile.druggabilityScore !== null ||
        data.rightProfile.druggabilityScore !== null,
    },
  ].filter((r) => r.enabled !== false);

  const leftTopChanges = data.leftOnly
    .slice(0, 3)
    .map((k) => residueText(k, data.leftResidueMap));
  const rightTopChanges = data.rightOnly
    .slice(0, 3)
    .map((k) => residueText(k, data.rightResidueMap));

  const mutationDelta =
    data.rightProfile.mutationsInPocket - data.leftProfile.mutationsInPocket;
  const mutationLine =
    mutationDelta === 0
      ? "Mutation load in pocket is similar between A and B."
      : mutationDelta > 0
        ? `B has ${mutationDelta} more mutation${mutationDelta > 1 ? "s" : ""} inside the pocket than A.`
        : `A has ${Math.abs(mutationDelta)} more mutation${Math.abs(mutationDelta) > 1 ? "s" : ""} inside the pocket than B.`;

  const hydrophobicDelta =
    data.rightProfile.hydrophobic - data.leftProfile.hydrophobic;
  const chargedDelta = data.rightProfile.charged - data.leftProfile.charged;
  const bindingEffectLine =
    hydrophobicDelta > 0
      ? "B pocket is more hydrophobic, which may favor lipophilic ligand binding."
      : hydrophobicDelta < 0
        ? "A pocket is more hydrophobic, which may favor lipophilic ligand binding."
        : chargedDelta > 0
          ? "B pocket is more charged, which may increase electrostatic selectivity."
          : chargedDelta < 0
            ? "A pocket is more charged, which may increase electrostatic selectivity."
            : "Pocket chemistry is similar; major affinity shifts are less likely from composition alone.";

  const confidenceLine =
    data.overlapCount < 6
      ? "Lower confidence: overlap is small, so residue-level conclusions should be verified experimentally."
      : data.overlapPct < 40
        ? "Moderate confidence: substantial pocket drift suggests meaningful structural differences."
        : "Higher confidence: strong residue overlap supports stable compare interpretation.";

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 bg-slate-800/60 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#13ec92]/15 border border-[#13ec92]/25 flex items-center justify-center">
            <GitCompareArrows className="w-4 h-4 text-[#13ec92]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-200">
              Pocket Comparison Mode
            </p>
            <p className="text-[11px] text-slate-400">
              A/B residue overlap and interaction profile
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <select
            value={safeLeftIdx}
            onChange={(e) => {
              setLeftIdx(Number(e.target.value));
              setShowAllLeftOnly(false);
              setShowAllRightOnly(false);
            }}
            className="bg-slate-900 border border-white/15 text-slate-200 rounded px-2 py-1"
          >
            {structures.map((s, i) => (
              <option key={`${s.pdbId}-${i}-left`} value={i}>
                A: {s.pdbId}
              </option>
            ))}
          </select>
          <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={normalizedRightIdx}
            onChange={(e) => {
              setRightIdx(Number(e.target.value));
              setShowAllLeftOnly(false);
              setShowAllRightOnly(false);
            }}
            className="bg-slate-900 border border-white/15 text-slate-200 rounded px-2 py-1"
          >
            {structures.map((s, i) => (
              <option key={`${s.pdbId}-${i}-right`} value={i}>
                B: {s.pdbId}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-emerald-300">
              Pocket overlap
            </p>
            <p className="text-lg font-semibold text-emerald-200">
              {data.overlapPct}%
            </p>
            <p className="text-[10px] text-emerald-300/70 mt-0.5">
              Shared binding-site positions between A and B.
            </p>
          </div>
          <div className="rounded-lg border border-blue-500/25 bg-blue-500/10 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-blue-300">
              Common positions
            </p>
            <p className="text-lg font-semibold text-blue-200">
              {data.overlapCount}
            </p>
            <p className="text-[10px] text-blue-300/70 mt-0.5">
              Absolute count of residues present in both pockets.
            </p>
          </div>
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-amber-300">
              Pocket drift
            </p>
            <p className="text-lg font-semibold text-amber-200">
              {data.leftOnly.length + data.rightOnly.length}
            </p>
            <p className="text-[10px] text-amber-300/70 mt-0.5">
              Non-overlapping pocket positions (A-only + B-only).
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-2.5">
          <p className="text-[11px] font-semibold text-violet-200 mb-1.5">
            Pocket Diff Explanation
          </p>
          <ul className="space-y-1 text-[11px] text-violet-100/90">
            <li>
              <span className="text-violet-200/80">Top changed residues:</span>{" "}
              {leftTopChanges.length > 0 || rightTopChanges.length > 0
                ? `A-only ${leftTopChanges.join(", ") || "none"}; B-only ${rightTopChanges.join(", ") || "none"}.`
                : "No unique residues detected in either pocket."}
            </li>
            <li>
              <span className="text-violet-200/80">Mutation impact:</span>{" "}
              {mutationLine}
            </li>
            <li>
              <span className="text-violet-200/80">Binding effect:</span>{" "}
              {bindingEffectLine}
            </li>
            <li>
              <span className="text-violet-200/80">Confidence note:</span>{" "}
              {confidenceLine}
            </li>
          </ul>
        </div>

        <div className="rounded-lg border border-white/10 overflow-hidden">
          <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2 text-xs text-slate-300 bg-slate-800/60">
            <Target className="w-3.5 h-3.5 text-[#13ec92]" />
            Interaction Breakdown Table
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-900/80 text-slate-400">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Metric</th>
                  <th className="text-left px-3 py-2 font-medium">
                    A ({left.pdbId})
                  </th>
                  <th className="text-left px-3 py-2 font-medium">
                    B ({right.pdbId})
                  </th>
                  <th className="text-left px-3 py-2 font-medium">Δ (B-A)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-t border-white/5">
                    <td className="px-3 py-2 text-slate-300">{row.label}</td>
                    <td className="px-3 py-2 text-slate-200">{row.a}</td>
                    <td className="px-3 py-2 text-slate-200">{row.b}</td>
                    <td
                      className={cn(
                        "px-3 py-2 font-medium",
                        row.b - row.a > 0
                          ? "text-emerald-300"
                          : row.b - row.a < 0
                            ? "text-red-300"
                            : "text-slate-400",
                      )}
                    >
                      {formatDelta(row.a, row.b)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-white/5">
                  <td className="px-3 py-2 text-slate-300">Ligand present</td>
                  <td className="px-3 py-2 text-slate-200">
                    {data.leftProfile.hasLigand ? left.ligand || "Yes" : "No"}
                  </td>
                  <td className="px-3 py-2 text-slate-200">
                    {data.rightProfile.hasLigand ? right.ligand || "Yes" : "No"}
                  </td>
                  <td className="px-3 py-2 text-slate-400">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {(data.leftOnly.length > 0 || data.rightOnly.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div
              onClick={() => setShowAllLeftOnly((prev) => !prev)}
              className="rounded-lg border border-red-500/20 bg-red-500/5 p-2.5 text-left hover:border-red-400/30 transition-colors cursor-pointer"
            >
              <p className="text-[11px] text-red-300 mb-1">
                A-only pocket positions
              </p>
              <div className="flex flex-wrap gap-1">
                {leftOnlyVisible.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      const parsed = parseResidueKey(k);
                      if (!Number.isFinite(parsed.residueNumber)) return;
                      onFocusResidue?.({
                        structureIndex: safeLeftIdx,
                        residueNumber: parsed.residueNumber,
                        chain: parsed.chain,
                        source: "A-only",
                      });
                    }}
                    className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-200 text-[10px] hover:bg-red-500/25"
                    title="Focus this residue in structure A"
                  >
                    {k.replace("_:", "")}
                  </button>
                ))}
                {!showAllLeftOnly && data.leftOnly.length > collapsedCount && (
                  <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-200 text-[10px]">
                    +{data.leftOnly.length - collapsedCount}
                  </span>
                )}
              </div>
              {data.leftOnly.length > collapsedCount && (
                <p className="text-[10px] text-red-300/70 mt-1.5">
                  {showAllLeftOnly
                    ? "Tap to collapse"
                    : "Tap to show all positions"}
                </p>
              )}
            </div>
            <div
              onClick={() => setShowAllRightOnly((prev) => !prev)}
              className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2.5 text-left hover:border-blue-400/30 transition-colors cursor-pointer"
            >
              <p className="text-[11px] text-blue-300 mb-1">
                B-only pocket positions
              </p>
              <div className="flex flex-wrap gap-1">
                {rightOnlyVisible.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      const parsed = parseResidueKey(k);
                      if (!Number.isFinite(parsed.residueNumber)) return;
                      onFocusResidue?.({
                        structureIndex: normalizedRightIdx,
                        residueNumber: parsed.residueNumber,
                        chain: parsed.chain,
                        source: "B-only",
                      });
                    }}
                    className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-200 text-[10px] hover:bg-blue-500/25"
                    title="Focus this residue in structure B"
                  >
                    {k.replace("_:", "")}
                  </button>
                ))}
                {!showAllRightOnly &&
                  data.rightOnly.length > collapsedCount && (
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-200 text-[10px]">
                      +{data.rightOnly.length - collapsedCount}
                    </span>
                  )}
              </div>
              {data.rightOnly.length > collapsedCount && (
                <p className="text-[10px] text-blue-300/70 mt-1.5">
                  {showAllRightOnly
                    ? "Tap to collapse"
                    : "Tap to show all positions"}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
