// Application-level types

export interface Source {
  title: string;
  url: string;
  journal?: string;
  year?: string | number;
}

export interface EvidenceClaim {
  claim: string;
  confidence: "high" | "medium" | "low";
  sourceType: "pdb" | "uniprot" | "chembl" | "pubmed" | "web";
  sourceLabel: string;
  url?: string;
  evidence?: string;
}

export interface ClaimTraceabilityItem {
  sentence: string;
  sourceType: "pdb" | "uniprot" | "chembl" | "pubmed" | "web";
  sourceLabel: string;
  confidence: "high" | "medium" | "low";
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  structure?: StructureData;
  compareStructures?: StructureData[];
  sources?: Source[];
  evidenceClaims?: EvidenceClaim[];
  claimTraceability?: ClaimTraceabilityItem[];
  timestamp: Date;
  metadata?: {
    tokensUsed?: number;
    executionTime?: number;
    toolsCalled?: string[];
    cached?: boolean;
    responseConfidence?: "high" | "medium" | "low";
    confidenceRationale?: string;
    uncertaintyWarning?: string;
    intentRoute?: "text_only" | "structure_required";
    structureDecision?: string;
    compareMode?: boolean;
    compareReason?: string;
    policyFlags?: string[];
    reviewStatus?: "draft" | "reviewed";
    conversationId?: string;
  };
}

export interface BindingSiteResidue {
  chain?: string;
  number: number;
  name: string;
  distance?: number;
}

export type AnnotationType = "binding-site" | "ligand" | "mutation";

export interface MutationAnnotationDetail {
  tag: string;
  position: number;
  chain?: string;
  original?: string;
  mutated?: string;
  clinicalSignificance?: string;
  diseaseAssociation?: string;
  evidenceTier?: MutationEvidenceTier;
  inBindingPocket?: boolean;
  distanceToLigand?: number;
}

export interface StructureAnnotation {
  id: string;
  type: AnnotationType;
  label: string;
  description?: string;
  confidence?: "high" | "medium" | "low";
  evidence?: string;
  isInferred?: boolean;
  color: string;
  residues: BindingSiteResidue[];
  mutationDetails?: MutationAnnotationDetail[];
  ligandName?: string; // for ligand-type annotations, the 3-letter residue code
  ligandChain?: string; // chain where the primary ligand instance is located
  isVisible: boolean;
}

export const ANNOTATION_COLORS: Record<AnnotationType, string> = {
  "binding-site": "#FF6400",
  ligand: "#00C853",
  mutation: "#FF1744",
};

export const ANNOTATION_LABELS: Record<AnnotationType, string> = {
  "binding-site": "Binding Site",
  ligand: "Drug / Ligand",
  mutation: "Mutation Site",
};

export type MutationEvidenceTier =
  | "clinical"
  | "literature"
  | "computational"
  | "predicted";

export interface MutationInfo {
  original: string;
  position: number;
  mutated: string;
  label: string; // e.g. "T315I"
  clinicalSignificance?: string; // e.g. "Pathogenic", "Drug resistance"
  diseaseAssociation?: string; // e.g. "Chronic myeloid leukemia"
  evidenceTier?: MutationEvidenceTier;
}

export interface StructureData {
  pdbId: string;
  highlight?: string[];
  ligand?: string;
  ligandFullName?: string;
  title?: string;
  resolution?: number;
  method?: string;
  bindingSite?: {
    residues: BindingSiteResidue[];
    name?: string;
    source?: "pdb" | "uniprot-fallback";
  };
  mutations?: MutationInfo[];
  isAlphaFold?: boolean;
  annotationProvenance?: {
    bindingSiteConfidence?: "high" | "medium" | "low";
    mutationConfidence?: "high" | "medium" | "low";
    ligandConfidence?: "high" | "medium" | "low";
    structureConfidence?: "high" | "medium" | "low";
    bindingSiteEvidence?: string;
    mutationEvidence?: string;
    ligandEvidence?: string;
    structureEvidence?: string;
  };
}

export interface UserQuota {
  limit: number;
  used: number;
  remaining: number;
  canQuery: boolean;
  tier: "free" | "pro" | "enterprise";
}

export interface ChatState {
  messages: Message[];
  loading: boolean;
  currentStructure: StructureData | null;
  error: string | null;
}

export interface HistoryFilters {
  search?: string;
  drugName?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export interface SuggestedQuestion {
  id: string;
  question: string;
  category: "drug" | "protein" | "comparison" | "mechanism";
  drugName?: string;
}

// Viewer state for 3D visualization
export interface ViewerState {
  style: "cartoon" | "stick" | "sphere" | "surface";
  colorScheme: "spectrum" | "chain" | "residue" | "secondary";
  showLigands: boolean;
  showLabels: boolean;
  backgroundColor: string;
}

// API Response types
export interface ChatApiResponse {
  text: string;
  structure?: StructureData;
  compareStructures?: StructureData[];
  evidenceClaims?: EvidenceClaim[];
  claimTraceability?: ClaimTraceabilityItem[];
  metadata: {
    tokensUsed: number;
    executionTime: number;
    toolsCalled: string[];
    responseConfidence?: "high" | "medium" | "low";
    confidenceRationale?: string;
    uncertaintyWarning?: string;
    intentRoute?: "text_only" | "structure_required";
    structureDecision?: string;
    compareMode?: boolean;
    compareReason?: string;
    policyFlags?: string[];
    reviewStatus?: "draft" | "reviewed";
    conversationId?: string;
  };
  cached?: boolean;
}

export interface HistoryApiResponse {
  history: Array<{
    id: string;
    question: string;
    response: ChatApiResponse;
    created_at: string;
    pdb_id?: string;
    drug_name?: string;
    target_protein?: string;
  }>;
}

export interface QuotaApiResponse {
  limit: number;
  used: number;
  remaining: number;
  canQuery: boolean;
}

// Error types
export interface ApiError {
  error: string;
  details?: string;
  code?: string;
}
