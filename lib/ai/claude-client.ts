import Anthropic from "@anthropic-ai/sdk";
import { getFullSystemPrompt } from "./prompts";
import { CLAUDE_TOOLS, ToolName, ToolInputs } from "./tools";
import { chemblGetTargets } from "@/lib/mcp/chembl-client";
import {
  pdbGetStructure,
  pdbSearchProtein,
  pdbGetBindingSites,
} from "@/lib/mcp/pdb-client";
import { uniprotGetProtein } from "@/lib/mcp/uniprot-client";
import { pubmedSearch } from "@/lib/mcp/pubmed-client";
import { alphafoldGetStructure } from "@/lib/mcp/alphafold-client";

// Initialize Anthropic client
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export interface AIResponse {
  text: string;
  structure?: {
    pdbId: string;
    title?: string;
    highlight?: string[];
    ligand?: string;
    bindingSite?: {
      residues: Array<{
        chain: string;
        number: number;
        name: string;
        distance?: number;
      }>;
      name?: string;
    };
    isAlphaFold?: boolean;
  };
  sources?: string[];
  metadata: {
    tokensUsed: number;
    executionTime: number;
    toolsCalled: string[];
  };
}

// Collected structure data from tool results (extracted server-side, not from LLM text)
interface CollectedStructureData {
  pdbId?: string;
  title?: string;
  highlight?: string[];
  ligand?: string;
  bindingSite?: AIResponse["structure"] extends infer S
    ? S extends { bindingSite?: infer B }
      ? B
      : never
    : never;
  uniprotId?: string;
  isAlphaFold?: boolean;
}

// Execute a tool call and collect structure data from results
async function executeTool(
  toolName: ToolName,
  toolInput: ToolInputs[ToolName],
  collected: CollectedStructureData,
): Promise<string> {
  try {
    let result: unknown;

    switch (toolName) {
      case "chembl_get_targets": {
        const chemblResult = await chemblGetTargets(
          (toolInput as ToolInputs["chembl_get_targets"]).drug_name,
        );
        result = chemblResult;

        // Extract PDB ID and UniProt ID from ChEMBL tool result
        if (chemblResult.success && chemblResult.data) {
          const target = chemblResult.data.targets?.[0];
          if (target) {
            if (target.pdbIds?.length && !collected.pdbId) {
              collected.pdbId = target.pdbIds[0];
            }
            if (target.uniprotId) {
              collected.uniprotId = target.uniprotId;
            }
            if (target.mechanism) {
              collected.highlight = collected.highlight || [];
            }
          }
        }
        break;
      }
      case "pdb_get_structure": {
        const pdbResult = await pdbGetStructure(
          (toolInput as ToolInputs["pdb_get_structure"]).pdb_id,
        );
        result = pdbResult;

        // Extract structure data directly from PDB tool result
        if (pdbResult.success && pdbResult.data) {
          collected.pdbId = pdbResult.data.pdbId;
          collected.title = pdbResult.data.title;
          if (pdbResult.data.ligands?.length) {
            collected.ligand = pdbResult.data.ligands[0].name;
          }
        }
        break;
      }
      case "pdb_search_protein": {
        const searchResult = await pdbSearchProtein(
          (toolInput as ToolInputs["pdb_search_protein"]).gene_name,
        );
        result = searchResult;

        // Extract best structure from search results
        if (
          searchResult.success &&
          searchResult.data?.length &&
          !collected.pdbId
        ) {
          const bestStructure = searchResult.data[0];
          collected.pdbId = bestStructure.pdbId;
          collected.title = bestStructure.title;
          if (bestStructure.ligands?.length) {
            collected.ligand = bestStructure.ligands[0].name;
          }
        }
        break;
      }
      case "pdb_get_binding_sites": {
        const input = toolInput as ToolInputs["pdb_get_binding_sites"];
        const bsResult = await pdbGetBindingSites(
          input.pdb_id,
          input.ligand_id,
        );
        result = bsResult;

        // Extract binding site residues from result
        if (bsResult.success && bsResult.data?.residues?.length) {
          collected.bindingSite = {
            residues: bsResult.data.residues,
            name: input.ligand_id,
          };
          // Build highlight array from real residues
          collected.highlight = bsResult.data.residues.map(
            (r: { chain: string; number: number; name: string }) =>
              `${r.chain}:${r.name}:${r.number}`,
          );
        }
        break;
      }
      case "alphafold_get_structure": {
        const input = toolInput as ToolInputs["alphafold_get_structure"];
        const afResult = await alphafoldGetStructure(input.uniprot_id);
        result = afResult;

        // Extract AlphaFold structure data
        if (afResult.success && afResult.data && !collected.pdbId) {
          collected.pdbId = afResult.data.entryId;
          collected.title = afResult.data.title;
          collected.isAlphaFold = true;
        }
        break;
      }
      case "uniprot_get_protein": {
        const uniResult = await uniprotGetProtein(
          (toolInput as ToolInputs["uniprot_get_protein"]).accession,
        );
        result = uniResult;

        // Save UniProt ID for possible AlphaFold fallback
        if (uniResult.success && uniResult.data) {
          collected.uniprotId = uniResult.data.accession;
        }
        break;
      }
      case "pubmed_search": {
        const pubmedInput = toolInput as ToolInputs["pubmed_search"];
        result = await pubmedSearch(pubmedInput.query, pubmedInput.limit || 5);
        break;
      }
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }

    return JSON.stringify(result, null, 2);
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
}

// Parse AI response text - used as fallback when tool results don't provide structure
function parseAIResponse(text: string): {
  text: string;
  structure?: AIResponse["structure"];
  sources?: string[];
} {
  // Try to extract JSON from various formats LLMs produce
  const cleanedText = text
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();

  try {
    const parsed = JSON.parse(cleanedText);
    return {
      text: parsed.text || text,
      structure: parsed.structure,
      sources: parsed.sources,
    };
  } catch {
    // Try to find a JSON block within the text - use a non-greedy approach
    const jsonPatterns = [
      /\{[^{}]*"text"\s*:.*?"structure"\s*:\s*\{[^{}]*\}[^{}]*\}/s,
      /\{[^{}]*"text"\s*:[^{}]*\}/s,
    ];

    for (const pattern of jsonPatterns) {
      const match = cleanedText.match(pattern);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          return {
            text: parsed.text || text,
            structure: parsed.structure,
            sources: parsed.sources,
          };
        } catch {
          continue;
        }
      }
    }

    return { text };
  }
}

