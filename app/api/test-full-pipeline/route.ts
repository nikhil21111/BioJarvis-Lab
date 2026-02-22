import { NextRequest, NextResponse } from "next/server";
import { processQueryWithGroq } from "@/lib/ai/groq-client";

// Full pipeline test — bypasses auth for testing only
// Tests the EXACT same path as a real user query: ChEMBL → PDB → PDBe → UniProt → Perplexity → PubMed → Groq LLM
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const question =
    searchParams.get("q") ||
    "How does erlotinib bind to EGFR and what are the key resistance mutations?";

  const startTime = Date.now();

  try {
    const result = await processQueryWithGroq(question, "test-user");

    return NextResponse.json({
      success: true,
      question,
      duration: Date.now() - startTime,
      structure: result.structure
        ? {
            pdbId: result.structure.pdbId,
            title: result.structure.title,
            ligand: result.structure.ligand,
            ligandFullName: result.structure.ligandFullName,
            isAlphaFold: result.structure.isAlphaFold,
            resolution: result.structure.resolution,
            method: result.structure.method,
            bindingSiteResidues:
              result.structure.bindingSite?.residues?.length || 0,
            bindingSiteName: result.structure.bindingSite?.name,
            sampleResidues: result.structure.bindingSite?.residues
              ?.slice(0, 5)
              .map(
                (r: { name: string; number: number; chain?: string }) =>
                  `${r.name}${r.number}(${r.chain || "?"})`,
              ),
            mutations: result.structure.mutations?.length || 0,
            highlightCount: result.structure.highlight?.length || 0,
          }
        : null,
      responsePreview: result.text.substring(0, 500) + "...",
      sources: result.sources?.map((s: { title: string; url: string }) => ({
        title: s.title.substring(0, 80),
        url: s.url,
      })),
      metadata: result.metadata,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        question,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      },
      { status: 500 },
    );
  }
}
