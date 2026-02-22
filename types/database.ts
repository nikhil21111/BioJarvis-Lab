// Database types for Supabase tables

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  institution: string | null;
  role: "student" | "researcher" | "pro";
  subscription_tier: "free" | "pro" | "enterprise";
  query_count: number;
  created_at: string;
  updated_at: string;
}

export interface QueryHistory {
  id: string;
  user_id: string;
  question: string;
  response: AIResponse | null;
  mcp_tools_used: string[] | null;
  tokens_used: number | null;
  execution_time_ms: number | null;
  pdb_id: string | null;
  drug_name: string | null;
  target_protein: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  query_id: string | null;
  query: string;
  title: string | null;
  notes: string | null;
  created_at: string;
  updated_at?: string;
}

export interface UsageTracking {
  id: string;
  user_id: string;
  date: string;
  query_count: number;
  tokens_used: number;
}

export interface QueryCache {
  id: string;
  query_key: string;
  response: AIResponse;
  hit_count: number;
  created_at: string;
  expires_at: string;
}

export interface AIResponse {
  text: string;
  structure?: {
    pdbId: string;
    highlight?: string[];
    ligand?: string;
    ligandFullName?: string;
    title?: string;
    resolution?: number;
    method?: string;
    isAlphaFold?: boolean;
    bindingSite?: {
      residues: Array<{
        chain?: string;
        number: number;
        name: string;
        distance?: number;
      }>;
      name?: string;
      source?: "pdb" | "uniprot-fallback";
    };
    mutations?: Array<{
      original: string;
      position: number;
      mutated: string;
      label: string;
      clinicalSignificance?: string;
      diseaseAssociation?: string;
    }>;
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
  };
  compareStructures?: Array<{
    pdbId: string;
    highlight?: string[];
    ligand?: string;
    ligandFullName?: string;
    title?: string;
    resolution?: number;
    method?: string;
    isAlphaFold?: boolean;
    bindingSite?: {
      residues: Array<{
        chain?: string;
        number: number;
        name: string;
        distance?: number;
      }>;
      name?: string;
      source?: "pdb" | "uniprot-fallback";
    };
    mutations?: Array<{
      original: string;
      position: number;
      mutated: string;
      label: string;
      clinicalSignificance?: string;
      diseaseAssociation?: string;
    }>;
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
  }>;
  sources?: Array<{
    title: string;
    url: string;
    journal?: string;
    year?: string;
  }>;
  evidenceClaims?: Array<{
    claim: string;
    confidence: "high" | "medium" | "low";
    sourceType: "pdb" | "uniprot" | "chembl" | "pubmed" | "web";
    sourceLabel: string;
    url?: string;
    evidence?: string;
  }>;
  claimTraceability?: Array<{
    sentence: string;
    sourceType: "pdb" | "uniprot" | "chembl" | "pubmed" | "web";
    sourceLabel: string;
    confidence: "high" | "medium" | "low";
  }>;
  metadata?: {
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
}

// Database type for Supabase client
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at" | "updated_at" | "query_count"> & {
          query_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Profile>;
      };
      query_history: {
        Row: QueryHistory;
        Insert: Omit<QueryHistory, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<QueryHistory>;
      };
      favorites: {
        Row: Favorite;
        Insert: Omit<Favorite, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Favorite>;
      };
      usage_tracking: {
        Row: UsageTracking;
        Insert: Omit<UsageTracking, "id"> & {
          id?: string;
        };
        Update: Partial<UsageTracking>;
      };
      query_cache: {
        Row: QueryCache;
        Insert: Omit<QueryCache, "id" | "created_at" | "hit_count"> & {
          id?: string;
          created_at?: string;
          hit_count?: number;
        };
        Update: Partial<QueryCache>;
      };
    };
    Functions: {
      increment_usage: {
        Args: {
          p_user_id: string;
          p_tokens: number;
        };
        Returns: void;
      };
      clean_expired_cache: {
        Args: Record<string, never>;
        Returns: void;
      };
    };
  };
};
