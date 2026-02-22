import Anthropic from '@anthropic-ai/sdk'

// Tool definitions for Claude
export const CLAUDE_TOOLS: Anthropic.Tool[] = [
  {
    name: 'chembl_get_targets',
    description: `Search the ChEMBL database for a drug and retrieve its protein targets and mechanism of action.
Returns: drug name, ChEMBL ID, target genes, proteins, mechanisms, and associated PDB structures.
Use this as the FIRST tool when answering drug mechanism questions.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        drug_name: {
          type: 'string',
          description: 'The name of the drug to search for (e.g., "Aspirin", "Ibuprofen", "Metformin")',
        },
      },
      required: ['drug_name'],
    },
  },
  {
    name: 'pdb_get_structure',
    description: `Get detailed information about a protein structure from the PDB database.
Returns: PDB ID, title, resolution, experimental method, organism, and ligand information.
Use this when you have a PDB ID and need structure details for visualization.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        pdb_id: {
          type: 'string',
          description: 'The 4-character PDB ID (e.g., "1EQG", "4HHB")',
        },
      },
      required: ['pdb_id'],
    },
  },
  {
    name: 'pdb_search_protein',
    description: `Search the PDB database for protein structures by gene or protein name.
Returns: List of matching PDB structures with their details.
Use this when you need to find structures for a protein but don't have a specific PDB ID.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        gene_name: {
          type: 'string',
          description: 'The gene or protein name to search for (e.g., "PTGS1", "COX1", "insulin")',
        },
      },
      required: ['gene_name'],
    },
  },
  {
    name: 'pdb_get_binding_sites',
    description: `Get binding site residues for a protein structure from PDBe.
Returns: List of residues in the binding site with chain, number, name, and distance.
Use this after getting a PDB structure to find where a drug or ligand binds.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        pdb_id: {
          type: 'string',
          description: 'The 4-character PDB ID (e.g., "1EQG")',
        },
        ligand_id: {
          type: 'string',
          description: 'Optional 3-letter ligand identifier (e.g., "ASA" for aspirin, "IBP" for ibuprofen)',
        },
      },
      required: ['pdb_id'],
    },
  },
  {
    name: 'alphafold_get_structure',
    description: `Get an AI-predicted protein structure from the AlphaFold database.
Returns: predicted structure file URL, confidence score (pLDDT), and metadata.
Use this as a FALLBACK when no experimental PDB structure is available for a protein.
Requires a UniProt accession ID (e.g., "P23219").`,
    input_schema: {
      type: 'object' as const,
      properties: {
        uniprot_id: {
          type: 'string',
          description: 'The UniProt accession ID (e.g., "P23219", "P00533")',
        },
      },
      required: ['uniprot_id'],
    },
  },
  {
    name: 'uniprot_get_protein',
    description: `Get detailed protein information from the UniProt database.
Returns: protein name, function, domains, sequence, subcellular location, and features.
Use this when you need comprehensive protein annotation data.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        accession: {
          type: 'string',
          description: 'The UniProt accession number (e.g., "P23219", "P00533")',
        },
      },
      required: ['accession'],
    },
  },
  {
    name: 'pubmed_search',
    description: `Search PubMed for relevant research articles.
Returns: List of articles with titles, authors, journals, and publication dates.
Use this to provide research references for drug mechanisms or proteins.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'The search query (e.g., "aspirin COX-1 mechanism")',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 5)',
        },
      },
      required: ['query'],
    },
  },
]

// Map tool names to their input types
export interface ToolInputs {
  chembl_get_targets: { drug_name: string }
  pdb_get_structure: { pdb_id: string }
  pdb_search_protein: { gene_name: string }
  pdb_get_binding_sites: { pdb_id: string; ligand_id?: string }
  alphafold_get_structure: { uniprot_id: string }
  uniprot_get_protein: { accession: string }
  pubmed_search: { query: string; limit?: number }
}

export type ToolName = keyof ToolInputs
