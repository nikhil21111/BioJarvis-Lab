import { UniProtProtein, UniProtVariant, MCPToolResult } from "@/types/mcp";

const UNIPROT_BASE_URL = "https://rest.uniprot.org/uniprotkb";

// Get protein information by UniProt accession
export async function uniprotGetProtein(
  accession: string,
): Promise<MCPToolResult<UniProtProtein>> {
  const startTime = Date.now();

  try {
    const response = await fetch(`${UNIPROT_BASE_URL}/${accession}.json`, {
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      throw new Error(`UniProt protein ${accession} not found`);
    }

    const data = await response.json();

    // Extract function description
    const functionComment = data.comments?.find(
      (c: { commentType: string }) => c.commentType === "FUNCTION",
    );
    const functionText = functionComment?.texts?.[0]?.value || "";

    // Extract subcellular locations
    const locationComment = data.comments?.find(
      (c: { commentType: string }) => c.commentType === "SUBCELLULAR LOCATION",
    );
    const locations: string[] = [];
    if (locationComment?.subcellularLocations) {
      for (const loc of locationComment.subcellularLocations) {
        if (loc.location?.value) {
          locations.push(loc.location.value);
        }
      }
    }

    // Extract domains
    const domains: UniProtProtein["domains"] = [];
    for (const feature of data.features || []) {
      if (feature.type === "Domain") {
        domains.push({
          name: feature.description || "Unknown domain",
          start: feature.location?.start?.value || 0,
          end: feature.location?.end?.value || 0,
          description: feature.description,
        });
      }
    }

    // Extract active site and binding site residues as special domain entries
    for (const feature of data.features || []) {
      if (feature.type === "Active site" || feature.type === "Binding site") {
        domains.push({
          name: `${feature.type}: ${feature.description || "catalytic residue"}`,
          start: feature.location?.start?.value || 0,
          end: feature.location?.end?.value || 0,
          description: feature.description || feature.type,
        });
      }
    }

    // Extract other features
    const features: UniProtProtein["features"] = [];
    for (const feature of (data.features || []).slice(0, 20)) {
      features.push({
        type: feature.type,
        location: `${feature.location?.start?.value || ""}-${feature.location?.end?.value || ""}`,
        description: feature.description,
      });
    }

    return {
      success: true,
      data: {
        accession: data.primaryAccession,
        name: data.uniProtkbId,
        fullName:
          data.proteinDescription?.recommendedName?.fullName?.value ||
          data.proteinDescription?.submissionNames?.[0]?.fullName?.value ||
          "",
        organism: data.organism?.scientificName || "",
        sequence: data.sequence?.value,
        length: data.sequence?.length || 0,
        function: functionText,
        subcellularLocation: locations,
        domains,
        features,
      },
      executionTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      executionTime: Date.now() - startTime,
    };
  }
}

// Search for proteins by gene name
export async function uniprotSearchByGene(
  geneName: string,
  organism?: string,
): Promise<MCPToolResult<UniProtProtein[]>> {
  const startTime = Date.now();

  try {
    let query = `gene:${geneName}`;
    if (organism) {
      query += ` AND organism_name:${organism}`;
    }
    query += " AND reviewed:true"; // Only reviewed (Swiss-Prot) entries

    const response = await fetch(
      `${UNIPROT_BASE_URL}/search?query=${encodeURIComponent(query)}&format=json&size=5`,
      { next: { revalidate: 86400 } },
    );

    if (!response.ok) {
      throw new Error(`UniProt search failed: ${response.status}`);
    }

    const data = await response.json();
    const proteins: UniProtProtein[] = [];

    for (const result of data.results || []) {
      const proteinResult = await uniprotGetProtein(result.primaryAccession);
      if (proteinResult.success && proteinResult.data) {
        proteins.push(proteinResult.data);
      }
    }

    return {
      success: true,
      data: proteins,
      executionTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      executionTime: Date.now() - startTime,
    };
  }
}

// Get protein domains
export async function uniprotGetDomains(
  accession: string,
): Promise<MCPToolResult<UniProtProtein["domains"]>> {
  const startTime = Date.now();

  try {
    const response = await fetch(`${UNIPROT_BASE_URL}/${accession}.json`, {
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      throw new Error(`UniProt protein ${accession} not found`);
    }

    const data = await response.json();

    const domains: UniProtProtein["domains"] = [];
    for (const feature of data.features || []) {
      if (feature.type === "Domain" || feature.type === "Region") {
        domains.push({
          name: feature.description || feature.type,
          start: feature.location?.start?.value || 0,
          end: feature.location?.end?.value || 0,
          description: feature.description,
        });
      }
    }

    return {
      success: true,
      data: domains,
      executionTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      executionTime: Date.now() - startTime,
    };
  }
}

// ──────────────────────────────────────────────────────────────────
// Get clinically relevant variants/mutations from UniProt
// Fetches Natural variant features — includes disease associations,
// drug resistance mutations, and functional variants.
// ──────────────────────────────────────────────────────────────────
export async function uniprotGetVariants(
  accession: string,
  options?: {
    drugName?: string; // Filter for drug-resistance variants
    bindingSiteResidues?: number[]; // Prioritize variants in binding site
  },
): Promise<MCPToolResult<UniProtVariant[]>> {
  const startTime = Date.now();

  try {
    const response = await fetch(`${UNIPROT_BASE_URL}/${accession}.json`, {
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      throw new Error(`UniProt protein ${accession} not found`);
    }

    const data = await response.json();
    const variants: UniProtVariant[] = [];

    // 1-letter amino acid codes lookup
    const aa3to1: Record<string, string> = {
      Ala: "A",
      Arg: "R",
      Asn: "N",
      Asp: "D",
      Cys: "C",
      Glu: "E",
      Gln: "Q",
      Gly: "G",
      His: "H",
      Ile: "I",
      Leu: "L",
      Lys: "K",
      Met: "M",
      Phe: "F",
      Pro: "P",
      Ser: "S",
      Thr: "T",
      Trp: "W",
      Tyr: "Y",
      Val: "V",
    };

    for (const feature of data.features || []) {
      if (feature.type !== "Natural variant") continue;

      const position = feature.location?.start?.value;
      if (!position) continue;

      // Parse alternativeSequence for original → variant
      const altSeq = feature.alternativeSequence;
      const original = altSeq?.originalSequence || "";
      const variant = altSeq?.alternativeSequences?.[0] || "";

      // Skip deletions, insertions, and multi-residue variants (complex)
      if (
        !original ||
        !variant ||
        original.length !== 1 ||
        variant.length !== 1
      )
        continue;

      // Extract disease association from evidences/description
      const description = feature.description || "";
      let clinicalSignificance: string | undefined;
      let diseaseAssociation: string | undefined;

      // Parse description for disease info: "In DISEASE_NAME; ..."
      const diseaseMatch = description.match(/^In\s+(.+?)(?:;|\.|\s*$)/i);
      if (diseaseMatch) {
        diseaseAssociation = diseaseMatch[1].trim();
        clinicalSignificance = "Pathogenic";
      }

      // Check for drug resistance mentions
      const isDrugResistance =
        description.toLowerCase().includes("resistant") ||
        description.toLowerCase().includes("resistance");
      if (isDrugResistance) {
        clinicalSignificance = "Drug resistance";
      }

      // Convert 3-letter to 1-letter if needed
      const orig1 =
        original.length === 3 ? aa3to1[original] || original : original;
      const var1 = variant.length === 3 ? aa3to1[variant] || variant : variant;

      variants.push({
        position,
        original: orig1,
        variant: var1,
        label: `${orig1}${position}${var1}`,
        description,
        clinicalSignificance,
        diseaseAssociation,
      });
    }

    // Sort: drug resistance first, then disease-associated, then by position
    variants.sort((a, b) => {
      if (
        a.clinicalSignificance === "Drug resistance" &&
        b.clinicalSignificance !== "Drug resistance"
      )
        return -1;
      if (
        b.clinicalSignificance === "Drug resistance" &&
        a.clinicalSignificance !== "Drug resistance"
      )
        return 1;
      if (a.diseaseAssociation && !b.diseaseAssociation) return -1;
      if (b.diseaseAssociation && !a.diseaseAssociation) return 1;
      if (options?.bindingSiteResidues) {
        const aInSite = options.bindingSiteResidues.includes(a.position);
        const bInSite = options.bindingSiteResidues.includes(b.position);
        if (aInSite && !bInSite) return -1;
        if (bInSite && !aInSite) return 1;
      }
      return a.position - b.position;
    });

    // Filter by drug name if specified
    let filtered = variants;
    if (options?.drugName) {
      const drugLower = options.drugName.toLowerCase();
      const drugRelated = variants.filter(
        (v) =>
          v.description.toLowerCase().includes(drugLower) ||
          v.clinicalSignificance === "Drug resistance",
      );
      if (drugRelated.length > 0) {
        filtered = drugRelated;
      }
    }

    return {
      success: true,
      data: filtered.slice(0, 25),
      executionTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      executionTime: Date.now() - startTime,
    };
  }
}
