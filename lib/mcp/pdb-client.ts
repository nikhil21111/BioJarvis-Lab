import { PDBStructure, MCPToolResult } from "@/types/mcp";

const PDB_DATA_URL = "https://data.rcsb.org/rest/v1";
const PDB_SEARCH_URL = "https://search.rcsb.org/rcsbsearch/v2/query";

// Get structure details by PDB ID
export async function pdbGetStructure(
  pdbId: string,
): Promise<MCPToolResult<PDBStructure>> {
  const startTime = Date.now();

  try {
    const normalizedId = pdbId.toUpperCase().trim();

    // Get entry details
    const entryResponse = await fetch(
      `${PDB_DATA_URL}/core/entry/${normalizedId}`,
      { next: { revalidate: 86400 } },
    );

    if (!entryResponse.ok) {
      throw new Error(`PDB entry ${pdbId} not found`);
    }

    const entryData = await entryResponse.json();

    // Get polymer entities for organism info
    let organism = "";
    if (entryData.rcsb_entry_container_identifiers?.polymer_entity_ids) {
      const entityId =
        entryData.rcsb_entry_container_identifiers.polymer_entity_ids[0];
      const entityResponse = await fetch(
        `${PDB_DATA_URL}/core/polymer_entity/${normalizedId}/${entityId}`,
        { next: { revalidate: 86400 } },
      );
      if (entityResponse.ok) {
        const entityData = await entityResponse.json();
        organism =
          entityData.rcsb_entity_source_organism?.[0]?.scientific_name || "";
      }
    }

    // Get ligand information
    const ligands: PDBStructure["ligands"] = [];
    const ligandIds =
      entryData.rcsb_entry_container_identifiers?.non_polymer_entity_ids || [];

    for (const ligandEntityId of ligandIds) {
      try {
        const ligandResponse = await fetch(
          `${PDB_DATA_URL}/core/nonpolymer_entity/${normalizedId}/${ligandEntityId}`,
          { next: { revalidate: 86400 } },
        );
        if (ligandResponse.ok) {
          const ligandData = await ligandResponse.json();
          const compId = ligandData.pdbx_entity_nonpoly?.comp_id;
          if (compId && !["HOH", "DOD"].includes(compId)) {
            // Exclude water
            ligands.push({
              name: compId,
              fullName:
                ligandData.rcsb_nonpolymer_entity?.pdbx_description || compId,
            });
          }
        }
      } catch {
        // Skip ligand on error
      }
    }

    return {
      success: true,
      data: {
        pdbId: normalizedId,
        title: entryData.struct?.title || "",
        resolution: entryData.rcsb_entry_info?.resolution_combined?.[0] || null,
        method: entryData.exptl?.[0]?.method || "",
        organism,
        releaseDate: entryData.rcsb_accession_info?.initial_release_date,
        ligands,
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

// Rank and filter structures — prefer full-length, functional proteins over fragments
// Used by pdbSearchProtein to improve results for protein-only queries
async function rankStructures(structures: PDBStructure[]): Promise<
  Array<
    PDBStructure & {
      qualityScore: number;
    }
  >
> {
  const IRRELEVANT_LIGANDS = new Set([
    "HOH",
    "DOD",
    "CL",
    "NA",
    "CA",
    "MG",
    "ZN",
    "FE",
    "MN",
    "CO",
    "NI",
    "CU",
    "K",
    "SO4",
    "PO4",
    "GOL",
    "EDO",
    "PEG",
    "DMS",
    "ACT",
    "FMT",
    "BME",
    "BR",
    "IOD",
    "CD",
  ]);

  const ranked = structures.map((s) => {
    let score = 1000; // Base score

    // Penalty: peptide fragments are <50 residues (too short for functional studies)
    // For most proteins, we want structures > 100 residues
    // Title length is rough proxy for sequence length (non-perfect but works)
    const structureLengthHint = s.title.split(/[,;]/).length; // Count fragments in title
    if (structureLengthHint < 3) score -= 500; // Likely too short (peptide)

    // Title penalties for known fragment types
    if (
      s.title.match(/peptide|fragment|domain|linker|motif/i) &&
      !s.title.match(/full|complex|kinase|receptor/i)
    ) {
      score -= 200;
    }

    // Bonus: has drug/ligand (not just ions)
    const hasDrug = s.ligands?.some((l) => !IRRELEVANT_LIGANDS.has(l.name));
    if (hasDrug)
      score += 250; // Drug binding site = relevant
    else score -= 100; // Ion-only structures less useful

    // Bonus: human proteins (Homo sapiens)
    if (s.organism?.includes("Homo sapiens")) score += 150;

    // Resolution score: better (lower) resolution is better
    // Normalize 1-5Å to a 0-200 bonus
    if (s.resolution && s.resolution > 0) {
      const resBonus = Math.max(0, 200 - s.resolution * 40);
      score += resBonus;
    }

    // Bonus: X-ray structures are more common/reliable for drug discovery
    if (s.method?.includes("X-RAY")) score += 50;

    return { ...s, qualityScore: score };
  });

  // Sort by quality score (descending) then by resolution (ascending)
  ranked.sort((a, b) => {
    if (b.qualityScore !== a.qualityScore)
      return b.qualityScore - a.qualityScore;
    if (a.resolution && b.resolution) return a.resolution - b.resolution;
    return 0;
  });

  return ranked;
}

// Search for protein structures by gene name
export async function pdbSearchProtein(
  geneName: string,
): Promise<MCPToolResult<PDBStructure[]>> {
  const startTime = Date.now();

  try {
    const query = {
      query: {
        type: "group",
        logical_operator: "or",
        nodes: [
          {
            type: "terminal",
            service: "text",
            parameters: {
              attribute: "rcsb_entity_source_organism.rcsb_gene_name.value",
              operator: "exact_match",
              value: geneName.toUpperCase(),
            },
          },
          {
            type: "terminal",
            service: "text",
            parameters: {
              attribute: "rcsb_polymer_entity.pdbx_description",
              operator: "contains_phrase",
              value: geneName,
            },
          },
          // Also search by non-polymer (ligand/drug) description so drug names
          // like "Imatinib" find co-crystal structures directly
          {
            type: "terminal",
            service: "text",
            parameters: {
              attribute: "rcsb_nonpolymer_entity.pdbx_description",
              operator: "contains_phrase",
              value: geneName,
            },
          },
          // Search the overall entry title (often contains drug names)
          {
            type: "terminal",
            service: "text",
            parameters: {
              attribute: "struct.title",
              operator: "contains_phrase",
              value: geneName,
            },
          },
        ],
      },
      return_type: "entry",
      request_options: {
        results_content_type: ["experimental"],
        sort: [
          {
            sort_by: "rcsb_entry_info.resolution_combined",
            direction: "asc",
          },
        ],
        paginate: {
          start: 0,
          rows: 15,
        },
      },
    };

    const response = await fetch(PDB_SEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(query),
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      throw new Error(`PDB search failed: ${response.status}`);
    }

    const data = await response.json();
    const structures: PDBStructure[] = [];

    for (const result of data.result_set?.slice(0, 15) || []) {
      const structureResult = await pdbGetStructure(result.identifier);
      if (structureResult.success && structureResult.data) {
        structures.push(structureResult.data);
      }
    }

    // Rank structures: prefer full-length proteins over fragments
    const ranked = await rankStructures(structures);

    // Return top 5 after ranking
    return {
      success: true,
      data: ranked.slice(0, 5).map((s) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { qualityScore, ...rest } = s;
        return rest;
      }),
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

// Get binding site information for a structure using PDBe API (real data)
export async function pdbGetBindingSites(
  pdbId: string,
  ligandId?: string,
): Promise<MCPToolResult<PDBStructure["bindingSite"]>> {
  const startTime = Date.now();

  try {
    const normalizedId = pdbId.toUpperCase().trim();

    const residues: Array<{
      chain: string;
      number: number;
      name: string;
      distance?: number;
    }> = [];

    // Strategy 1: Use PDBe binding_sites API for real binding site data
    try {
      const bsResponse = await fetch(
        `https://www.ebi.ac.uk/pdbe/api/pdb/entry/binding_sites/${normalizedId.toLowerCase()}`,
        { next: { revalidate: 86400 } },
      );

      if (bsResponse.ok) {
        const bsData = await bsResponse.json();
        const sites = bsData[normalizedId.toLowerCase()] || [];

        for (const site of sites) {
          // If a specific ligand was requested, filter by it
          if (ligandId && site.ligand_residue_name !== ligandId) continue;

          // Skip common ions/solvents — these are not drug binding sites
          const skipLigands = [
            "HOH",
            "DOD",
            "CL",
            "NA",
            "CA",
            "MG",
            "ZN",
            "FE",
            "MN",
            "CO",
            "NI",
            "CU",
            "K",
            "SO4",
            "PO4",
            "GOL",
            "EDO",
            "PEG",
            "DMS",
            "ACT",
            "FMT",
            "BME",
            "BR",
            "IOD",
            "CD",
          ];
          if (!ligandId && skipLigands.includes(site.ligand_residue_name))
            continue;

          const siteResidues = site.site_residues || [];
          for (const res of siteResidues) {
            // Skip water molecules
            if (res.residue_name === "HOH" || res.residue_name === "DOD")
              continue;

            residues.push({
              chain: res.chain_id || "A",
              number: parseInt(res.residue_number, 10),
              name: res.residue_name || "",
              distance: res.distance ? parseFloat(res.distance) : undefined,
            });
          }

          // If we found residues for the target ligand, stop
          if (residues.length > 0) break;
        }
      }
    } catch {
      // PDBe binding_sites may not have data for all entries
    }

    // Strategy 2: bound_molecule_interactions (most reliable for drug-protein contacts)
    if (residues.length === 0) {
      try {
        // First find the bound molecule ID for our ligand
        const bmResponse = await fetch(
          `https://www.ebi.ac.uk/pdbe/graph-api/pdb/bound_molecules/${normalizedId.toLowerCase()}`,
          { next: { revalidate: 86400 } },
        );

        if (bmResponse.ok) {
          const bmData = await bmResponse.json();
          const boundMolecules = bmData[normalizedId.toLowerCase()] || [];

          // Find bound molecule matching our ligand, or pick the first non-sugar/non-water
          let targetBmId: string | null = null;
          for (const bm of boundMolecules) {
            const ligands = bm.composition?.ligands || [];
            for (const lig of ligands) {
              if (ligandId && lig.chem_comp_id === ligandId) {
                targetBmId = bm.bm_id;
                break;
              }
              // If no specific ligand, pick the first "Bound" type molecule
              if (
                !ligandId &&
                lig.molecule_type === "Bound" &&
                ![
                  "HOH",
                  "DOD",
                  "NAG",
                  "MAN",
                  "GOL",
                  "EDO",
                  "SO4",
                  "PO4",
                  "CL",
                  "NA",
                  "CA",
                  "MG",
                  "ZN",
                ].includes(lig.chem_comp_id)
              ) {
                targetBmId = bm.bm_id;
                break;
              }
            }
            if (targetBmId) break;
          }

          if (targetBmId) {
            const intResponse = await fetch(
              `https://www.ebi.ac.uk/pdbe/graph-api/pdb/bound_molecule_interactions/${normalizedId.toLowerCase()}/${targetBmId}`,
              { next: { revalidate: 86400 } },
            );

            if (intResponse.ok) {
              const intData = await intResponse.json();
              const interactions = intData[normalizedId.toLowerCase()] || [];

              const seen = new Set<string>();
              for (const entry of interactions) {
                for (const inter of entry.interactions || []) {
                  const end = inter.end;
                  if (!end || !end.author_residue_number) continue;
                  // Skip the ligand itself and water
                  if (end.chem_comp_id === ligandId) continue;
                  if (["HOH", "DOD"].includes(end.chem_comp_id)) continue;

                  const key = `${end.chain_id || "A"}_${end.author_residue_number}`;
                  if (seen.has(key)) continue;
                  seen.add(key);

                  residues.push({
                    chain: end.chain_id || "A",
                    number: parseInt(String(end.author_residue_number), 10),
                    name: end.chem_comp_id || "",
                  });
                }
              }
            }
          }
        }
      } catch {
        // bound_molecule_interactions fallback failed
      }
    }

    // Strategy 3: If PDBe binding_sites didn't return data, try ligand contacts API
    // Strategy 3: If still no data, try ligand contacts API
    if (residues.length === 0 && ligandId) {
      try {
        const contactsResponse = await fetch(
          `https://www.ebi.ac.uk/pdbe/graph-api/compound/contacts/${normalizedId.toLowerCase()}/${ligandId}`,
          { next: { revalidate: 86400 } },
        );

        if (contactsResponse.ok) {
          const contactsData = await contactsResponse.json();
          const contacts =
            contactsData[normalizedId.toLowerCase()] ||
            contactsData[ligandId] ||
            [];

          const seen = new Set<string>();
          for (const contact of contacts) {
            const key = `${contact.author_residue_number}_${contact.chain_id}`;
            if (seen.has(key)) continue;
            seen.add(key);

            residues.push({
              chain: contact.chain_id || "A",
              number: parseInt(contact.author_residue_number, 10),
              name: contact.residue_name || "",
              distance: contact.distance
                ? parseFloat(contact.distance)
                : undefined,
            });
          }
        }
      } catch {
        // Contacts API fallback failed
      }
    }

    // Strategy 4: If still no data, try PDBe residue listing around ligand
    if (residues.length === 0) {
      try {
        const ligResponse = await fetch(
          `https://www.ebi.ac.uk/pdbe/api/pdb/entry/ligand_monomers/${normalizedId.toLowerCase()}`,
          { next: { revalidate: 86400 } },
        );

        if (ligResponse.ok) {
          const ligData = await ligResponse.json();
          const monomers = ligData[normalizedId.toLowerCase()] || [];

          for (const monomer of monomers) {
            if (ligandId && monomer.chem_comp_id !== ligandId) continue;
            // Provide ligand position info even if we can't get full binding site
            if (
              monomer.chem_comp_id &&
              !["HOH", "DOD"].includes(monomer.chem_comp_id)
            ) {
              residues.push({
                chain: monomer.chain_id || "A",
                number: parseInt(monomer.author_residue_number || "0", 10),
                name: monomer.chem_comp_id,
              });
              break;
            }
          }
        }
      } catch {
        // Ligand monomers fallback failed
      }
    }

    return {
      success: residues.length > 0,
      data: residues.length > 0 ? { residues } : undefined,
      error:
        residues.length === 0
          ? `No binding site data found for ${pdbId}`
          : undefined,
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
// Search PDB for co-crystal structures of a SPECIFIC protein + drug
// Uses RCSB combined query: target by UniProt ID AND/OR ligand
// This avoids returning the WRONG protein with the right drug
// ──────────────────────────────────────────────────────────────────
export async function pdbSearchDrugTarget(
  uniprotId: string,
  drugName?: string,
): Promise<MCPToolResult<PDBStructure[]>> {
  const startTime = Date.now();

  try {
    // Build AND-combined query nodes
    const nodes: object[] = [
      {
        type: "terminal",
        service: "text",
        parameters: {
          attribute:
            "rcsb_polymer_entity_container_identifiers.reference_sequence_identifiers.database_accession",
          operator: "exact_match",
          value: uniprotId,
        },
      },
    ];

    if (drugName) {
      // Also require a ligand whose description contains the drug name
      nodes.push({
        type: "terminal",
        service: "text",
        parameters: {
          attribute: "rcsb_nonpolymer_entity.pdbx_description",
          operator: "contains_phrase",
          value: drugName,
        },
      });
    }

    const query = {
      query:
        nodes.length > 1
          ? { type: "group", logical_operator: "and", nodes }
          : nodes[0],
      return_type: "entry",
      request_options: {
        results_content_type: ["experimental"],
        sort: [
          { sort_by: "rcsb_entry_info.resolution_combined", direction: "asc" },
        ],
        paginate: { start: 0, rows: 5 },
      },
    };

    const response = await fetch(PDB_SEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(query),
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      // No results is common – not an error
      return { success: true, data: [], executionTime: Date.now() - startTime };
    }

    const data = await response.json();
    const structures: PDBStructure[] = [];

    for (const result of data.result_set?.slice(0, 5) || []) {
      const structureResult = await pdbGetStructure(result.identifier);
      if (structureResult.success && structureResult.data) {
        structures.push(structureResult.data);
      }
    }

    return {
      success: true,
      data: structures,
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

// Get PDB file URL
export function getPdbFileUrl(pdbId: string): string {
  return `https://files.rcsb.org/download/${pdbId.toUpperCase()}.pdb`;
}

// Get mmCIF file URL
export function getMmcifFileUrl(pdbId: string): string {
  return `https://files.rcsb.org/download/${pdbId.toUpperCase()}.cif`;
}
