// MCP Types Re-export
export * from "@/types/mcp";

// Common MCP utilities
export function formatResidueSelection(
  chain: string,
  residueNumber: number,
  residueName?: string,
): string {
  return residueName
    ? `${chain}:${residueName}:${residueNumber}`
    : `${chain}:${residueNumber}`;
}

export function parseResidueSelection(selection: string): {
  chain: string;
  residueNumber: number;
  residueName?: string;
} | null {
  const parts = selection.split(":");
  if (parts.length < 2) return null;

  return {
    chain: parts[0],
    residueName: parts.length === 3 ? parts[1] : undefined,
    residueNumber: parseInt(parts[parts.length - 1], 10),
  };
}

// Helper to extract common drug patterns from text
export function extractDrugName(text: string): string | null {
  // Common drug suffixes
  const drugPatterns = [
    /\b([A-Z][a-z]+(?:ilin|pirin|cillin|mycin|mab|nib|zole|pine|statin|pril|olol|sartan|dipine|prazole))\b/i,
    /\b(aspirin|ibuprofen|penicillin|insulin|metformin|acetaminophen|paracetamol)\b/i,
  ];

  for (const pattern of drugPatterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// Helper to extract protein/gene names
export function extractProteinName(text: string): string | null {
  // Common gene name patterns
  const genePattern = /\b([A-Z]{2,}[0-9]*[A-Z]?)\b/;
  const match = text.match(genePattern);
  return match ? match[1] : null;
}

// Helper to extract PDB ID
export function extractPdbId(text: string): string | null {
  const pdbPattern = /\b([1-9][A-Z0-9]{3})\b/i;
  const match = text.match(pdbPattern);
  return match ? match[1].toUpperCase() : null;
}
