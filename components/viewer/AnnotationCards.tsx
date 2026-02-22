"use client";

import { useMemo, useState } from "react";
import { StructureAnnotation, ANNOTATION_LABELS } from "@/types/app";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Crosshair,
  Dna,
  FlaskConical,
  AlertTriangle,
  Microscope,
} from "lucide-react";
import { cn } from "@/lib/utils";

const typeIcons: Record<string, React.ElementType> = {
  "binding-site": Dna,
  ligand: FlaskConical,
  mutation: AlertTriangle,
};

interface AnnotationCardsProps {
  annotations: StructureAnnotation[];
  onToggleVisibility: (annotationId: string) => void;
  onFocusAnnotation: (
    annotation: StructureAnnotation,
    focusTarget?:
      | { type: "region" }
      | { type: "residue"; residue: StructureAnnotation["residues"][number] }
      | { type: "ligand" },
  ) => void;
  focusedId?: string | null;
}

export function AnnotationCards({
  annotations,
  onToggleVisibility,
  onFocusAnnotation,
  focusedId,
}: AnnotationCardsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hypothesisDialogOpen, setHypothesisDialogOpen] = useState(false);
  const mutationPositionSet = new Set(
    annotations
      .filter((annotation) => annotation.type === "mutation")
      .flatMap((annotation) =>
        annotation.residues.map((residue) => residue.number),
      ),
  );

  const trustSummary = useMemo(() => {
    const knownFacts = annotations.filter((annotation) => {
      if (annotation.isInferred) return false;
      if (annotation.type === "mutation") {
        return Boolean(
          annotation.mutationDetails?.some(
            (detail) =>
              detail.evidenceTier === "clinical" ||
              detail.evidenceTier === "literature",
          ),
        );
      }
      return true;
    });

    const hypothesisCount = annotations.reduce((count, annotation) => {
      const inferredAnnotation = annotation.isInferred ? 1 : 0;
      const inferredMutations =
        annotation.mutationDetails?.filter(
          (detail) =>
            detail.evidenceTier === "computational" ||
            detail.evidenceTier === "predicted",
        ).length || 0;
      return count + inferredAnnotation + inferredMutations;
    }, 0);

    const evidenceSignals = annotations.reduce((count, annotation) => {
      const annotationEvidence = annotation.evidence ? 1 : 0;
      const mutationEvidence =
        annotation.mutationDetails?.filter((detail) => detail.evidenceTier)
          .length || 0;
      return count + annotationEvidence + mutationEvidence;
    }, 0);

    return {
      knownFactsCount: knownFacts.length,
      hypothesisCount,
      evidenceSignals,
    };
  }, [annotations]);

  const knownFactsDetails = useMemo(() => {
    return annotations
      .filter((annotation) => !annotation.isInferred)
      .map((annotation) => ({
        id: annotation.id,
        label: annotation.label,
        type: annotation.type,
        confidence: annotation.confidence || "medium",
        residueCount: annotation.residues.length,
        evidence: annotation.evidence || "No explicit evidence text provided",
      }));
  }, [annotations]);

  const evidenceDetails = useMemo(() => {
    const annotationEvidence = annotations
      .filter((annotation) => Boolean(annotation.evidence))
      .map((annotation) => ({
        key: `${annotation.id}-evidence`,
        label: annotation.label,
        detail: annotation.evidence as string,
        tier: annotation.confidence || "medium",
      }));

    const mutationEvidence = annotations.flatMap((annotation) =>
      (annotation.mutationDetails || [])
        .filter((detail) => Boolean(detail.evidenceTier))
        .map((detail, idx) => ({
          key: `${annotation.id}-mutation-evidence-${idx}`,
          label: detail.tag,
          detail:
            detail.clinicalSignificance || "Mutation evidence-tier signal",
          tier: detail.evidenceTier || "predicted",
        })),
    );

    return [...annotationEvidence, ...mutationEvidence];
  }, [annotations]);

  const hypothesisGuidance = useMemo(() => {
    const primaryLigandLabel = annotations.find(
      (annotation) => annotation.type === "ligand",
    )?.label;

    const mutationItems = annotations
      .filter((annotation) => annotation.type === "mutation")
      .flatMap((annotation) => annotation.mutationDetails || []);

    const scored = mutationItems
      .map((detail) => {
        const text =
          `${detail.clinicalSignificance || ""} ${detail.diseaseAssociation || ""}`.toLowerCase();
        const isResistance =
          text.includes("resistance") || text.includes("pathogenic");
        const nearLigand =
          typeof detail.distanceToLigand === "number" &&
          detail.distanceToLigand <= 5;

        const score =
          (detail.inBindingPocket ? 3 : 0) +
          (nearLigand ? 2 : 0) +
          (isResistance ? 2 : 0) +
          (detail.evidenceTier === "clinical" ? 2 : 0) +
          (detail.evidenceTier === "literature" ? 1 : 0);

        const confidence: "high" | "medium" | "low" =
          score >= 6 ? "high" : score >= 3 ? "medium" : "low";

        const mutationLabel = detail.tag || "This mutation";
        let action = `${mutationLabel} may be worth testing next.`;
        let researcherNextStep =
          "Run a targeted mutation-versus-wildtype binding comparison and verify with literature.";
        let whyItMatters =
          "Changes at this site may affect target behavior and treatment response.";
        if (detail.inBindingPocket) {
          action = primaryLigandLabel
            ? `Mutation ${mutationLabel} may reduce ${primaryLigandLabel} binding.`
            : `Mutation ${mutationLabel} may reduce drug binding.`;
          researcherNextStep =
            "Prioritize pocket-focused docking/MD and affinity validation for this residue.";
          whyItMatters =
            "This position directly contacts the drug-binding region, so even small changes can alter drug fit.";
        } else if (nearLigand) {
          action = primaryLigandLabel
            ? `Mutation ${mutationLabel} may change ${primaryLigandLabel} binding strength.`
            : `Mutation ${mutationLabel} may change drug binding strength.`;
          researcherNextStep =
            "Compare selectivity and potency shifts across candidate inhibitors near this site.";
          whyItMatters =
            "This site is close to the ligand, so changes here can shift binding strength or selectivity.";
        } else if (isResistance) {
          action = `Mutation ${mutationLabel} may be linked to resistance risk.`;
          researcherNextStep =
            "Test alternate inhibitor strategies and pathway escape mechanisms for this mutation.";
          whyItMatters =
            "Prior reports connect this variant to poorer response, making it important to validate resistance mechanisms.";
        }

        const structuralContext = [
          detail.inBindingPocket ? "In binding pocket" : null,
          typeof detail.distanceToLigand === "number"
            ? `${detail.distanceToLigand.toFixed(1)}Å from ligand`
            : null,
          detail.clinicalSignificance || null,
        ]
          .filter(Boolean)
          .join(" · ");

        const evidenceSummary = detail.evidenceTier
          ? `Evidence tier: ${detail.evidenceTier}`
          : "Evidence tier: inferred";

        return {
          tag: detail.tag,
          confidence,
          evidenceTier: detail.evidenceTier || "predicted",
          score,
          action,
          whyItMatters,
          researcherNextStep,
          structuralContext,
          evidenceSummary,
          rationale: [
            detail.inBindingPocket ? "in pocket" : null,
            nearLigand && detail.distanceToLigand !== undefined
              ? `${detail.distanceToLigand.toFixed(1)}Å from ligand`
              : null,
            detail.clinicalSignificance || null,
          ]
            .filter(Boolean)
            .join(" · "),
        };
      })
      .sort((a, b) => b.score - a.score);

    return scored;
  }, [annotations]);
  const hasHypotheses = hypothesisGuidance.length > 0;

  function mutationRiskStyle(detail: {
    clinicalSignificance?: string;
    diseaseAssociation?: string;
  }) {
    const text =
      `${detail.clinicalSignificance || ""} ${detail.diseaseAssociation || ""}`.toLowerCase();
    if (
      text.includes("pathogenic") ||
      text.includes("drug resistance") ||
      text.includes("resistance") ||
      text.includes("oncogenic")
    ) {
      return {
        label: "high risk",
        rowClass: "border-red-500/30 bg-red-500/10 hover:bg-red-500/15",
        badgeClass: "text-red-300 border-red-500/40 bg-red-500/10",
      };
    }
    if (
      text.includes("likely pathogenic") ||
      text.includes("risk factor") ||
      text.includes("association") ||
      text.includes("uncertain")
    ) {
      return {
        label: "moderate risk",
        rowClass: "border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15",
        badgeClass: "text-amber-300 border-amber-500/40 bg-amber-500/10",
      };
    }
    return {
      label: "low risk",
      rowClass: "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07]",
      badgeClass: "text-white/45 border-white/10 bg-white/[0.04]",
    };
  }

  if (annotations.length === 0) return null;

  return (
    <div className="border-t border-white/5 bg-gradient-to-b from-slate-900/80 to-slate-800/80">
      <div className="px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/35 mb-2">
          Research Trust Layers
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-2">
            <p className="text-[10px] text-emerald-300 font-medium uppercase tracking-wide">
              Known facts
            </p>
            <p className="text-[11px] text-white/75 mt-0.5">
              {trustSummary.knownFactsCount} curated tags from
              structure/clinical evidence
            </p>
          </div>
          <div
            className={cn(
              "rounded-md px-2.5 py-2",
              hasHypotheses
                ? "border border-amber-500/25 bg-amber-500/10"
                : "border border-white/15 bg-white/[0.04]",
            )}
          >
            <p className="text-[10px] text-amber-300 font-medium uppercase tracking-wide">
              Testable ideas (AI)
            </p>
            <p className="text-[11px] text-white/75 mt-0.5">
              {hasHypotheses
                ? `${trustSummary.hypothesisCount} AI suggestions you can test next`
                : "No AI suggestions were generated for this structure"}
            </p>
          </div>
          <div className="rounded-md border border-sky-500/25 bg-sky-500/10 px-2.5 py-2">
            <p className="text-[10px] text-sky-300 font-medium uppercase tracking-wide">
              Evidence
            </p>
            <p className="text-[11px] text-white/75 mt-0.5">
              {trustSummary.evidenceSignals} traceability signals to verify
              claims
            </p>
          </div>
        </div>

        <div
          className={cn(
            "mt-2.5 rounded-md px-2.5 py-2",
            hasHypotheses
              ? "border border-violet-500/20 bg-violet-500/10"
              : "border border-white/15 bg-white/[0.04]",
          )}
        >
          <div className="flex items-center gap-2 justify-between">
            <div className="min-w-0">
              <p
                className={cn(
                  "text-[10px] font-medium uppercase tracking-wide",
                  hasHypotheses ? "text-violet-300" : "text-white/70",
                )}
              >
                {hasHypotheses
                  ? "If this site changes…"
                  : "AI hypotheses unavailable"}
              </p>
              <p className="text-[11px] text-white/75 mt-0.5 truncate">
                {hasHypotheses
                  ? `${hypothesisGuidance.length} prioritized hypotheses with rationale and experiment ideas`
                  : "No inferred suggestions predicted. View details for known facts and evidence."}
              </p>
            </div>
            <Dialog
              open={hypothesisDialogOpen}
              onOpenChange={setHypothesisDialogOpen}
            >
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="secondary"
                  className={cn(
                    "h-7 px-2.5 text-[11px] border",
                    hasHypotheses
                      ? "bg-violet-400/15 border-violet-400/25 text-violet-100 hover:bg-violet-400/25"
                      : "bg-white/[0.08] border-white/20 text-white/85 hover:bg-white/[0.14]",
                  )}
                >
                  <Microscope className="w-3 h-3 mr-1" />
                  View details
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl bg-slate-950 border-white/15 text-white">
                <DialogHeader>
                  <DialogTitle className="text-base text-white">
                    Research Trust Details
                  </DialogTitle>
                  <DialogDescription className="text-white/55">
                    Full breakdown of known facts, AI ideas to test, and
                    supporting evidence.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                  <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
                    <p className="text-[12px] text-white/90 font-medium mb-1">
                      How to read this
                    </p>
                    <div className="space-y-1 text-[11px] text-white/70 leading-relaxed">
                      <p>
                        <span className="text-emerald-300 font-medium">
                          Known Facts:
                        </span>{" "}
                        curated observations from structure/clinical literature
                        signals.
                      </p>
                      <p>
                        <span className="text-amber-300 font-medium">
                          AI ideas to test:
                        </span>{" "}
                        suggestions from the model that may be useful to test.
                        They are not proven facts.
                      </p>
                      <p>
                        <span className="text-sky-300 font-medium">
                          Evidence:
                        </span>{" "}
                        traceability links/tiers that support verification of
                        each claim.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
                    <p className="text-[11px] text-emerald-300 font-medium uppercase tracking-wide mb-1.5">
                      Known Facts ({knownFactsDetails.length})
                    </p>
                    <p className="text-[10px] text-white/55 mb-2">
                      Curated observations from structure and literature
                      sources.
                    </p>
                    <div className="space-y-1.5">
                      {knownFactsDetails.length === 0 && (
                        <p className="text-[11px] text-white/55">
                          No known facts extracted for this structure.
                        </p>
                      )}
                      {knownFactsDetails.map((item) =>
                        (() => {
                          const typeLabel = item.type.replace("-", " ");
                          const whyByType: Record<string, string> = {
                            "binding-site":
                              "Binding-site facts help identify where molecular interactions are most likely.",
                            ligand:
                              "Ligand facts show which molecule is interacting with this structure.",
                            mutation:
                              "Mutation facts flag positions with likely biological or clinical impact.",
                          };
                          const nextStep =
                            item.confidence === "high"
                              ? "Use this as a high-priority anchor and verify against original source records."
                              : item.confidence === "low"
                                ? "Treat this as preliminary and cross-check with additional databases or papers."
                                : "Confirm this in source evidence before using it for downstream conclusions.";

                          return (
                            <div
                              key={item.id}
                              className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5"
                            >
                              <p className="text-[11px] text-emerald-100">
                                <span className="font-medium text-emerald-200">
                                  Finding:
                                </span>{" "}
                                {item.label} is a curated {typeLabel} signal
                                with {item.residueCount} residue(s).
                              </p>
                              <p className="text-[11px] text-emerald-200/90 mt-1 leading-relaxed">
                                <span className="font-medium text-emerald-200">
                                  Context:
                                </span>{" "}
                                {whyByType[item.type] ||
                                  "This helps anchor analysis on observed structure-linked biology."}
                              </p>
                              <p className="text-[11px] text-white/75 mt-1 leading-relaxed">
                                <span className="font-medium text-white/90">
                                  Confidence/Evidence:
                                </span>{" "}
                                Confidence is {item.confidence}. Evidence note:{" "}
                                {item.evidence}
                              </p>
                              <p className="text-[11px] text-sky-200/90 mt-1 leading-relaxed">
                                <span className="font-medium text-sky-200">
                                  Next analysis:
                                </span>{" "}
                                {nextStep}
                              </p>
                            </div>
                          );
                        })(),
                      )}
                    </div>
                  </div>

                  <div className="rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2">
                    <p className="text-[11px] text-amber-300 font-medium uppercase tracking-wide mb-1.5">
                      Testable Ideas ({hypothesisGuidance.length})
                    </p>
                    <p className="text-[10px] text-white/55 mb-2">
                      These are AI suggestions to test, not treatment advice.
                      Research-focused summary: finding, structural context,
                      evidence tier, and next analysis step.
                    </p>
                    <div className="space-y-1.5">
                      {hypothesisGuidance.length === 0 && (
                        <p className="text-[11px] text-white/55">
                          No inferred hypotheses available for this structure.
                        </p>
                      )}
                      {hypothesisGuidance.map((item, idx) => (
                        <div
                          key={`${item.tag}-${idx}`}
                          className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2"
                        >
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] px-1.5 py-0.5 rounded border border-violet-400/30 text-violet-200 bg-violet-400/10">
                              {item.tag}
                            </span>
                            <span className="text-[10px] text-white/50 border border-white/10 rounded px-1.5 py-0.5">
                              confidence: {item.confidence}
                            </span>
                            <span className="text-[10px] text-white/50 border border-white/10 rounded px-1.5 py-0.5">
                              evidence: {item.evidenceTier}
                            </span>
                          </div>

                          <p className="text-[11px] text-violet-100 mt-1.5">
                            <span className="font-medium text-violet-200">
                              Finding:
                            </span>{" "}
                            {item.action}
                          </p>
                          <div className="mt-1.5 space-y-1">
                            <p className="text-[11px] text-emerald-200/90 leading-relaxed">
                              <span className="font-medium text-emerald-200">
                                Context:
                              </span>{" "}
                              {item.whyItMatters}
                            </p>
                            {item.structuralContext && (
                              <p className="text-[11px] text-white/75 leading-relaxed">
                                <span className="font-medium text-white/90">
                                  Structural context:
                                </span>{" "}
                                {item.structuralContext}
                              </p>
                            )}
                            <p className="text-[11px] text-white/70 leading-relaxed">
                              <span className="font-medium text-white/85">
                                Confidence/Evidence: {item.confidence} ·{" "}
                                {item.evidenceSummary.replace(
                                  "Evidence tier: ",
                                  "",
                                )}
                              </span>
                            </p>
                            <p className="text-[11px] text-sky-200/90 leading-relaxed">
                              <span className="font-medium text-sky-200">
                                Next analysis:
                              </span>{" "}
                              {item.researcherNextStep}
                            </p>
                          </div>
                          {item.rationale && (
                            <p className="text-[11px] text-white/55 mt-1">
                              Rationale: {item.rationale}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-md border border-sky-500/25 bg-sky-500/10 px-3 py-2">
                    <p className="text-[11px] text-sky-300 font-medium uppercase tracking-wide mb-1.5">
                      Evidence ({evidenceDetails.length})
                    </p>
                    <p className="text-[10px] text-white/55 mb-2">
                      Supporting signals that help you verify each claim.
                    </p>
                    <div className="space-y-1.5">
                      {evidenceDetails.length === 0 && (
                        <p className="text-[11px] text-white/55">
                          No evidence signals were captured for this structure.
                        </p>
                      )}
                      {evidenceDetails.map((item) =>
                        (() => {
                          const tier = String(
                            item.tier || "unknown",
                          ).toLowerCase();
                          const tierMeaning =
                            tier === "clinical"
                              ? "Clinical-tier evidence usually has stronger real-world relevance."
                              : tier === "literature"
                                ? "Literature-tier evidence reflects published findings that still need context checks."
                                : tier === "computational" ||
                                    tier === "predicted"
                                  ? "Predicted/computational evidence is useful for prioritization but needs validation."
                                  : "Evidence tier is available but should be interpreted with source context.";
                          return (
                            <div
                              key={item.key}
                              className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5"
                            >
                              <p className="text-[11px] text-sky-100">
                                <span className="font-medium text-sky-200">
                                  Finding:
                                </span>{" "}
                                {item.label} has a {item.tier} evidence signal.
                              </p>
                              <p className="text-[11px] text-emerald-200/90 mt-1 leading-relaxed">
                                <span className="font-medium text-emerald-200">
                                  Context:
                                </span>{" "}
                                {tierMeaning}
                              </p>
                              <p className="text-[11px] text-white/75 mt-1 leading-relaxed">
                                <span className="font-medium text-white/90">
                                  Confidence/Evidence:
                                </span>{" "}
                                Tier is {item.tier}. Detail: {item.detail}
                              </p>
                              <p className="text-[11px] text-sky-200/90 mt-1 leading-relaxed">
                                <span className="font-medium text-sky-200">
                                  Next analysis:
                                </span>{" "}
                                Cross-check this statement in primary sources
                                and note agreement/disagreement.
                              </p>
                            </div>
                          );
                        })(),
                      )}
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Legend header */}
      <div className="px-4 py-2 flex items-center gap-4 border-b border-white/5">
        <span className="text-[10px] text-white/30 uppercase tracking-wider font-medium">
          Annotations
        </span>
        <div className="flex items-center gap-3 ml-auto">
          {(["binding-site", "ligand", "mutation"] as const).map((type) => {
            const hasType = annotations.some((a) => a.type === type);
            if (!hasType) return null;
            return (
              <div key={type} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full ring-1 ring-white/20"
                  style={{
                    backgroundColor: annotations.find((a) => a.type === type)
                      ?.color,
                  }}
                />
                <span className="text-[10px] text-white/40">
                  {ANNOTATION_LABELS[type]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Annotation cards */}
      <div className="px-3 py-2 space-y-1.5 max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
        {annotations.map((annotation) => {
          const Icon = typeIcons[annotation.type] || Dna;
          const isExpanded = expandedId === annotation.id;
          const isFocused = focusedId === annotation.id;
          const residueCount =
            annotation.type === "ligand" ? null : annotation.residues.length;

          return (
            <div
              key={annotation.id}
              className={cn(
                "rounded-xl border transition-all duration-200 overflow-hidden",
                isFocused
                  ? "border-white/30 bg-white/[0.08] shadow-md"
                  : "border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/10",
                !annotation.isVisible && "opacity-40",
              )}
            >
              {/* Card row */}
              <div className="flex items-center gap-2 px-3 py-2">
                {/* Color dot + icon */}
                <div
                  className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0"
                  style={{ backgroundColor: annotation.color + "20" }}
                >
                  <Icon
                    className="w-3.5 h-3.5"
                    style={{ color: annotation.color }}
                  />
                </div>

                {/* Label + badge */}
                <button
                  className="flex-1 min-w-0 text-left"
                  onClick={() =>
                    onFocusAnnotation(annotation, { type: "region" })
                  }
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-white/90 truncate">
                      {annotation.label}
                    </span>
                    {annotation.confidence && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 border border-white/15 text-white/60">
                        {annotation.confidence}
                      </span>
                    )}
                    {annotation.isInferred && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 border border-amber-400/30 text-amber-300">
                        inferred
                      </span>
                    )}
                    {residueCount !== null && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                        style={{
                          backgroundColor: annotation.color + "20",
                          color: annotation.color,
                          border: `1px solid ${annotation.color}30`,
                        }}
                      >
                        {residueCount} residues
                      </span>
                    )}
                  </div>
                  {annotation.description && !isExpanded && (
                    <p className="text-[10px] text-white/30 truncate mt-0.5">
                      {annotation.description}
                    </p>
                  )}
                  {annotation.type === "mutation" && (
                    <p className="text-[10px] text-white/35 mt-0.5 truncate">
                      Tag guide: high/moderate/low risk = clinical impact, in
                      pocket = mutation site overlaps binding pocket.
                    </p>
                  )}
                </button>

                {/* Actions */}
                <div className="flex items-center gap-0.5 shrink-0">
                  {/* Focus/zoom button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      onFocusAnnotation(annotation, { type: "region" })
                    }
                    className={cn(
                      "w-6 h-6 transition-all",
                      isFocused
                        ? "text-white bg-white/15"
                        : "text-white/30 hover:text-white hover:bg-white/10",
                    )}
                    title="Focus on region"
                  >
                    <Crosshair className="w-3 h-3" />
                  </Button>

                  {/* Visibility toggle */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onToggleVisibility(annotation.id)}
                    className={cn(
                      "w-6 h-6",
                      annotation.isVisible
                        ? "text-white/40 hover:text-white hover:bg-white/10"
                        : "text-white/20 hover:text-white hover:bg-white/10",
                    )}
                    title={
                      annotation.isVisible
                        ? "Hide annotation"
                        : "Show annotation"
                    }
                  >
                    {annotation.isVisible ? (
                      <Eye className="w-3 h-3" />
                    ) : (
                      <EyeOff className="w-3 h-3" />
                    )}
                  </Button>

                  {/* Expand details */}
                  {(annotation.residues.length > 0 ||
                    annotation.description) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : annotation.id)
                      }
                      className="w-6 h-6 text-white/30 hover:text-white hover:bg-white/10"
                      title={isExpanded ? "Collapse" : "Show details"}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronRight className="w-3 h-3" />
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-3 pb-2.5 pt-0.5 border-t border-white/5">
                  {annotation.type === "mutation" && (
                    <div className="mb-2 text-[10px] text-white/40 bg-white/[0.03] border border-white/10 rounded-md px-2 py-1.5">
                      Mutation tag meaning: risk badge indicates likely impact
                      level from clinical/literature context; &quot;in
                      pocket&quot; means the mutation position is inside the
                      ligand binding pocket.
                    </div>
                  )}
                  {annotation.description && (
                    <p className="text-[11px] text-white/50 mb-2 leading-relaxed">
                      {annotation.description}
                    </p>
                  )}
                  {annotation.evidence && (
                    <p className="text-[10px] text-white/35 mb-2">
                      Evidence: {annotation.evidence}
                    </p>
                  )}
                  {annotation.residues.length > 0 &&
                    annotation.type !== "ligand" && (
                      <div className="flex flex-wrap gap-1">
                        {annotation.residues.slice(0, 15).map((res, i) => (
                          <button
                            key={`${res.chain}-${res.number}-${i}`}
                            type="button"
                            onClick={() =>
                              onFocusAnnotation(annotation, {
                                type: "residue",
                                residue: res,
                              })
                            }
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono"
                            style={{
                              backgroundColor: annotation.color + "15",
                              color: annotation.color,
                              border: `1px solid ${annotation.color}20`,
                            }}
                            title="Focus this residue"
                          >
                            {annotation.type === "mutation"
                              ? res.name
                              : `${res.name}${res.number}`}
                            {res.distance
                              ? ` (${res.distance.toFixed(1)}Å)`
                              : ""}
                          </button>
                        ))}
                        {annotation.residues.length > 15 && (
                          <span className="text-[10px] text-white/30 self-center ml-1">
                            +{annotation.residues.length - 15} more
                          </span>
                        )}
                      </div>
                    )}

                  {annotation.type === "binding-site" &&
                    annotation.residues.length > 0 && (
                      <div className="mt-2 border-t border-white/5 pt-2">
                        <div className="text-[10px] text-white/35 mb-1.5 uppercase tracking-wide">
                          Residue details
                        </div>
                        <div className="space-y-1.5">
                          {annotation.residues
                            .slice(0, 20)
                            .map((residue, i) => {
                              const hasMutation = mutationPositionSet.has(
                                residue.number,
                              );
                              return (
                                <button
                                  key={`binding-detail-${residue.chain}-${residue.number}-${i}`}
                                  type="button"
                                  onClick={() =>
                                    onFocusAnnotation(annotation, {
                                      type: "residue",
                                      residue,
                                    })
                                  }
                                  className="w-full text-left rounded-md border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/15 px-2 py-1.5 transition-colors"
                                  title="Focus this residue"
                                >
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className="text-[10px] px-1.5 py-0.5 rounded border"
                                      style={{
                                        backgroundColor:
                                          annotation.color + "15",
                                        color: annotation.color,
                                        borderColor: annotation.color + "30",
                                      }}
                                    >
                                      {`${residue.name}${residue.number}`}
                                    </span>
                                    <span className="text-[10px] text-white/50">
                                      Pos {residue.number}
                                      {residue.chain
                                        ? ` · Chain ${residue.chain}`
                                        : ""}
                                    </span>
                                    {hasMutation && (
                                      <span className="text-[10px] text-rose-300 border border-rose-500/30 rounded px-1.5 py-0.5">
                                        mutation reported
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-1 text-[10px] text-white/35 break-words">
                                    {residue.distance !== undefined
                                      ? `${residue.distance.toFixed(1)}Å from ligand`
                                      : "Distance to ligand not available"}
                                  </p>
                                </button>
                              );
                            })}
                          {annotation.residues.length > 20 && (
                            <p className="text-[10px] text-white/30">
                              +{annotation.residues.length - 20} more residues
                              in this binding site.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                  {annotation.type === "ligand" && annotation.ligandName && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onFocusAnnotation(annotation, { type: "ligand" })
                        }
                        className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium"
                        style={{
                          backgroundColor: annotation.color + "15",
                          color: annotation.color,
                          border: `1px solid ${annotation.color}20`,
                        }}
                        title="Focus ligand region"
                      >
                        {annotation.ligandName}
                      </button>
                      <span className="text-[10px] text-white/30">
                        molecule in structure
                      </span>
                    </div>
                  )}

                  {annotation.type === "mutation" &&
                    annotation.mutationDetails &&
                    annotation.mutationDetails.length > 0 && (
                      <div className="mt-2 border-t border-white/5 pt-2">
                        <div className="text-[10px] text-white/35 mb-1.5 uppercase tracking-wide">
                          Mutation details
                        </div>
                        <div className="space-y-1.5">
                          {annotation.mutationDetails
                            .slice(0, 20)
                            .map((detail, i) => {
                              const riskStyle = mutationRiskStyle(detail);
                              return (
                                <button
                                  key={`${detail.tag}-${detail.position}-${i}`}
                                  type="button"
                                  onClick={() =>
                                    onFocusAnnotation(annotation, {
                                      type: "residue",
                                      residue: {
                                        chain: detail.chain,
                                        number: detail.position,
                                        name: detail.tag,
                                        distance: detail.distanceToLigand,
                                      },
                                    })
                                  }
                                  className={cn(
                                    "w-full text-left rounded-md border px-2 py-1.5 transition-colors",
                                    riskStyle.rowClass,
                                  )}
                                  title="Focus this mutation site"
                                >
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className="text-[10px] px-1.5 py-0.5 rounded border"
                                      style={{
                                        backgroundColor:
                                          annotation.color + "15",
                                        color: annotation.color,
                                        borderColor: annotation.color + "30",
                                      }}
                                    >
                                      {detail.tag}
                                    </span>
                                    <span className="text-[10px] text-white/50">
                                      Pos {detail.position}
                                      {detail.chain
                                        ? ` · Chain ${detail.chain}`
                                        : ""}
                                    </span>
                                    {detail.evidenceTier && (
                                      <span className="text-[10px] text-white/45 border border-white/10 rounded px-1.5 py-0.5">
                                        {detail.evidenceTier}
                                      </span>
                                    )}
                                    <span
                                      className={cn(
                                        "text-[10px] rounded px-1.5 py-0.5 border",
                                        riskStyle.badgeClass,
                                      )}
                                    >
                                      {riskStyle.label}
                                    </span>
                                    {detail.inBindingPocket && (
                                      <span className="text-[10px] text-emerald-300 border border-emerald-500/30 rounded px-1.5 py-0.5">
                                        in pocket
                                      </span>
                                    )}
                                  </div>
                                  {(detail.clinicalSignificance ||
                                    detail.diseaseAssociation ||
                                    detail.distanceToLigand !== undefined) && (
                                    <p className="mt-1 text-[10px] text-white/35 break-words">
                                      {detail.clinicalSignificance
                                        ? `${detail.clinicalSignificance}`
                                        : "No clinical label"}
                                      {detail.diseaseAssociation
                                        ? ` · ${detail.diseaseAssociation}`
                                        : ""}
                                      {detail.distanceToLigand !== undefined
                                        ? ` · ${detail.distanceToLigand.toFixed(1)}Å from ligand`
                                        : ""}
                                    </p>
                                  )}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
