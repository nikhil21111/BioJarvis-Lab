// MCP (Model Context Protocol) Types

export interface ChEMBLTarget {
  gene: string;
  protein: string;
  uniprotId: string;
  mechanism: string;
  confidence: number;
  pdbIds: string[];
}

export interface ChEMBLBioactivity {
  moleculeName: string;
  moleculeChemblId: string;
  targetName: string;
  targetChemblId: string;
  standardType: string; // IC50, Ki, EC50, Kd, etc.
  standardValue: number | null;
  standardUnits: string | null;
  standardRelation: string | null; // '=', '<', '>', etc.
  assayType: string | null; // 'B' (binding), 'F' (functional), 'A' (ADMET)
  pchemblValue: number | null; // -log(molar IC50/Ki) — comparable across assays
}

export interface ChEMBLDrugData {
  drug: string;
  chemblId: string;
  synonyms?: string[];
  molecularFormula?: string;
  molecularWeight?: number;
  targets: ChEMBLTarget[];
  bioactivities?: ChEMBLBioactivity[];
}

export interface PDBStructure {
  pdbId: string;
  title: string;
  resolution: number | null;
  method: string;
  organism: string;
  releaseDate?: string;
  ligands: Array<{
    name: string;
    fullName: string;
  }>;
  bindingSite?: {
    residues: Array<{
      chain: string;
      number: number;
      name: string;
      distance?: number;
    }>;
  };
}

export interface UniProtVariant {
  position: number;
  original: string; // Wild-type residue (1-letter code)
  variant: string; // Mutant residue (1-letter code)
  label: string; // e.g. "T315I"
  description: string; // Clinical/functional description
  clinicalSignificance?: string; // "Pathogenic", "Likely pathogenic", etc.
  diseaseAssociation?: string; // Associated disease name
  evidences?: string[];
  somaticStatus?: string; // "somatic", "germline"
}

export interface UniProtProtein {
  accession: string;
  name: string;
  fullName: string;
  organism: string;
  sequence?: string;
  length: number;
  function?: string;
  subcellularLocation?: string[];
  domains: Array<{
    name: string;
    start: number;
    end: number;
    description?: string;
  }>;
  features: Array<{
    type: string;
    location: string;
    description?: string;
  }>;
}

export interface PubMedArticle {
  pmid: string;
  title: string;
  abstract?: string;
  authors: string[];
  journal: string;
  publicationDate: string;
  doi?: string;
  url: string;
}

export interface MCPToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  cached?: boolean;
  executionTime?: number;
}

export type MCPToolName =
  | "chembl_get_targets"
  | "chembl_get_bioactivity"
  | "chembl_search_compound"
  | "pdb_get_structure"
  | "pdb_search_protein"
  | "pdb_get_binding_sites"
  | "uniprot_get_protein"
  | "uniprot_get_domains"
  | "pubmed_search"
  | "pubmed_get_abstract"
  | "llm_entity_extraction";
