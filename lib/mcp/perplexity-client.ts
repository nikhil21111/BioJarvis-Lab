const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || "";

export interface ResearchResult {
  text: string;
  citations: string[];
}

// ──────────────────────────────────────────────────────────────────
// Perplexity Sonar: real-time web search for scientific accuracy
// Used to cross-verify MCP database data and fill knowledge gaps
// ──────────────────────────────────────────────────────────────────
export async function perplexityResearch(
  query: string,
  context?: string,
): Promise<ResearchResult> {
  if (!PERPLEXITY_API_KEY) {
    console.warn("[Perplexity] No API Key found. Skipping Perplexity.");
    return {
      text: "Research feature requires PERPLEXITY_API_KEY environment variable.",
      citations: [],
    };
  }

  try {
    console.log("[Perplexity] Starting research for:", query);

    const response = await fetch(PERPLEXITY_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: `You are a PhD-level bioinformatics research assistant. Provide scientifically accurate, detailed information about drug mechanisms, protein structures, molecular biology, and pharmacology.

REQUIREMENTS:
- Include specific residue numbers, domain names, and molecular interactions
- Mention the correct protein target (gene name, UniProt ID) for drugs
- Include the mechanism at the molecular level (e.g., "acetylates Ser530", "binds ATP pocket")
- State the downstream biological pathway affected
- Mention clinical significance and therapeutic applications
- If a drug has multiple targets, rank by clinical relevance
- Always distinguish between reversible vs irreversible inhibition
- Include Ki/IC50 values when known`,
          },
          {
            role: "user",
            content: context
              ? `${query}\n\nAdditional context from databases:\n${context}`
              : query,
          },
        ],
        temperature: 0.1,
        return_citations: true,
        search_recency_filter: "month",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Perplexity API Error: ${response.status} - ${errorText}`,
      );
    }

    const data = await response.json();
    const result =
      data.choices?.[0]?.message?.content || "No response content.";
    const citations = data.citations || [];

    console.log("[Perplexity] Research complete");

    return {
      text: result,
      citations: citations,
    };
  } catch (error) {
    console.error("[Perplexity] Research error:", error);
    return {
      text: "I couldn't complete the research request via Perplexity.",
      citations: [],
    };
  }
}