// Main function to process user queries
export async function processQuery(question: string): Promise<AIResponse> {
  const startTime = Date.now();
  const toolsCalled: string[] = [];
  let totalTokens = 0;

  // Collected structure data extracted directly from tool results
  const collectedStructure: CollectedStructureData = {};

  const systemPrompt = getFullSystemPrompt();

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: question },
  ];

  const finalResponse: AIResponse = {
    text: "",
    metadata: {
      tokensUsed: 0,
      executionTime: 0,
      toolsCalled: [],
    },
  };

  // Multi-turn conversation loop for tool calls
  let continueLoop = true;
  let iterations = 0;
  const maxIterations = 5;

  while (continueLoop && iterations < maxIterations) {
    iterations++;

    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system: systemPrompt,
        messages,
        tools: CLAUDE_TOOLS,
      });

      totalTokens +=
        (response.usage?.input_tokens || 0) +
        (response.usage?.output_tokens || 0);

      // Check if Claude wants to use tools
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
      );

      if (toolUseBlocks.length === 0) {
        // No more tools, get final text
        const textBlock = response.content.find(
          (block): block is Anthropic.TextBlock => block.type === "text",
        );

        if (textBlock) {
          const parsed = parseAIResponse(textBlock.text);
          finalResponse.text = parsed.text;

          // Use structure data collected from tool results (reliable)
          // Only fall back to parsed AI text if tools didn't provide structure
          if (collectedStructure.pdbId) {
            finalResponse.structure = {
              pdbId: collectedStructure.pdbId,
              title: collectedStructure.title,
              highlight: collectedStructure.highlight,
              ligand: collectedStructure.ligand,
              bindingSite: collectedStructure.bindingSite,
              isAlphaFold: collectedStructure.isAlphaFold,
            };
          } else if (parsed.structure?.pdbId) {
            // Fallback: use AI-parsed structure data
            finalResponse.structure = parsed.structure;
          }

          finalResponse.sources = parsed.sources;
        }

        continueLoop = false;
      } else {
        // Execute tools and collect structure data
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const toolUse of toolUseBlocks) {
          toolsCalled.push(toolUse.name);

          const toolResult = await executeTool(
            toolUse.name as ToolName,
            toolUse.input as ToolInputs[ToolName],
            collectedStructure,
          );

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: toolResult,
          });
        }

        // After tools run, try to fetch binding sites if we have a PDB ID but no binding site yet
        if (
          collectedStructure.pdbId &&
          !collectedStructure.bindingSite &&
          !collectedStructure.isAlphaFold
        ) {
          try {
            const bsResult = await pdbGetBindingSites(
              collectedStructure.pdbId,
              collectedStructure.ligand,
            );
            if (bsResult.success && bsResult.data?.residues?.length) {
              collectedStructure.bindingSite = {
                residues: bsResult.data.residues,
                name: collectedStructure.ligand,
              };
              collectedStructure.highlight = bsResult.data.residues.map(
                (r: { chain: string; number: number; name: string }) =>
                  `${r.chain}:${r.name}:${r.number}`,
              );
            }
          } catch {
            // Binding site fetch is best-effort
          }
        }

        // Add assistant's response and tool results to messages
        messages.push(
          { role: "assistant", content: response.content },
          { role: "user", content: toolResults },
        );
      }
    } catch (error) {
      console.error("Claude API error:", error);
      finalResponse.text = `I encountered an error while processing your request: ${
        error instanceof Error ? error.message : "Unknown error"
      }. Please try again.`;
      continueLoop = false;
    }
  }

  // If we have a PDB ID from tools but no structure was set yet (edge case)
  if (!finalResponse.structure && collectedStructure.pdbId) {
    finalResponse.structure = {
      pdbId: collectedStructure.pdbId,
      title: collectedStructure.title,
      highlight: collectedStructure.highlight,
      ligand: collectedStructure.ligand,
      bindingSite: collectedStructure.bindingSite,
      isAlphaFold: collectedStructure.isAlphaFold,
    };
  }

  finalResponse.metadata = {
    tokensUsed: totalTokens,
    executionTime: Date.now() - startTime,
    toolsCalled,
  };

  return finalResponse;
}

// Simplified version for testing without tools
export async function processSimpleQuery(
  question: string,
): Promise<AIResponse> {
  const startTime = Date.now();

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system:
        "You are BioJarvis, a helpful bioinformatics assistant. Provide clear, accurate scientific information.",
      messages: [{ role: "user", content: question }],
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text",
    );

    return {
      text: textBlock?.text || "No response generated.",
      metadata: {
        tokensUsed:
          (response.usage?.input_tokens || 0) +
          (response.usage?.output_tokens || 0),
        executionTime: Date.now() - startTime,
        toolsCalled: [],
      },
    };
  } catch (error) {
    return {
      text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      metadata: {
        tokensUsed: 0,
        executionTime: Date.now() - startTime,
        toolsCalled: [],
      },
    };
  }
}
