import { NextRequest, NextResponse } from "next/server";
import { processQueryWithGroq } from "@/lib/ai/groq-client";

interface FollowUpTurn {
  question: string;
}

// Test endpoint to simulate same-chat follow-up behavior without auth.
// Runs turns sequentially and passes conversation history + follow-up memory.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const turns = (body?.turns || []) as FollowUpTurn[];

    if (!Array.isArray(turns) || turns.length === 0) {
      return NextResponse.json(
        { error: "Invalid payload", message: "Provide turns: [{question}]" },
        { status: 400 },
      );
    }

    const conversationHistory: Array<{
      role: "user" | "assistant";
      content: string;
    }> = [];
    let lastStructureContext:
      | {
          pdbId?: string;
          ligand?: string;
          title?: string;
          bindingSiteResidues?: string[];
        }
      | undefined;
    let lastAssistantAnswer: string | undefined;

    const results: Array<{
      turn: number;
      question: string;
      intentRoute?: "text_only" | "structure_required";
      structureDecision?: string;
      compareMode?: boolean;
      compareReason?: string;
      evidenceClaims?: {
        count: number;
        topSources: string[];
      };
      structure?: {
        pdbId: string;
        bindingSiteResidues?: number;
        ligand?: string;
        structureConfidence?: "high" | "medium" | "low";
        mutationCount?: number;
        mutationEvidence?: string;
        bindingSiteEvidence?: string;
        ligandEvidence?: string;
        sampleMutations?: string[];
      } | null;
      compareStructures?: Array<{
        pdbId: string;
        ligand?: string;
        bindingSiteResidues?: number;
      }>;
      toolsCalled: string[];
      durationMs?: number;
    }> = [];

    for (let index = 0; index < turns.length; index++) {
      const question = turns[index]?.question?.trim();
      if (!question) continue;

      const start = Date.now();
      const response = await processQueryWithGroq(
        question,
        "test-followup-user",
        lastStructureContext,
        conversationHistory,
        {
          structureContext: lastStructureContext,
          lastAssistantAnswer,
        },
      );

      results.push({
        turn: index + 1,
        question,
        intentRoute: response.metadata.intentRoute,
        structureDecision: response.metadata.structureDecision,
        compareMode: response.metadata.compareMode,
        compareReason: response.metadata.compareReason,
        evidenceClaims: {
          count: response.evidenceClaims?.length || 0,
          topSources:
            response.evidenceClaims
              ?.slice(0, 3)
              .map((claim) => claim.sourceType) || [],
        },
        structure: response.structure
          ? {
              pdbId: response.structure.pdbId,
              bindingSiteResidues:
                response.structure.bindingSite?.residues?.length,
              ligand: response.structure.ligand,
              structureConfidence:
                response.structure.annotationProvenance?.structureConfidence,
              mutationCount: response.structure.mutations?.length,
              mutationEvidence:
                response.structure.annotationProvenance?.mutationEvidence,
              bindingSiteEvidence:
                response.structure.annotationProvenance?.bindingSiteEvidence,
              ligandEvidence:
                response.structure.annotationProvenance?.ligandEvidence,
              sampleMutations: response.structure.mutations
                ?.slice(0, 5)
                .map((m) => m.label),
            }
          : null,
        compareStructures:
          response.compareStructures?.map((structure) => ({
            pdbId: structure.pdbId,
            ligand: structure.ligand,
            bindingSiteResidues: structure.bindingSite?.residues?.length,
          })) || [],
        toolsCalled: response.metadata.toolsCalled,
        durationMs: Date.now() - start,
      });

      conversationHistory.push({ role: "user", content: question });
      conversationHistory.push({
        role: "assistant",
        content: response.text.slice(0, 1800),
      });
      if (conversationHistory.length > 8) {
        conversationHistory.splice(0, conversationHistory.length - 8);
      }

      lastAssistantAnswer = response.text;
      if (response.structure?.pdbId) {
        lastStructureContext = {
          pdbId: response.structure.pdbId,
          ligand: response.structure.ligand,
          title: response.structure.title,
          bindingSiteResidues: response.structure.bindingSite?.residues?.map(
            (r) => `${r.chain || "A"}:${r.number}`,
          ),
        };
      }
    }

    return NextResponse.json({
      success: true,
      turns: results,
      finalStructureContext: lastStructureContext || null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
