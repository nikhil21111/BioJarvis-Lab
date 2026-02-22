import {
  ChEMBLDrugData,
  ChEMBLTarget,
  ChEMBLBioactivity,
  MCPToolResult,
} from "@/types/mcp";

const CHEMBL_BASE_URL = "https://www.ebi.ac.uk/chembl/api/data";

// Search for a drug and get its targets
export async function chemblGetTargets(
  drugName: string,
): Promise<MCPToolResult<ChEMBLDrugData>> {
  const startTime = Date.now();

  try {
    // Step 1: Search for the drug by name
    const searchResponse = await fetch(
      `${CHEMBL_BASE_URL}/molecule.json?pref_name__iexact=${encodeURIComponent(drugName)}`,
      { next: { revalidate: 86400 } }, // Cache for 24 hours
    );

    if (!searchResponse.ok) {
      throw new Error(`ChEMBL API error: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();

    if (!searchData.molecules || searchData.molecules.length === 0) {
      // Try searching by synonyms
      const synonymResponse = await fetch(
        `${CHEMBL_BASE_URL}/molecule.json?molecule_synonyms__molecule_synonym__iexact=${encodeURIComponent(drugName)}`,
        { next: { revalidate: 86400 } },
      );
      const synonymData = await synonymResponse.json();

      if (!synonymData.molecules || synonymData.molecules.length === 0) {
        throw new Error(`Drug "${drugName}" not found in ChEMBL`);
      }
      searchData.molecules = synonymData.molecules;
    }

    const molecule = searchData.molecules[0];
    const chemblId = molecule.molecule_chembl_id;

    // Step 2: Get drug mechanisms
    // CRITICAL: ChEMBL stores mechanisms under salt/prodrug forms, not the parent molecule.
    // e.g. Imatinib (CHEMBL941) has mechanisms under imatinib mesylate (CHEMBL1642).
    // Use parent_molecule_chembl_id to find mechanisms for all forms of the drug.
    let mechanismData: { mechanisms: Array<Record<string, string>> };
    const mechByParent = await fetch(
      `${CHEMBL_BASE_URL}/mechanism.json?parent_molecule_chembl_id=${chemblId}`,
      { next: { revalidate: 86400 } },
    );
    mechanismData = await mechByParent.json();

    // Fallback: if parent search returns nothing, try direct molecule_chembl_id
    if (!mechanismData.mechanisms || mechanismData.mechanisms.length === 0) {
      const mechDirect = await fetch(
        `${CHEMBL_BASE_URL}/mechanism.json?molecule_chembl_id=${chemblId}`,
        { next: { revalidate: 86400 } },
      );
      mechanismData = await mechDirect.json();
    }

    const targets: ChEMBLTarget[] = [];

    // Step 3: Get details for each target
    for (const mech of mechanismData.mechanisms || []) {
      if (mech.target_chembl_id) {
        try {
          const targetResponse = await fetch(
            `${CHEMBL_BASE_URL}/target/${mech.target_chembl_id}.json`,
            { next: { revalidate: 86400 } },
          );
          const targetData = await targetResponse.json();

          const components = targetData.target_components || [];
          const component = components[0];

          // Get PDB IDs associated with this target
          const pdbIds: string[] = [];
          if (component?.accession) {
            try {
              const pdbResponse = await fetch(
                `https://search.rcsb.org/rcsbsearch/v2/query`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    query: {
                      type: "terminal",
                      service: "text",
                      parameters: {
                        attribute:
                          "rcsb_polymer_entity_container_identifiers.reference_sequence_identifiers.database_accession",
                        operator: "exact_match",
                        value: component.accession,
                      },
                    },
                    return_type: "entry",
                    request_options: { results_content_type: ["experimental"] },
                  }),
                  next: { revalidate: 86400 },
                },
              );
              if (pdbResponse.ok) {
                const pdbData = await pdbResponse.json();
                if (pdbData.result_set) {
                  pdbIds.push(
                    ...pdbData.result_set
                      .slice(0, 8)
                      .map((r: { identifier: string }) => r.identifier),
                  );
                }
              }
            } catch (pdbError) {
              console.warn(
                `Error fetching PDB IDs for ${component.accession}:`,
                pdbError,
              );
            }
          }

          // Extract gene name: try gene_name first, then component_description, then target pref_name
          const geneName =
            component?.gene_name ||
            component?.component_description ||
            targetData.pref_name ||
            targetData.target_organism ||
            "";

          targets.push({
            gene: geneName,
            protein: targetData.pref_name || "",
            uniprotId: component?.accession || "",
            mechanism: mech.mechanism_of_action || "",
            confidence:
              mech.action_type === "INHIBITOR"
                ? 9
                : mech.action_type === "AGONIST"
                  ? 8
                  : 7,
            pdbIds,
          });
        } catch (targetError) {
          console.error(
            `Error fetching target ${mech.target_chembl_id}:`,
            targetError,
          );
        }
      }
    }

    return {
      success: true,
      data: {
        drug: molecule.pref_name || drugName,
        chemblId,
        synonyms:
          molecule.molecule_synonyms?.map(
            (s: { molecule_synonym: string }) => s.molecule_synonym,
          ) || [],
        molecularFormula: molecule.molecule_properties?.full_molformula,
        molecularWeight: molecule.molecule_properties?.full_mwt,
        targets,
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

// Search for compounds by target
export async function chemblSearchByTarget(
  targetName: string,
): Promise<MCPToolResult<ChEMBLDrugData[]>> {
  const startTime = Date.now();

  try {
    const targetResponse = await fetch(
      `${CHEMBL_BASE_URL}/target.json?pref_name__icontains=${encodeURIComponent(targetName)}`,
      { next: { revalidate: 86400 } },
    );
    const targetData = await targetResponse.json();

    if (!targetData.targets || targetData.targets.length === 0) {
      throw new Error(`Target "${targetName}" not found`);
    }

    const drugs: ChEMBLDrugData[] = [];
    const targetChemblId = targetData.targets[0].target_chembl_id;

    // Get mechanisms for this target
    const mechResponse = await fetch(
      `${CHEMBL_BASE_URL}/mechanism.json?target_chembl_id=${targetChemblId}`,
      { next: { revalidate: 86400 } },
    );
    const mechData = await mechResponse.json();

    for (const mech of mechData.mechanisms?.slice(0, 10) || []) {
      if (mech.molecule_chembl_id) {
        const molResponse = await fetch(
          `${CHEMBL_BASE_URL}/molecule/${mech.molecule_chembl_id}.json`,
          { next: { revalidate: 86400 } },
        );
        const molData = await molResponse.json();

        drugs.push({
          drug: molData.pref_name || mech.molecule_chembl_id,
          chemblId: mech.molecule_chembl_id,
          targets: [
            {
              gene: targetData.targets[0].organism || "",
              protein: targetData.targets[0].pref_name || "",
              uniprotId:
                targetData.targets[0].target_components?.[0]?.accession || "",
              mechanism: mech.mechanism_of_action || "",
              confidence: 8,
              pdbIds: [],
            },
          ],
        });
      }
    }

    return {
      success: true,
      data: drugs,
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

// Get bioactivity data (IC50, Ki, EC50, Kd) for a drug against its targets
export async function chemblGetBioactivity(
  chemblId: string,
  targetChemblId?: string,
): Promise<MCPToolResult<ChEMBLBioactivity[]>> {
  const startTime = Date.now();

  try {
    // Build query: filter by molecule, optionally by target, and only standard assay types
    let url = `${CHEMBL_BASE_URL}/activity.json?molecule_chembl_id=${chemblId}&standard_type__in=IC50,Ki,EC50,Kd&limit=25`;
    if (targetChemblId) {
      url += `&target_chembl_id=${targetChemblId}`;
    }

    const response = await fetch(url, { next: { revalidate: 86400 } });

    if (!response.ok) {
      throw new Error(`ChEMBL bioactivity API error: ${response.status}`);
    }

    const data = await response.json();
    const activities: ChEMBLBioactivity[] = [];
    const seen = new Set<string>();

    for (const act of data.activities || []) {
      // Deduplicate by type+target+value
      const key = `${act.standard_type}_${act.target_chembl_id}_${act.standard_value}`;
      if (seen.has(key)) continue;
      seen.add(key);

      activities.push({
        moleculeName:
          act.molecule_pref_name || act.molecule_chembl_id || chemblId,
        moleculeChemblId: act.molecule_chembl_id || chemblId,
        targetName: act.target_pref_name || "",
        targetChemblId: act.target_chembl_id || "",
        standardType: act.standard_type || "",
        standardValue: act.standard_value
          ? parseFloat(act.standard_value)
          : null,
        standardUnits: act.standard_units || null,
        standardRelation: act.standard_relation || null,
        assayType: act.assay_type || null,
        pchemblValue: act.pchembl_value ? parseFloat(act.pchembl_value) : null,
      });
    }

    // Sort by pchembl_value descending (higher = more potent) if available
    activities.sort((a, b) => (b.pchemblValue || 0) - (a.pchemblValue || 0));

    return {
      success: true,
      data: activities.slice(0, 15), // Top 15 most relevant
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
