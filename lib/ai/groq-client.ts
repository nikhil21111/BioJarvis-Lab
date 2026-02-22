// Groq client with MCP tool integration for real data fetching
// Uses lightweight llama-3.1-8b-instant model

import {
  pdbGetStructure,
  pdbSearchProtein,
  pdbSearchDrugTarget,
  pdbGetBindingSites,
} from "@/lib/mcp/pdb-client";
import {
  pubmedSearch,
  pubmedSearchDrugMechanism,
} from "@/lib/mcp/pubmed-client";
import {
  chemblGetTargets,
  chemblGetBioactivity,
} from "@/lib/mcp/chembl-client";
import {
  uniprotGetProtein,
  uniprotSearchByGene,
  uniprotGetVariants,
} from "@/lib/mcp/uniprot-client";
import { perplexityResearch } from "@/lib/mcp/perplexity-client";
import { alphafoldGetStructure } from "@/lib/mcp/alphafold-client";

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface AIResponse {
  text: string;
  structure?: {
    pdbId: string;
    title?: string;
    highlight?: string[];
    ligand?: string;
    ligandFullName?: string;
    isAlphaFold?: boolean;
    resolution?: number;
    method?: string;
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
      evidenceTier?: "clinical" | "literature" | "computational" | "predicted";
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
    title?: string;
    highlight?: string[];
    ligand?: string;
    ligandFullName?: string;
    isAlphaFold?: boolean;
    resolution?: number;
    method?: string;
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
      evidenceTier?: "clinical" | "literature" | "computational" | "predicted";
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
  };
}

interface MCPData {
  pdbStructure?: {
    pdbId: string;
    title: string;
    resolution: number | null;
    method: string;
    organism: string;
    isAlphaFold?: boolean;
    ligands?: Array<{ name: string; fullName: string }>;
    bindingSite?: {
      residues: Array<{
        chain: string;
        number: number;
        name: string;
        distance?: number;
      }>;
    };
  };
  pubmedArticles?: Array<{
    pmid: string;
    title: string;
    authors: string[];
    journal: string;
    publicationDate: string;
    url: string;
  }>;
  drugTargets?: unknown;
  uniprotData?: {
    accession: string;
    name: string;
    fullName: string;
    organism: string;
    function: string;
    domains: Array<{
      name: string;
      start: number;
      end: number;
      description?: string;
    }>;
    subcellularLocation: string[];
    length: number;
  };
  perplexityResearch?: {
    text: string;
    citations: string[];
  };
  bioactivities?: Array<{
    standardType: string;
    standardValue: number | null;
    standardUnits: string | null;
    standardRelation: string | null;
    targetName: string;
    pchemblValue: number | null;
    assayType: string | null;
  }>;
  uniprotVariants?: Array<{
    position: number;
    original: string;
    variant: string;
    label: string;
    description: string;
    clinicalSignificance?: string;
    diseaseAssociation?: string;
  }>;
}

type ConfidenceLevel = "high" | "medium" | "low";

function getDomainFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return null;
  }
}

function classifyMutationTier(
  clinicalSignificance?: string,
  diseaseAssociation?: string,
): "clinical" | "literature" | "computational" | "predicted" {
  const sig = (clinicalSignificance || "").toLowerCase();
  const disease = (diseaseAssociation || "").toLowerCase();

  // Clinical tier: confirmed pathogenic, drug resistance, reviewed clinical data
  if (
    sig.includes("pathogenic") ||
    sig.includes("drug resistance") ||
    sig.includes("gain of function") ||
    sig.includes("loss of function") ||
    disease.includes("cancer") ||
    disease.includes("leukemia") ||
    disease.includes("carcinoma") ||
    disease.includes("tumor")
  ) {
    return "clinical";
  }

  // Literature tier: known associations described in literature
  if (
    sig.includes("likely pathogenic") ||
    sig.includes("risk factor") ||
    sig.includes("association") ||
    disease.length > 0
  ) {
    return "literature";
  }

  // Computational: uncertain significance but reviewed
  if (
    sig.includes("uncertain") ||
    sig.includes("conflicting") ||
    sig.includes("not provided") ||
    sig.length > 0
  ) {
    return "computational";
  }

  // Predicted: no clinical or literature evidence
  return "predicted";
}

function generateUncertaintyWarning(
  confidence: "high" | "medium" | "low",
  evidenceClaims: NonNullable<AIResponse["evidenceClaims"]>,
  structure?: AIResponse["structure"],
): string | undefined {
  if (confidence === "high") return undefined;

  const hasStructure = !!structure?.pdbId;
  const highClaims = evidenceClaims.filter(
    (c) => c.confidence === "high",
  ).length;
  const webOnlyClaims = evidenceClaims.every((c) => c.sourceType === "web");

  if (confidence === "low") {
    if (evidenceClaims.length === 0) {
      return "⚠️ No verifiable evidence sources found for this response. Please validate against primary databases (UniProt, PDB, PubMed) before relying on this information.";
    }
    if (webOnlyClaims) {
      return "⚠️ This response is based primarily on web sources without peer-reviewed database confirmation. Treat as preliminary information.";
    }
    if (!hasStructure) {
      return "⚠️ Limited evidence for this response — no structural data was retrieved. Consider rephrasing your query or specifying a target protein/drug.";
    }
    return "⚠️ Low confidence response — evidence sources are limited. Please cross-reference with primary literature.";
  }

  // Medium confidence
  if (highClaims === 0) {
    return "ℹ️ Moderate confidence — no high-confidence evidence claims. Some details may require independent verification.";
  }

  return undefined;
}

function buildClaimTraceability(
  content: string,
  evidenceClaims: NonNullable<AIResponse["evidenceClaims"]>,
): NonNullable<AIResponse["claimTraceability"]> {
  if (evidenceClaims.length === 0) return [];

  const sentences = content
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30)
    .slice(0, 8);

  return sentences.map((sentence, index) => {
    const evidence = evidenceClaims[index % evidenceClaims.length];
    return {
      sentence,
      sourceType: evidence.sourceType,
      sourceLabel: evidence.sourceLabel,
      confidence: evidence.confidence,
    };
  });
}

function applyEvidencePolicy(
  text: string,
  evidenceClaims: NonNullable<AIResponse["evidenceClaims"]>,
): { text: string; policyFlags: string[] } {
  const policyFlags: string[] = [];
  const strict = process.env.BIOJARVIS_STRICT_EVIDENCE_POLICY === "true";

  const primaryEvidence = evidenceClaims.filter((c) => c.sourceType !== "web");
  const highEvidence = evidenceClaims.filter((c) => c.confidence === "high");

  if (primaryEvidence.length === 0) {
    policyFlags.push("no_primary_evidence");
    if (strict) {
      policyFlags.push("blocked_by_strict_policy");
      return {
        text: "Evidence policy guard: primary curated evidence is unavailable for this query. I can provide a hypothesis-oriented summary, but not a high-confidence factual conclusion.",
        policyFlags,
      };
    }
  }

  if (highEvidence.length === 0) {
    policyFlags.push("no_high_confidence_claims");
  }

  return { text, policyFlags };
}

function buildEvidenceClaims(
  mcpData: MCPData,
  structure?: AIResponse["structure"],
): NonNullable<AIResponse["evidenceClaims"]> {
  const claims: NonNullable<AIResponse["evidenceClaims"]> = [];

  if (structure?.pdbId) {
    claims.push({
      claim: `Retrieved structure candidate ${structure.pdbId} for visualization and residue-level context.`,
      confidence:
        structure.annotationProvenance?.structureConfidence ||
        (structure.isAlphaFold ? "low" : "medium"),
      sourceType: "pdb",
      sourceLabel: structure.isAlphaFold ? "AlphaFold/PDB mapping" : "RCSB PDB",
      url: structure.isAlphaFold
        ? `https://alphafold.ebi.ac.uk/entry/${structure.pdbId}`
        : `https://www.rcsb.org/structure/${structure.pdbId}`,
      evidence: structure.annotationProvenance?.structureEvidence,
    });
  }

  if (mcpData.uniprotData?.accession) {
    claims.push({
      claim: `Retrieved UniProt annotation for ${mcpData.uniprotData.name || mcpData.uniprotData.accession}.`,
      confidence: "high",
      sourceType: "uniprot",
      sourceLabel: `UniProt ${mcpData.uniprotData.accession}`,
      url: `https://www.uniprot.org/uniprotkb/${mcpData.uniprotData.accession}`,
      evidence: mcpData.uniprotData.function?.slice(0, 240),
    });
  }

  const topBioactivity = mcpData.bioactivities?.find(
    (a) =>
      (typeof a.standardValue === "number" && !!a.standardUnits) ||
      typeof a.pchemblValue === "number",
  );
  if (topBioactivity) {
    const activityEvidence =
      typeof topBioactivity.pchemblValue === "number"
        ? `pChEMBL ${topBioactivity.pchemblValue}`
        : `${topBioactivity.standardType || "Activity"} ${topBioactivity.standardValue} ${topBioactivity.standardUnits || ""}`.trim();

    claims.push({
      claim: `Retrieved ChEMBL activity evidence for target ${topBioactivity.targetName || "query target"}.`,
      confidence: "high",
      sourceType: "chembl",
      sourceLabel: "ChEMBL bioactivity",
      evidence: activityEvidence,
    });
  }

  if (mcpData.pubmedArticles?.length) {
    for (const article of mcpData.pubmedArticles.slice(0, 2)) {
      claims.push({
        claim: `Published evidence article: ${article.title}`,
        confidence: "high",
        sourceType: "pubmed",
        sourceLabel: `PubMed ${article.pmid}`,
        url: article.url,
        evidence: `${article.journal}${article.publicationDate ? ` (${article.publicationDate.split(" ")[0] || article.publicationDate})` : ""}`,
      });
    }
  }

  if (claims.length === 0 && mcpData.perplexityResearch?.citations?.length) {
    for (const citation of mcpData.perplexityResearch.citations.slice(0, 2)) {
      if (!citation.startsWith("http")) continue;
      const domain = getDomainFromUrl(citation);
      if (!domain) continue;
      claims.push({
        claim: `Retrieved additional web context from ${domain}.`,
        confidence: "low",
        sourceType: "web",
        sourceLabel: domain,
        url: citation,
      });
    }
  }

  return claims.slice(0, 6);
}

function deriveResponseConfidence(
  evidenceClaims: NonNullable<AIResponse["evidenceClaims"]>,
  structure?: AIResponse["structure"],
): { level: ConfidenceLevel; rationale: string } {
  const highClaims = evidenceClaims.filter(
    (claim) => claim.confidence === "high",
  ).length;
  const mediumClaims = evidenceClaims.filter(
    (claim) => claim.confidence === "medium",
  ).length;
  const structureConfidence =
    structure?.annotationProvenance?.structureConfidence;

  if (
    highClaims >= 2 ||
    (highClaims >= 1 &&
      (structureConfidence === "high" || structureConfidence === "medium"))
  ) {
    return {
      level: "high",
      rationale: `Strong source coverage (${highClaims} high-confidence evidence claim${highClaims === 1 ? "" : "s"}).`,
    };
  }

  if (
    highClaims >= 1 ||
    mediumClaims >= 1 ||
    structureConfidence === "medium" ||
    structureConfidence === "high"
  ) {
    return {
      level: "medium",
      rationale:
        "Mixed evidence quality; use for guidance and verify for high-stakes interpretation.",
    };
  }

  return {
    level: "low",
    rationale:
      "Limited direct evidence found for this answer; validate against primary sources.",
  };
}

// Extract drug name from query — comprehensive list covering major drug classes
function extractDrugName(query: string): string | null {
  const drugPatterns = [
    // Exact-match common drugs (highest priority)
    /\b(aspirin|ibuprofen|penicillin|insulin|metformin|acetaminophen|paracetamol|warfarin|heparin|morphine|dopamine|serotonin|atropine|omeprazole|lisinopril|amoxicillin|ciprofloxacin|azithromycin|doxycycline|vancomycin|gentamicin|clopidogrel|ticagrelor|rivaroxaban|apixaban|dabigatran|enoxaparin|atorvastatin|rosuvastatin|simvastatin|pravastatin|lovastatin|amlodipine|nifedipine|verapamil|diltiazem|losartan|valsartan|irbesartan|telmisartan|candesartan|enalapril|ramipril|captopril|metoprolol|atenolol|propranolol|carvedilol|bisoprolol|furosemide|hydrochlorothiazide|spironolactone|digoxin|amiodarone|fluoxetine|sertraline|paroxetine|citalopram|escitalopram|venlafaxine|duloxetine|bupropion|mirtazapine|lithium|valproate|carbamazepine|lamotrigine|levetiracetam|phenytoin|gabapentin|pregabalin|diazepam|lorazepam|alprazolam|zolpidem|quetiapine|olanzapine|risperidone|aripiprazole|haloperidol|clozapine|prednisone|prednisolone|dexamethasone|hydrocortisone|methylprednisolone|montelukast|salbutamol|albuterol|formoterol|salmeterol|tiotropium|budesonide|fluticasone|ipratropium|theophylline|codeine|tramadol|fentanyl|oxycodone|hydromorphone|naloxone|naltrexone|buprenorphine|epinephrine|norepinephrine|phenylephrine|tamoxifen|anastrozole|letrozole|trastuzumab|bevacizumab|rituximab|pembrolizumab|nivolumab|ipilimumab|imatinib|erlotinib|gefitinib|sorafenib|sunitinib|lapatinib|crizotinib|vemurafenib|dabrafenib|trametinib|palbociclib|ribociclib|olaparib|lenalidomide|thalidomide|bortezomib|cisplatin|carboplatin|oxaliplatin|doxorubicin|paclitaxel|docetaxel|vincristine|cyclophosphamide|fluorouracil|capecitabine|gemcitabine|temozolomide|etoposide|sildenafil|tadalafil|finasteride|dutasteride|tamsulosin|pioglitazone|glipizide|glyburide|glimepiride|sitagliptin|empagliflozin|dapagliflozin|canagliflozin|liraglutide|semaglutide|levothyroxine|methimazole|propylthiouracil|acyclovir|valacyclovir|oseltamivir|remdesivir|tenofovir|emtricitabine|dolutegravir|raltegravir|efavirenz|ritonavir|lopinavir|hydroxychloroquine|chloroquine|artemisinin|ivermectin|mebendazole|albendazole|fluconazole|itraconazole|voriconazole|amphotericin|nystatin|tacrolimus|cyclosporine|mycophenolate|azathioprine|infliximab|adalimumab|etanercept|tocilizumab|secukinumab|ustekinumab|certolizumab|golimumab|abciximab|alteplase|tenecteplase|ranibizumab|aflibercept|cetuximab|panitumumab|pertuzumab|daratumumab|elotuzumab|atezolizumab|durvalumab|avelumab|axitinib|cabozantinib|lenvatinib|regorafenib|pazopanib|nilotinib|dasatinib|bosutinib|ponatinib|ibrutinib|acalabrutinib|idelalisib|venetoclax|ruxolitinib|tofacitinib|baricitinib|upadacitinib|filgotinib|abemaciclib|tucatinib|neratinib|osimertinib|alectinib|brigatinib|lorlatinib|entrectinib|capmatinib|tepotinib|selpercatinib|pralsetinib|encorafenib|binimetinib|cobimetinib|selumetinib|niraparib|rucaparib|talazoparib)s?\b/i,
    // Suffix-based drug class patterns
    /\b([A-Z][a-z]+(?:ilin|pirin|cillin|mycin|mab|nib|zole|pine|statin|pril|olol|sartan|dipine|prazole|vir|afil|xaban|gatran|gliptin|gliflozin|glutide|ciclib|parib|tinib|platin|rubicin|taxel|vastatin))s?\b/i,
  ];

  for (const pattern of drugPatterns) {
    const match = query.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Extract protein/gene name from query
function extractProteinName(query: string): string | null {
  const proteinPatterns = [
    // Known protein/gene names
    /\b(COX-?[12]|PTGS[12]|hemoglobin|HBA[12]|HBB|insulin receptor|p53|TP53|BRCA[12]|EGFR|HER2|ACE2|spike protein|BRAF|BCR-?ABL|ABL[12]?|JAK[12]?|KIT|PDGFR[AB]?|VEGFR[123]?|FLT3|RAS|KRAS|NRAS|ALK|RET|MET|SRC|mTOR|PI3K|AKT|RAF|MEK|ERK|CDK[0-9]+|kinase|protease|polymerase)\b/i,
    // Gene names with numbers (more specific)
    /\b([A-Z]{2,4}[0-9]{1,2}[A-Z]?)\b/,
    // Enzyme names — require at least 5 chars to avoid matching "in", "or", "for" etc.
    /\b([A-Za-z]{5,}(?:ase|ase[s]?|sin|rin))\b/i,
  ];

  // Avoid common false positives — extensive list to prevent English words matching
  const excludeWords = [
    "show",
    "tell",
    "what",
    "how",
    "the",
    "about",
    "structure",
    "protein",
    "in",
    "or",
    "for",
    "nor",
    "an",
    "is",
    "are",
    "was",
    "were",
    "been",
    "other",
    "under",
    "over",
    "after",
    "before",
    "better",
    "never",
    "order",
    "error",
    "inner",
    "outer",
    "enter",
    "inter",
    "super",
    "user",
    "maker",
    "later",
    "water",
    "ever",
    "however",
    "whatever",
    "their",
    "there",
    "where",
    "here",
    "more",
    "core",
    "store",
    "figure",
    "nature",
    "feature",
    "major",
    "minor",
    "color",
    "factor",
    "vector",
    "sector",
    "actor",
    "motor",
    "tumor",
    "number",
    "member",
    "remember",
    "together",
    "another",
    "whether",
    "cancer",
    "answer",
    "consider",
    "discover",
    "deliver",
    "liver",
    "trigger",
    "finger",
    "differ",
    "offer",
    "suffer",
    "buffer",
    "treating",
    "mechanism",
    "leukemia",
    "disease",
    "drugs",
  ];

  for (const pattern of proteinPatterns) {
    const match = query.match(pattern);
    if (
      match &&
      match[1].length >= 3 &&
      !excludeWords.includes(match[1].toLowerCase())
    ) {
      return match[1];
    }
  }
  return null;
}

// Extract PDB ID from query
function extractPdbId(query: string): string | null {
  const pdbMatch = query.match(/\b([1-9][A-Za-z0-9]{3})\b/);
  if (pdbMatch) {
    const potential = pdbMatch[1].toUpperCase();
    if (/^[1-9][A-Z0-9]{3}$/.test(potential)) {
      return potential;
    }
  }
  return null;
}

function recoverEntitiesFromContextText(text?: string): {
  drugName: string | null;
  proteinName: string | null;
  pdbId: string | null;
} {
  if (!text || !text.trim()) {
    return { drugName: null, proteinName: null, pdbId: null };
  }
  return {
    drugName: extractDrugName(text),
    proteinName: extractProteinName(text),
    pdbId: extractPdbId(text),
  };
}

// ──────────────────────────────────────────────────────────────────
// LLM-based entity extraction: Uses a cheap fast model to reliably
// extract drug names, protein/gene names from natural language queries.
// Falls back to regex if LLM call fails.
// ──────────────────────────────────────────────────────────────────
interface ExtractedEntities {
  drugName: string | null;
  proteinName: string | null;
  pdbId: string | null;
  isFollowUp: boolean; // true if query references previous context ("it", "this drug", etc.)
}

type IntentRoute = "text_only" | "structure_required";

interface IntentDecision {
  route: IntentRoute;
  confidence: "high" | "medium" | "low";
  reason: string;
}

interface CompareModeDecision {
  enabled: boolean;
  reason?: string;
}

interface FollowUpMemoryContext {
  structureContext?: {
    pdbId?: string;
    ligand?: string;
    title?: string;
    bindingSiteResidues?: string[];
  };
  lastAssistantAnswer?: string;
  selectedStructureIndex?: number;
  persistedConversation?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

function classifyIntentRoute(
  query: string,
  entities: ExtractedEntities,
  followUpMemory?: FollowUpMemoryContext,
): IntentDecision {
  const normalized = query.toLowerCase();
  const negatedStructurePattern =
    /\b(?:don'?t|do not|without|skip|no)\s+(?:show|give|display|render|visuali[sz]e|include|provide)?\s*(?:the\s+)?(?:structure|3d|pdb|viewer)\b/i;
  const queryHasExplicitPdb = /\b[1-9][a-z0-9]{3}\b/i.test(query);
  const structureTypoPattern =
    /\b(structure|stuture|strcture|stucture|strucutre|3d|pdb|residue|residues|binding site|active site|docking|pocket|pockets|co-?crystal|crystal structure|cryo|visuali[sz]e|map mutation|atom|ligand binding)\b/i;
  const explicitStructurePattern = structureTypoPattern;
  const strongFollowUpStructurePattern =
    /\b(this structure|that structure|the structure|binding site|residue|residues|pocket|pockets|mutations on structure|in this pdb)\b/i;
  const followUpPronounPattern =
    /\b(it|that|this|same|previous|above|last one|that one|this one)\b/i;
  const followUpStructureVerbPattern =
    /\b(show|give|display|render|visuali[sz]e|open|load|get|see|bring)\b/i;
  const comparisonPattern =
    /\b(compare|comparison|versus|vs\.?|difference between|compared to|head[- ]to[- ]head)\b/i;
  const structuralComparisonPattern =
    /\b(binding site|residue|residues|pocket|pockets|active site|structure|stuture|strcture|stucture|strucutre|3d|map mutation|atom)\b/i;

  const inferredFollowUpStructureRequest =
    followUpStructureVerbPattern.test(normalized) &&
    followUpPronounPattern.test(normalized) &&
    Boolean(
      followUpMemory?.structureContext?.pdbId ||
      followUpMemory?.lastAssistantAnswer ||
      followUpMemory?.persistedConversation?.length ||
      entities.isFollowUp ||
      entities.drugName ||
      entities.proteinName,
    );

  if (negatedStructurePattern.test(normalized)) {
    return {
      route: "text_only",
      confidence: "high",
      reason:
        "User explicitly requested no structure output; answering in text-only mode.",
    };
  }

  if (entities.pdbId && queryHasExplicitPdb) {
    return {
      route: "structure_required",
      confidence: "high",
      reason: "Direct PDB identifier requested.",
    };
  }

  if (explicitStructurePattern.test(normalized)) {
    return {
      route: "structure_required",
      confidence: "high",
      reason: "Explicit structure-level intent detected.",
    };
  }

  if (
    comparisonPattern.test(normalized) &&
    (structuralComparisonPattern.test(normalized) ||
      Boolean(followUpMemory?.structureContext?.pdbId))
  ) {
    return {
      route: "structure_required",
      confidence: followUpMemory?.structureContext?.pdbId ? "medium" : "high",
      reason:
        "Comparison query with structural context/terms; using structure-aware mode.",
    };
  }

  if (
    entities.isFollowUp &&
    followUpMemory?.structureContext?.pdbId &&
    strongFollowUpStructurePattern.test(normalized)
  ) {
    return {
      route: "structure_required",
      confidence: "medium",
      reason: "Follow-up references a previously generated structure.",
    };
  }

  if (inferredFollowUpStructureRequest) {
    return {
      route: "structure_required",
      confidence: "medium",
      reason:
        "Conversational follow-up asks to show/give structure for prior context.",
    };
  }

  return {
    route: "text_only",
    confidence: "high",
    reason: "No explicit structure intent; answering in research-text mode.",
  };
}

function classifyCompareMode(query: string): CompareModeDecision {
  const normalized = query.toLowerCase();
  const explicitComparePattern =
    /\b(compare|comparison|versus|vs\.?|difference between|compared to|head[- ]to[- ]head)\b/i;

  if (explicitComparePattern.test(normalized)) {
    return {
      enabled: true,
      reason: "Explicit comparison intent detected in query.",
    };
  }

  return { enabled: false };
}

async function extractEntitiesWithLLM(
  query: string,
): Promise<ExtractedEntities> {
  // Always extract PDB ID with regex (very reliable for 4-char codes)
  const pdbId = extractPdbId(query);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant", // Cheap fast model just for extraction
        messages: [
          {
            role: "system",
            content: `You are a biomedical entity extractor. Given a user question, extract:
1. drugName: The pharmaceutical drug mentioned (generic name, lowercase). null if none.
2. proteinName: The protein or gene target mentioned (standard symbol like EGFR, TP53, ABL1). null if none.
3. isFollowUp: true if the question references previous context (uses "it", "this", "that drug", "the protein", "what about", "and", "also", "same", etc.)

RULES:
- For drug names, use the generic name (e.g., "tylenol" → "acetaminophen", "advil" → "ibuprofen")
- For proteins, use official gene symbols (e.g., "epidermal growth factor receptor" → "EGFR")
- If both drug and protein are mentioned, extract both
- If the query is about a disease or general topic with no specific drug/protein, return null for both
- Return ONLY valid JSON, no explanation

Examples:
"How does imatinib work?" → {"drugName":"imatinib","proteinName":null,"isFollowUp":false}
"Show me EGFR structure" → {"drugName":null,"proteinName":"EGFR","isFollowUp":false}
"What about resistance mutations?" → {"drugName":null,"proteinName":null,"isFollowUp":true}
"How does erlotinib bind to EGFR?" → {"drugName":"erlotinib","proteinName":"EGFR","isFollowUp":false}
"What is the function of p53?" → {"drugName":null,"proteinName":"TP53","isFollowUp":false}
"Tell me more about its binding site" → {"drugName":null,"proteinName":null,"isFollowUp":true}
"SARS-CoV-2 main protease" → {"drugName":null,"proteinName":"MPRO","isFollowUp":false}
"GLP-1 receptor agonists" → {"drugName":null,"proteinName":"GLP1R","isFollowUp":false}`,
          },
          { role: "user", content: query },
        ],
        max_tokens: 100,
        temperature: 0,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`Entity extraction LLM error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    console.log("[Entity Extraction] LLM result:", parsed);

    return {
      drugName: parsed.drugName || null,
      proteinName: parsed.proteinName || null,
      pdbId,
      isFollowUp: parsed.isFollowUp || false,
    };
  } catch (err) {
    // Fallback to regex extraction
    console.warn("[Entity Extraction] LLM failed, falling back to regex:", err);
    return {
      drugName: extractDrugName(query),
      proteinName: extractProteinName(query),
      pdbId,
      isFollowUp: false,
    };
  }
}

// ──────────────────────────────────────────────────────────────────
// Curated map of well-known drug → PDB structures.
// These are manually verified drug-target co-crystal structures
// and prevent the system from picking a random protein that happens
// to contain the same ligand (e.g., 1TGM for aspirin instead of COX-1).
// Format: { pdbId, ligand (3-letter PDB code), targetGene }
// ──────────────────────────────────────────────────────────────────
const KNOWN_DRUG_STRUCTURES: Record<
  string,
  { pdbId: string; ligand: string; targetGene: string }
> = {
  aspirin: { pdbId: "6Y3C", ligand: "FLP", targetGene: "PTGS1" }, // COX-1 with flurbiprofen (aspirin analog, Ser530 site)
  ibuprofen: { pdbId: "4PH9", ligand: "IBP", targetGene: "PTGS2" }, // COX-2 with ibuprofen
  imatinib: { pdbId: "1IEP", ligand: "STI", targetGene: "ABL1" }, // BCR-ABL with imatinib
  metformin: { pdbId: "6BML", ligand: "MET", targetGene: "PRKAB1" }, // AMPK with metformin
  warfarin: { pdbId: "1OOK", ligand: "4HQ", targetGene: "VKORC1" }, // VKORC1 with warfarin
  penicillin: { pdbId: "1FXV", ligand: "PNN", targetGene: "PBP2" }, // PBP with penicillin
  amoxicillin: { pdbId: "1FXV", ligand: "PNN", targetGene: "PBP2" }, // PBP (beta-lactam class)
  omeprazole: { pdbId: "5YOC", ligand: "RNZ", targetGene: "ATP4A" }, // Proton pump
  acetaminophen: { pdbId: "4COX", ligand: "ACM", targetGene: "PTGS2" }, // COX-2
  paracetamol: { pdbId: "4COX", ligand: "ACM", targetGene: "PTGS2" }, // COX-2 (alias)
  celecoxib: { pdbId: "3LN1", ligand: "CEL", targetGene: "PTGS2" }, // COX-2 with celecoxib
  erlotinib: { pdbId: "1M17", ligand: "AQ4", targetGene: "EGFR" }, // EGFR with erlotinib
  gefitinib: { pdbId: "2ITY", ligand: "IRE", targetGene: "EGFR" }, // EGFR with gefitinib
  osimertinib: { pdbId: "4ZAU", ligand: "4ZA", targetGene: "EGFR" }, // EGFR T790M mutant
  trastuzumab: { pdbId: "1N8Z", ligand: "FAB", targetGene: "ERBB2" }, // HER2 with trastuzumab Fab
  dasatinib: { pdbId: "2GQG", ligand: "1N1", targetGene: "ABL1" }, // BCR-ABL with dasatinib
  nilotinib: { pdbId: "3CS9", ligand: "NIL", targetGene: "ABL1" }, // BCR-ABL with nilotinib
  crizotinib: { pdbId: "2XP2", ligand: "CRZ", targetGene: "ALK" }, // ALK with crizotinib
  vemurafenib: { pdbId: "3OG7", ligand: "032", targetGene: "BRAF" }, // BRAF V600E with vemurafenib
  tamoxifen: { pdbId: "3ERT", ligand: "OHT", targetGene: "ESR1" }, // Estrogen receptor with tamoxifen
  sildenafil: { pdbId: "1UDT", ligand: "VIA", targetGene: "PDE5A" }, // PDE5 with sildenafil
  atorvastatin: { pdbId: "1HWK", ligand: "ATV", targetGene: "HMGCR" }, // HMG-CoA reductase
  rosuvastatin: { pdbId: "1HWL", ligand: "RSV", targetGene: "HMGCR" }, // HMG-CoA reductase
  fluoxetine: { pdbId: "6VRH", ligand: "FLX", targetGene: "SLC6A4" }, // SERT with fluoxetine
  diazepam: { pdbId: "6X3X", ligand: "DZP", targetGene: "GABRA1" }, // GABA-A receptor
  morphine: { pdbId: "5C1M", ligand: "BU7", targetGene: "OPRM1" }, // Mu-opioid receptor
  naloxone: { pdbId: "4DKL", ligand: "NOX", targetGene: "OPRM1" }, // Mu-opioid receptor antagonist
  losartan: { pdbId: "4YAY", ligand: "LSN", targetGene: "AGTR1" }, // AT1 receptor
  metoprolol: { pdbId: "3NY8", ligand: "MTP", targetGene: "ADRB1" }, // Beta-1 adrenergic receptor
  sorafenib: { pdbId: "1UWH", ligand: "BAX", targetGene: "BRAF" }, // BRAF/VEGFR
  sunitinib: { pdbId: "3G0E", ligand: "B49", targetGene: "KDR" }, // VEGFR2
  pembrolizumab: { pdbId: "5DK3", ligand: "FAB", targetGene: "PDCD1" }, // PD-1
  rivaroxaban: { pdbId: "2W26", ligand: "RIV", targetGene: "F10" }, // Factor Xa
  acyclovir: { pdbId: "2ZHG", ligand: "ACV", targetGene: "TK" }, // HSV thymidine kinase
  remdesivir: { pdbId: "7BV2", ligand: "GS1", targetGene: "RDRP" }, // SARS-CoV-2 RdRp
  doxorubicin: { pdbId: "1D12", ligand: "DM2", targetGene: "TOP2A" }, // Topoisomerase II
  cisplatin: { pdbId: "1AIO", ligand: "CPT", targetGene: "DNA" }, // DNA crosslinker
  ruxolitinib: { pdbId: "6VN8", ligand: "RUX", targetGene: "JAK2" }, // JAK2 inhibitor
  ibrutinib: { pdbId: "5P9J", ligand: "IBR", targetGene: "BTK" }, // BTK inhibitor
  venetoclax: { pdbId: "6O0K", ligand: "VCL", targetGene: "BCL2" }, // BCL-2 inhibitor
  olaparib: { pdbId: "7KK4", ligand: "OLP", targetGene: "PARP1" }, // PARP inhibitor
  palbociclib: { pdbId: "5L2I", ligand: "PBC", targetGene: "CDK6" }, // CDK4/6 inhibitor
};

// ──────────────────────────────────────────────────────────────────
// Common ions, solvents, buffers that should NOT be treated as drug ligands
// ──────────────────────────────────────────────────────────────────
const IRRELEVANT_LIGANDS = new Set([
  "HOH",
  "DOD", // water
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
  "BR",
  "IOD",
  "CD", // ions
  "SO4",
  "PO4",
  "NO3",
  "ACT",
  "FMT", // anions/acids
  "GOL",
  "EDO",
  "PEG",
  "PGE",
  "MPD",
  "DMS", // solvents/cryoprotectants
  "BME",
  "EOH",
  "IPA",
  "TRS",
  "MES",
  "HED",
  "CIT",
  "TAR", // buffers
  "NAG",
  "MAN",
  "BMA",
  "FUC",
  "GAL",
  "GLC",
  "BGC",
  "NDG", // sugars
  "UNX",
  "UNL",
  "UNK", // unknown
]);

/**
 * Choose the most biologically relevant ligand from a PDB structure's ligand list.
 * Priority: 1) curated/expected ligand  2) match by drug name  3) drug-like molecule (skip ions/solvents)
 */
function selectBestLigand(
  ligands: Array<{ name: string; fullName: string }> | undefined,
  expectedLigand?: string,
  drugName?: string,
): { name: string; fullName: string } | undefined {
  if (!ligands || ligands.length === 0) return undefined;

  // 1. If we have an expected ligand (from curated map), find it
  if (expectedLigand) {
    const match = ligands.find((l) => l.name === expectedLigand);
    if (match) return match;
  }

  // 2. If we have a drug name, try matching it to a ligand's fullName
  if (drugName) {
    const drugLower = drugName.toLowerCase();
    const nameMatch = ligands.find(
      (l) =>
        l.fullName?.toLowerCase().includes(drugLower) ||
        l.name?.toLowerCase() === drugLower,
    );
    if (nameMatch) return nameMatch;
  }

  // 3. Filter out ions, solvents, buffers, sugars
  const drugLigands = ligands.filter((l) => !IRRELEVANT_LIGANDS.has(l.name));
  if (drugLigands.length > 0) return drugLigands[0];

  // 4. Fallback: return the first non-water ligand
  return ligands[0];
}

function extractComparisonDrugNames(query: string): string[] {
  const lower = query.toLowerCase();
  return Object.keys(KNOWN_DRUG_STRUCTURES)
    .map((name) => ({ name, index: lower.indexOf(name) }))
    .filter((entry) => entry.index >= 0)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.name);
}

async function buildCompareStructures(
  query: string,
  toolsCalled: string[],
  primaryStructure?: AIResponse["structure"],
): Promise<AIResponse["compareStructures"]> {
  const comparisonDrugs = extractComparisonDrugNames(query);
  if (comparisonDrugs.length < 2) return undefined;

  const seenPdbIds = new Set<string>();
  if (primaryStructure?.pdbId) {
    seenPdbIds.add(primaryStructure.pdbId);
  }

  const compareStructures: NonNullable<AIResponse["compareStructures"]> = [];

  for (const drugName of comparisonDrugs) {
    const known = KNOWN_DRUG_STRUCTURES[drugName];
    if (!known || seenPdbIds.has(known.pdbId)) continue;

    try {
      const structureResult = await pdbGetStructure(known.pdbId);
      if (!structureResult.success || !structureResult.data) continue;
      toolsCalled.push("pdb_get_structure_compare");

      const bestLigand = selectBestLigand(
        structureResult.data.ligands,
        known.ligand,
        drugName,
      );

      let bindingSite:
        | {
            residues: Array<{
              chain: string;
              number: number;
              name: string;
              distance?: number;
            }>;
            name?: string;
            source?: "pdb" | "uniprot-fallback";
          }
        | undefined;

      if (bestLigand?.name) {
        const bindingSites = await pdbGetBindingSites(
          structureResult.data.pdbId,
          bestLigand.name,
        );
        if (bindingSites.success && bindingSites.data?.residues?.length) {
          bindingSite = {
            residues: bindingSites.data.residues,
            name: `${bestLigand.fullName} (${bestLigand.name})`,
            source: "pdb",
          };
          toolsCalled.push("pdb_get_binding_sites_compare");
        }
      }

      const highlight =
        bindingSite?.residues?.map(
          (residue) => `${residue.chain || "A"}:${residue.number}`,
        ) || [];

      compareStructures.push({
        pdbId: structureResult.data.pdbId,
        title: structureResult.data.title,
        ligand: bestLigand?.name,
        ligandFullName: bestLigand?.fullName,
        resolution: structureResult.data.resolution || undefined,
        method: structureResult.data.method || undefined,
        highlight: highlight.length > 0 ? highlight : undefined,
        bindingSite,
        annotationProvenance: {
          bindingSiteConfidence: bindingSite ? "high" : undefined,
          ligandConfidence: bestLigand ? "high" : undefined,
          structureConfidence: "high",
          bindingSiteEvidence: bindingSite
            ? "PDB/PDBe binding-site residues"
            : undefined,
          ligandEvidence: bestLigand
            ? "Curated drug-ligand/PDB match"
            : undefined,
          structureEvidence: "Curated comparison structure retrieval",
        },
      });
      seenPdbIds.add(known.pdbId);

      if (compareStructures.length >= 2) break;
    } catch {
      // best-effort compare structure enrichment
    }
  }

  return compareStructures.length > 0 ? compareStructures : undefined;
}

// Fetch data from MCP servers
// CRITICAL: For drug queries, ChEMBL runs FIRST to identify the correct
// target protein. Only then do we search PDB for that specific target.
// This prevents returning a random protein that happens to contain the drug.
async function fetchMCPData(
  query: string,
  entities?: ExtractedEntities,
  options?: { allowStructure?: boolean },
): Promise<{
  mcpData: MCPData;
  toolsCalled: string[];
  expectedLigand?: string;
}> {
  const mcpData: MCPData = {};
  const toolsCalled: string[] = [];
  let expectedLigandId: string | undefined = undefined;
  const allowStructure = options?.allowStructure !== false;

  // Use LLM-extracted entities if available, fall back to regex
  const drugName = entities?.drugName || extractDrugName(query);
  const proteinName = entities?.proteinName || extractProteinName(query);
  const pdbId = entities?.pdbId || extractPdbId(query);

  console.log(
    "[Groq] Entities — drug:",
    drugName,
    "protein:",
    proteinName,
    "pdbId:",
    pdbId,
    "followUp:",
    entities?.isFollowUp,
  );

  // ──── PubMed runs in background (independent of structure search) ────
  const pubmedPromise = (async () => {
    try {
      if (drugName) {
        const result = await pubmedSearchDrugMechanism(
          drugName,
          proteinName || undefined,
          3,
        );
        if (result.success && result.data) {
          mcpData.pubmedArticles = result.data;
          toolsCalled.push("pubmed_search");
        }
      } else {
        const q = proteinName
          ? `${proteinName} AND (structure OR function OR molecular)`
          : query
              .replace(/show|me|the|of|what|is|tell|about|how/gi, "")
              .trim()
              .slice(0, 80);
        const result = await pubmedSearch(q, 3);
        if (result.success && result.data) {
          mcpData.pubmedArticles = result.data;
          toolsCalled.push("pubmed_search");
        }
      }
    } catch {
      /* non-critical */
    }
  })();

  // Bioactivity promise — will be set in drug branch
  let bioactivityPromise: Promise<void> = Promise.resolve();

  // ──── PHASE 1: Direct PDB ID lookup ────
  if (allowStructure && pdbId) {
    console.log("[Groq] Direct PDB ID lookup:", pdbId);
    const result = await pdbGetStructure(pdbId);
    if (result.success && result.data) {
      mcpData.pdbStructure = result.data;
      toolsCalled.push("pdb_get_structure");
    }

    // ──── PHASE 2: Drug mechanism question → ChEMBL-guided approach ────
  } else if (drugName) {
    console.log("[Groq] Drug query detected:", drugName);

    // Step 0: Check curated map for well-known drugs
    const known = KNOWN_DRUG_STRUCTURES[drugName.toLowerCase()];
    // Track the expected ligand 3-letter code so we pick the right one later
    expectedLigandId = known?.ligand;

    // Step 1: Call ChEMBL FIRST to identify the CORRECT target protein
    let chemblTargets: {
      gene: string;
      protein: string;
      uniprotId: string;
      pdbIds: string[];
    }[] = [];
    try {
      const chemblResult = await chemblGetTargets(drugName);
      if (chemblResult.success && chemblResult.data) {
        mcpData.drugTargets = chemblResult.data;
        toolsCalled.push("chembl_get_targets");
        chemblTargets =
          (chemblResult.data as { targets: typeof chemblTargets }).targets ||
          [];
        console.log(
          "[Groq] ChEMBL targets:",
          chemblTargets.map((t) => `${t.gene}(${t.uniprotId})`),
        );
      }
    } catch (err) {
      console.warn("[Groq] ChEMBL lookup failed:", err);
    }

    const primaryTarget = chemblTargets[0];

    // Step 1b: Fetch bioactivity data (IC50/Ki/EC50) in background
    bioactivityPromise = (async () => {
      try {
        if (mcpData.drugTargets) {
          const dt = mcpData.drugTargets as {
            chemblId: string;
            targets: Array<{ gene: string }>;
          };
          const targetChemblId = chemblTargets[0]
            ? await (async () => {
                // Use the target_chembl_id we already have from mechanisms
                const targetResult = await fetch(
                  `https://www.ebi.ac.uk/chembl/api/data/target.json?pref_name__icontains=${encodeURIComponent(chemblTargets[0].protein)}&limit=1`,
                  { next: { revalidate: 86400 } },
                );
                if (targetResult.ok) {
                  const td = await targetResult.json();
                  return td.targets?.[0]?.target_chembl_id;
                }
                return undefined;
              })()
            : undefined;

          console.log(
            "[Groq] Fetching bioactivity for:",
            dt.chemblId,
            "target:",
            targetChemblId || "any",
          );
          const bioResult = await chemblGetBioactivity(
            dt.chemblId,
            targetChemblId,
          );
          if (
            bioResult.success &&
            bioResult.data &&
            bioResult.data.length > 0
          ) {
            mcpData.bioactivities = bioResult.data.map((b) => ({
              standardType: b.standardType,
              standardValue: b.standardValue,
              standardUnits: b.standardUnits,
              standardRelation: b.standardRelation,
              targetName: b.targetName,
              pchemblValue: b.pchemblValue,
              assayType: b.assayType,
            }));
            toolsCalled.push("chembl_get_bioactivity");
            console.log(
              "[Groq] Bioactivity data loaded:",
              mcpData.bioactivities.length,
              "entries",
            );
          }
        }
      } catch (bioErr) {
        console.warn("[Groq] Bioactivity fetch failed:", bioErr);
      }
    })();

    // Step 2: Try curated PDB ID first (most reliable for common drugs)
    if (allowStructure && known && !mcpData.pdbStructure) {
      console.log(
        "[Groq] Using curated structure:",
        known.pdbId,
        "for",
        drugName,
      );
      const result = await pdbGetStructure(known.pdbId);
      if (result.success && result.data) {
        mcpData.pdbStructure = result.data;
        toolsCalled.push("pdb_get_structure_curated");
      }
    }

    // Step 3: Combined RCSB search — target UniProt + drug name
    if (allowStructure && !mcpData.pdbStructure && primaryTarget?.uniprotId) {
      console.log(
        "[Groq] Combined PDB search: UniProt",
        primaryTarget.uniprotId,
        "+ drug",
        drugName,
      );
      const combined = await pdbSearchDrugTarget(
        primaryTarget.uniprotId,
        drugName,
      );
      if (combined.success && combined.data && combined.data.length > 0) {
        mcpData.pdbStructure = combined.data[0];
        toolsCalled.push("pdb_search_drug_target");
        console.log("[Groq] Found co-crystal:", mcpData.pdbStructure.pdbId);
      }
    }

    // Step 4: Use ChEMBL's PDB IDs (they're for the correct target protein)
    if (
      allowStructure &&
      !mcpData.pdbStructure &&
      primaryTarget?.pdbIds?.length
    ) {
      console.log("[Groq] Trying ChEMBL PDB IDs:", primaryTarget.pdbIds);
      // Try each PDB ID — prefer one containing a drug-relevant ligand
      let bestStructure: MCPData["pdbStructure"] = undefined;
      for (const targetPdbId of primaryTarget.pdbIds) {
        const result = await pdbGetStructure(targetPdbId);
        if (result.success && result.data) {
          if (!bestStructure) bestStructure = result.data; // Keep first as fallback
          // Check if this structure has a ligand matching the drug
          const hasRelevantLigand = result.data.ligands?.some((l) =>
            l.fullName?.toLowerCase().includes(drugName.toLowerCase()),
          );
          if (hasRelevantLigand) {
            bestStructure = result.data;
            console.log(
              "[Groq] Found ChEMBL PDB with drug ligand:",
              targetPdbId,
            );
            break;
          }
        }
      }
      if (bestStructure) {
        mcpData.pdbStructure = bestStructure;
        toolsCalled.push("pdb_get_structure");
      }
    }

    // Step 5: Search PDB by target protein gene name (still correct protein, just no drug ligand)
    if (allowStructure && !mcpData.pdbStructure && primaryTarget?.uniprotId) {
      console.log(
        "[Groq] Searching PDB by target UniProt only:",
        primaryTarget.uniprotId,
      );
      const uniResult = await pdbSearchDrugTarget(primaryTarget.uniprotId);
      if (uniResult.success && uniResult.data && uniResult.data.length > 0) {
        mcpData.pdbStructure = uniResult.data[0];
        toolsCalled.push("pdb_search_protein");
      }
    }

    // Step 6: Search PDB by target gene name
    if (allowStructure && !mcpData.pdbStructure && primaryTarget?.gene) {
      console.log("[Groq] Searching PDB by target gene:", primaryTarget.gene);
      const geneResult = await pdbSearchProtein(primaryTarget.gene);
      if (geneResult.success && geneResult.data && geneResult.data.length > 0) {
        mcpData.pdbStructure = geneResult.data[0];
        toolsCalled.push("pdb_search_protein");
      }
    }

    // Step 7: LAST RESORT — blind text search by drug name (original behavior)
    if (allowStructure && !mcpData.pdbStructure) {
      console.log(
        "[Groq] Last resort: PDB text search for drug name:",
        drugName,
      );
      const fallback = await pdbSearchProtein(drugName);
      if (fallback.success && fallback.data && fallback.data.length > 0) {
        mcpData.pdbStructure = fallback.data[0];
        toolsCalled.push("pdb_search_protein_fallback");
      }
    }

    // ──── PHASE 3: Protein-only question ────
  } else if (proteinName && allowStructure) {
    console.log("[Groq] Protein search:", proteinName);
    const result = await pdbSearchProtein(proteinName);
    if (result.success && result.data && result.data.length > 0) {
      mcpData.pdbStructure = result.data[0];
      toolsCalled.push("pdb_search_protein");
    }

    // AlphaFold fallback: if no experimental PDB structure found, try AlphaFold prediction
    if (!mcpData.pdbStructure) {
      console.log(
        "[Groq] No PDB structure, trying AlphaFold for:",
        proteinName,
      );
      try {
        // First search UniProt to get accession for AlphaFold
        const uniSearch = await uniprotSearchByGene(
          proteinName,
          "Homo sapiens",
        );
        if (uniSearch.success && uniSearch.data && uniSearch.data.length > 0) {
          const accession = uniSearch.data[0].accession;
          const afResult = await alphafoldGetStructure(accession);
          if (afResult.success && afResult.data) {
            mcpData.pdbStructure = {
              pdbId: afResult.data.entryId,
              title: afResult.data.title,
              resolution: null,
              method: "AlphaFold Prediction",
              organism: afResult.data.organism,
              isAlphaFold: true,
              ligands: [],
            };
            toolsCalled.push("alphafold_get_structure");
            console.log(
              "[Groq] AlphaFold structure found:",
              afResult.data.entryId,
            );
          }
        }
      } catch (err) {
        console.warn("[Groq] AlphaFold fallback failed:", err);
      }
    }
  }

  // Wait for PubMed and bioactivity to finish
  await Promise.all([pubmedPromise, bioactivityPromise]);

  // Fetch binding sites if we found a structure — use the CORRECT ligand, not [0]
  if (allowStructure && mcpData.pdbStructure) {
    try {
      const bestLigand = selectBestLigand(
        mcpData.pdbStructure.ligands,
        expectedLigandId,
        drugName || undefined,
      );
      const ligandName = bestLigand?.name;
      // If we found a better ligand by drug name match, update expectedLigandId
      if (bestLigand && !expectedLigandId) expectedLigandId = bestLigand.name;
      console.log(
        "[Groq] Fetching binding sites for:",
        mcpData.pdbStructure.pdbId,
        "ligand:",
        ligandName || "unknown",
        "(expected:",
        expectedLigandId || "any",
        ")",
      );
      const bindingSites = await pdbGetBindingSites(
        mcpData.pdbStructure.pdbId,
        ligandName,
      );
      if (bindingSites.success && bindingSites.data) {
        mcpData.pdbStructure.bindingSite = bindingSites.data;
        toolsCalled.push("pdb_get_binding_sites");
        console.log(
          "[Groq] Found binding site residues:",
          bindingSites.data.residues?.length || 0,
        );
      }
    } catch (err) {
      console.warn("[Groq] Failed to fetch binding sites:", err);
    }
  }

  // ──── UniProt: detailed protein annotation ────
  // Fetch protein function, domains, subcellular location from UniProt
  // Works for BOTH drug queries (via ChEMBL target) AND protein-only queries (via gene search)
  const primaryTarget = (
    mcpData.drugTargets as
      | { targets: Array<{ uniprotId: string; gene: string }> }
      | undefined
  )?.targets?.[0];
  const uniprotAccession = primaryTarget?.uniprotId;
  const uniprotGeneName = !uniprotAccession ? proteinName : null; // Use gene search only if no accession

  if (uniprotAccession || uniprotGeneName) {
    try {
      if (uniprotAccession) {
        console.log(
          "[Groq] Fetching UniProt data by accession:",
          uniprotAccession,
        );
        const uniResult = await uniprotGetProtein(uniprotAccession);
        if (uniResult.success && uniResult.data) {
          mcpData.uniprotData = {
            accession: uniResult.data.accession,
            name: uniResult.data.name,
            fullName: uniResult.data.fullName,
            organism: uniResult.data.organism,
            function: uniResult.data.function || "",
            domains: uniResult.data.domains || [],
            subcellularLocation: uniResult.data.subcellularLocation || [],
            length: uniResult.data.length,
          };
          toolsCalled.push("uniprot_get_protein");
          console.log("[Groq] UniProt data loaded:", uniResult.data.fullName);
        }
      } else if (uniprotGeneName) {
        // Protein-only query: search UniProt by gene name
        console.log("[Groq] Searching UniProt by gene name:", uniprotGeneName);
        const searchResult = await uniprotSearchByGene(
          uniprotGeneName,
          "Homo sapiens",
        );
        if (
          searchResult.success &&
          searchResult.data &&
          searchResult.data.length > 0
        ) {
          const protein = searchResult.data[0];
          mcpData.uniprotData = {
            accession: protein.accession,
            name: protein.name,
            fullName: protein.fullName,
            organism: protein.organism,
            function: protein.function || "",
            domains: protein.domains || [],
            subcellularLocation: protein.subcellularLocation || [],
            length: protein.length,
          };
          toolsCalled.push("uniprot_search_gene");
          console.log(
            "[Groq] UniProt data loaded via gene search:",
            protein.fullName,
          );
        }
      }
    } catch (err) {
      console.warn("[Groq] UniProt fetch failed:", err);
    }
  }

  // ──── UniProt Variants: clinically relevant mutations ────
  const variantAccession = mcpData.uniprotData?.accession || uniprotAccession;
  if (variantAccession) {
    try {
      console.log("[Groq] Fetching UniProt variants for:", variantAccession);
      const bindingSitePositions =
        mcpData.pdbStructure?.bindingSite?.residues?.map(
          (r: { number: number }) => r.number,
        ) || [];
      const variantResult = await uniprotGetVariants(variantAccession, {
        drugName: drugName || undefined,
        bindingSiteResidues:
          bindingSitePositions.length > 0 ? bindingSitePositions : undefined,
      });
      if (
        variantResult.success &&
        variantResult.data &&
        variantResult.data.length > 0
      ) {
        mcpData.uniprotVariants = variantResult.data;
        toolsCalled.push("uniprot_get_variants");
        console.log(
          "[Groq] UniProt variants loaded:",
          variantResult.data.length,
          "variants",
        );
      } else {
        // Retry once to reduce transient upstream failures
        const retry = await uniprotGetVariants(variantAccession, {
          drugName: drugName || undefined,
          bindingSiteResidues:
            bindingSitePositions.length > 0 ? bindingSitePositions : undefined,
        });
        if (retry.success && retry.data && retry.data.length > 0) {
          mcpData.uniprotVariants = retry.data;
          toolsCalled.push("uniprot_get_variants");
          console.log(
            "[Groq] UniProt variants loaded on retry:",
            retry.data.length,
            "variants",
          );
        }
      }
    } catch (err) {
      console.warn("[Groq] UniProt variants fetch failed:", err);
    }
  }

  // ──── Perplexity: real-time web research for cross-verification ────
  // Runs AFTER MCP data is collected, uses it as context for focused queries
  try {
    const perplexityQuery = drugName
      ? `What is the detailed molecular mechanism of action of ${drugName}? Include the specific protein target, binding site residues, type of inhibition (reversible/irreversible), downstream pathway affected, and clinical pharmacology.`
      : proteinName
        ? `What is the function, structure, and clinical significance of ${proteinName} protein? Include domains, active site residues, associated diseases, and drug targets.`
        : null;

    if (perplexityQuery) {
      // Build context summary from MCP data so Perplexity can cross-verify
      let pplxContext = "";
      if (mcpData.drugTargets) {
        const dt = mcpData.drugTargets as {
          drug: string;
          targets: Array<{ gene: string; protein: string; mechanism: string }>;
        };
        pplxContext += `ChEMBL says: ${dt.drug} targets ${dt.targets?.map((t) => `${t.protein} (${t.gene}) via ${t.mechanism}`).join("; ")}. `;
      }
      if (mcpData.pdbStructure) {
        pplxContext += `PDB structure: ${mcpData.pdbStructure.pdbId} - ${mcpData.pdbStructure.title}. `;
      }

      console.log("[Groq] Calling Perplexity for cross-verification...");
      const pplxResult = await perplexityResearch(
        perplexityQuery,
        pplxContext || undefined,
      );
      if (
        pplxResult.text &&
        !pplxResult.text.startsWith("I couldn't") &&
        !pplxResult.text.startsWith("Research feature")
      ) {
        mcpData.perplexityResearch = pplxResult;
        toolsCalled.push("perplexity_research");
        console.log(
          "[Groq] Perplexity research loaded, citations:",
          pplxResult.citations?.length || 0,
        );
      }
    }
  } catch (err) {
    console.warn("[Groq] Perplexity research failed:", err);
  }

  return { mcpData, toolsCalled, expectedLigand: expectedLigandId };
}

// Build comprehensive context from ALL MCP data sources for the LLM
function buildMCPContext(mcpData: MCPData): string {
  let context =
    "\n\n=== VERIFIED DATABASE DATA (use this as ground truth) ===\n";

  // 1. ChEMBL drug-target data (most authoritative for mechanism)
  if (mcpData.drugTargets) {
    const dt = mcpData.drugTargets as {
      drug: string;
      chemblId?: string;
      molecularFormula?: string;
      molecularWeight?: string;
      synonyms?: string[];
      targets: Array<{
        gene: string;
        protein: string;
        mechanism: string;
        uniprotId: string;
        confidence?: number;
      }>;
    };
    context += `\n[ChEMBL] Drug: ${dt.drug}`;
    if (dt.chemblId) context += ` (${dt.chemblId})`;
    context += "\n";
    if (dt.molecularFormula)
      context += `  Formula: ${dt.molecularFormula}, MW: ${dt.molecularWeight}\n`;
    if (dt.synonyms?.length)
      context += `  Synonyms: ${dt.synonyms.slice(0, 5).join(", ")}\n`;
    if (dt.targets?.length) {
      context += "  Verified Targets:\n";
      for (const t of dt.targets.slice(0, 4)) {
        context += `  → ${t.protein} (gene: ${t.gene}, UniProt: ${t.uniprotId})\n`;
        context += `    Mechanism: ${t.mechanism}\n`;
      }
    }
  }

  // 2. UniProt protein annotation (function, domains, localization)
  if (mcpData.uniprotData) {
    const u = mcpData.uniprotData;
    context += `\n[UniProt] ${u.fullName} (${u.accession})\n`;
    context += `  Organism: ${u.organism}, Length: ${u.length} aa\n`;
    if (u.function) context += `  Function: ${u.function}\n`;
    if (u.subcellularLocation?.length)
      context += `  Location: ${u.subcellularLocation.join(", ")}\n`;
    if (u.domains?.length) {
      context += "  Domains:\n";
      for (const d of u.domains.slice(0, 6)) {
        context += `  → ${d.name} (${d.start}-${d.end})\n`;
      }
    }
  }

  // 3. PDB Structure
  if (mcpData.pdbStructure) {
    const s = mcpData.pdbStructure;
    context += `\n[PDB] ${s.pdbId}: ${s.title}\n`;
    context += `  Resolution: ${s.resolution ? s.resolution + " Å" : "N/A"}, Method: ${s.method}\n`;
    context += `  Organism: ${s.organism}\n`;
    if (s.ligands && s.ligands.length > 0) {
      context += `  Ligands: ${s.ligands.map((l) => `${l.name} (${l.fullName})`).join(", ")}\n`;
    }
    if (s.bindingSite?.residues?.length) {
      context += `  Binding site residues (${s.bindingSite.residues.length} total): ${s.bindingSite.residues
        .slice(0, 20)
        .map((r) => `${r.name}${r.number}(${r.chain})`)
        .join(", ")}\n`;
    }
  }

  // 4. Perplexity real-time research (web-verified scientific data)
  if (mcpData.perplexityResearch) {
    context += `\n[Perplexity Web Research — verified scientific data]:\n`;
    context += mcpData.perplexityResearch.text + "\n";
    if (mcpData.perplexityResearch.citations?.length) {
      context +=
        "Web sources: " +
        mcpData.perplexityResearch.citations.slice(0, 5).join(", ") +
        "\n";
    }
  }

  // 5. PubMed research papers
  if (mcpData.pubmedArticles && mcpData.pubmedArticles.length > 0) {
    context += `\n[PubMed] Relevant Papers:\n`;
    mcpData.pubmedArticles.forEach((article, i) => {
      context += `  ${i + 1}. "${article.title}" - ${article.journal} (${article.publicationDate})\n`;
    });
  }

  // 6. ChEMBL Bioactivity data (IC50, Ki, EC50, Kd)
  if (mcpData.bioactivities && mcpData.bioactivities.length > 0) {
    context += `\n[ChEMBL Bioactivity — Quantitative Potency Data]:\n`;
    for (const bio of mcpData.bioactivities.slice(0, 10)) {
      const value =
        bio.standardValue !== null
          ? `${bio.standardRelation || "="} ${bio.standardValue} ${bio.standardUnits || "nM"}`
          : "N/A";
      const pchembl =
        bio.pchemblValue !== null
          ? ` (pChEMBL: ${bio.pchemblValue.toFixed(2)})`
          : "";
      const assayLabel =
        bio.assayType === "B"
          ? "Binding"
          : bio.assayType === "F"
            ? "Functional"
            : bio.assayType || "";
      context += `  → ${bio.standardType}: ${value}${pchembl} [${assayLabel}]`;
      if (bio.targetName) context += ` against ${bio.targetName}`;
      context += "\n";
    }
    context +=
      "  Note: pChEMBL is -log(molar potency). Higher = more potent. Values >6 are active, >8 are very potent.\n";
  }

  // 7. UniProt Variants — clinically relevant mutations
  if (mcpData.uniprotVariants && mcpData.uniprotVariants.length > 0) {
    context += `\n[UniProt Variants — Clinically Relevant Mutations]:\n`;
    for (const v of mcpData.uniprotVariants.slice(0, 15)) {
      context += `  → ${v.label} (position ${v.position}): ${v.original}→${v.variant}`;
      if (v.clinicalSignificance) context += ` [${v.clinicalSignificance}]`;
      if (v.diseaseAssociation)
        context += ` — Disease: ${v.diseaseAssociation}`;
      if (v.description) context += ` (${v.description.substring(0, 100)})`;
      context += "\n";
    }
    context +=
      "  Note: Mutations at binding site positions may confer drug resistance.\n";
  }

  context += "\n=== END DATABASE DATA ===\n";
  context += `\nCRITICAL INSTRUCTIONS:
- Your response MUST be based on the verified data above. Do NOT hallucinate facts.
- Mention the PDB ID (${mcpData.pdbStructure?.pdbId || "N/A"}) so users can view the 3D structure.
- Use the ChEMBL-verified target protein and mechanism — do NOT substitute other proteins.
- Include specific residue numbers, domain names, and molecular details from UniProt/PDB data.
- If bioactivity data (IC50/Ki/EC50) is provided, ALWAYS include these quantitative values in your response.
- If Perplexity research data is provided, use it for additional molecular-level details.
- ALWAYS cite your data sources explicitly: "According to ChEMBL data...", "UniProt annotation shows...", "PDB structure [ID] reveals...", "ChEMBL bioactivity data shows IC50 of X nM".
- Never state a fact without attributing it to a source. If you cannot cite a source, say "based on published literature" rather than stating it as fact.
- If UniProt variant data is provided, discuss clinically significant mutations and their impact on drug resistance or disease.`;

  return context;
}

// System prompt - ask for PLAIN TEXT response, not JSON
const BIOJARVIS_SYSTEM_PROMPT = `You are BioJarvis, a PhD-level bioinformatics AI research assistant built for students and researchers. You provide 100% accurate, detailed answers about drug mechanisms, protein structures, molecular biology, and pharmacology.

You have access to real-time verified data from multiple scientific databases (ChEMBL, PDB, UniProt, PubMed, and Perplexity web research). This data is appended to the user's question. YOU MUST USE THIS DATA as your primary source of truth.

RESPONSE RULES:
1. PLAIN TEXT only — no JSON, no code blocks, no markdown headers
2. NEVER hallucinate or fabricate scientific facts. If database data says X, report X.
3. Provide COMPREHENSIVE answers — cover ALL relevant aspects:
   • For drugs: target protein, gene name, mechanism type (inhibitor/agonist/antagonist), specific binding residues, reversibility, downstream pathway, clinical indication, side effects
   • For proteins: full name, function, domains, active site, associated diseases, known drug targets, subcellular location
   • For structures: PDB ID, resolution, method, key residues in binding pocket, ligand interactions

4. Structure your response in clear paragraphs:
   - Paragraph 1: Direct answer with the key mechanism/function
   - Paragraph 2: Molecular details — specific residues, domains, binding interactions, kinetics if available
   - Paragraph 3: Clinical significance — therapeutic use, why this matters, related drugs in the same class
   - Paragraph 4 (optional): The 3D structure visualization — mention the PDB ID shown and what features to look for

5. Include specific numbers: residue positions (e.g., Ser530), Ki/IC50 values from ChEMBL data, domain boundaries, resolution
6. ALWAYS cite your data sources explicitly in every paragraph: "According to ChEMBL...", "UniProt annotation shows...", "PDB structure [ID] reveals...", "ChEMBL bioactivity data reports an IC50 of X nM..."
7. If multiple targets exist, rank by clinical relevance and explain all of them
8. Distinguish between reversible and irreversible inhibition, competitive and non-competitive, etc.
9. When discussing binding, mention the type of interactions: hydrogen bonds, hydrophobic contacts, salt bridges, covalent bonds
10. Use proper IUPAC nomenclature and standard gene symbols (e.g., PTGS1 not COX-1, though mention common names too)
11. When bioactivity data (IC50/Ki/EC50/Kd) is provided, ALWAYS include these quantitative values prominently in your response — researchers need numbers, not just qualitative descriptions

ACCURACY MANDATE: You are trained on verified database results. The database data provided below has been fetched in real-time from ChEMBL, RCSB PDB, UniProt, PubMed, and Perplexity. Trust this data over your training data if there is any conflict.`;

export async function processQueryWithGroq(
  question: string,
  userId: string,
  structureContext?: {
    pdbId?: string;
    ligand?: string;
    title?: string;
    bindingSiteResidues?: string[];
  },
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>,
  followUpMemory?: FollowUpMemoryContext,
): Promise<AIResponse> {
  const startTime = Date.now();
  const toolsCalled: string[] = [];

  // Step 0: Extract entities using LLM (fast, cheap model)
  console.log("[Groq] Extracting entities from query...");
  const entities = await extractEntitiesWithLLM(question);
  toolsCalled.push("llm_entity_extraction");

  // Resolve follow-up context from frontend memory first (higher precision than regex)
  const memoryStructure = followUpMemory?.structureContext;
  const rememberedPdbId = memoryStructure?.pdbId;
  if (entities.isFollowUp && memoryStructure) {
    if (!entities.drugName && memoryStructure.ligand) {
      entities.drugName = memoryStructure.ligand.toLowerCase();
      console.log(
        "[Groq] Resolved ligand/drug from follow-up memory:",
        entities.drugName,
      );
    }
    if (!entities.proteinName && memoryStructure.title) {
      const resolvedProtein = extractProteinName(memoryStructure.title);
      if (resolvedProtein) {
        entities.proteinName = resolvedProtein;
        console.log(
          "[Groq] Resolved protein from follow-up memory:",
          entities.proteinName,
        );
      }
    }
  }

  let intentDecision = classifyIntentRoute(question, entities, followUpMemory);
  const compareModeDecision = classifyCompareMode(question);
  toolsCalled.push(`intent_router_initial_${intentDecision.route}`);
  if (compareModeDecision.enabled) {
    toolsCalled.push("compare_mode_enabled");
  }
  console.log(
    "[Groq] Intent route:",
    intentDecision.route,
    intentDecision.reason,
  );

  // Apply remembered PDB context only when structure intent is explicit.
  if (
    intentDecision.route === "structure_required" &&
    !entities.pdbId &&
    rememberedPdbId
  ) {
    entities.pdbId = rememberedPdbId;
    console.log("[Groq] Applied PDB from follow-up memory:", entities.pdbId);
  }

  // For follow-up questions, try to resolve entities from conversation history
  if (entities.isFollowUp && conversationHistory?.length) {
    console.log(
      "[Groq] Follow-up detected, checking conversation history for context...",
    );
    // Find the last message that had drug/protein context
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const msg = conversationHistory[i];
      if (msg.role === "user") {
        const prevEntities = await extractEntitiesWithLLM(msg.content);
        if (!entities.drugName && prevEntities.drugName) {
          entities.drugName = prevEntities.drugName;
          console.log("[Groq] Resolved drug from history:", entities.drugName);
        }
        if (!entities.proteinName && prevEntities.proteinName) {
          entities.proteinName = prevEntities.proteinName;
          console.log(
            "[Groq] Resolved protein from history:",
            entities.proteinName,
          );
        }
        if (entities.drugName || entities.proteinName) break;
      }
    }
  }

  // Persisted conversation fallback (cross-session continuity)
  if (
    entities.isFollowUp &&
    (!entities.drugName || !entities.proteinName) &&
    followUpMemory?.persistedConversation?.length
  ) {
    for (let i = followUpMemory.persistedConversation.length - 1; i >= 0; i--) {
      const msg = followUpMemory.persistedConversation[i];
      if (msg.role !== "user") continue;
      const prevEntities = await extractEntitiesWithLLM(msg.content);
      if (!entities.drugName && prevEntities.drugName) {
        entities.drugName = prevEntities.drugName;
      }
      if (!entities.proteinName && prevEntities.proteinName) {
        entities.proteinName = prevEntities.proteinName;
      }
      if (entities.drugName || entities.proteinName) break;
    }
  }

  // Assistant-text fallback: recover context from prior answers when user asks
  // short conversational follow-ups like "give structure of that".
  if (!entities.drugName || !entities.proteinName || !entities.pdbId) {
    const memoryEntities = recoverEntitiesFromContextText(
      followUpMemory?.lastAssistantAnswer,
    );
    if (!entities.drugName && memoryEntities.drugName) {
      entities.drugName = memoryEntities.drugName;
      console.log(
        "[Groq] Recovered drug from lastAssistantAnswer:",
        entities.drugName,
      );
    }
    if (!entities.proteinName && memoryEntities.proteinName) {
      entities.proteinName = memoryEntities.proteinName;
      console.log(
        "[Groq] Recovered protein from lastAssistantAnswer:",
        entities.proteinName,
      );
    }
    if (!entities.pdbId && memoryEntities.pdbId) {
      entities.pdbId = memoryEntities.pdbId;
      console.log(
        "[Groq] Recovered PDB from lastAssistantAnswer:",
        entities.pdbId,
      );
    }
  }

  if (
    (!entities.drugName || !entities.proteinName || !entities.pdbId) &&
    conversationHistory?.length
  ) {
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const msg = conversationHistory[i];
      const recovered = recoverEntitiesFromContextText(msg.content);
      if (!entities.drugName && recovered.drugName) {
        entities.drugName = recovered.drugName;
      }
      if (!entities.proteinName && recovered.proteinName) {
        entities.proteinName = recovered.proteinName;
      }
      if (!entities.pdbId && recovered.pdbId) {
        entities.pdbId = recovered.pdbId;
      }
      if (entities.drugName && entities.proteinName && entities.pdbId) break;
    }
  }

  // Re-run intent routing after follow-up entity resolution.
  // This captures conversational prompts like "give structure of that"
  // once drug/protein context has been recovered from history.
  intentDecision = classifyIntentRoute(question, entities, followUpMemory);
  toolsCalled.push(`intent_router_final_${intentDecision.route}`);
  console.log(
    "[Groq] Final intent route after context recovery:",
    intentDecision.route,
    intentDecision.reason,
  );

  const hasStructureAnchor = Boolean(
    entities.pdbId ||
    entities.drugName ||
    entities.proteinName ||
    rememberedPdbId ||
    followUpMemory?.structureContext?.pdbId ||
    followUpMemory?.lastAssistantAnswer,
  );

  // Ambiguity guard: if user asks for structure but provides no resolvable
  // anchor, avoid guessing wrong structures and ask a targeted clarification.
  if (intentDecision.route === "structure_required" && !hasStructureAnchor) {
    const executionTime = Date.now() - startTime;
    return {
      text: "I can show a 3D structure, but I need the target first. Please provide a drug/protein name or a PDB ID (for example: 'show EGFR structure', 'show metformin target structure', or 'show PDB 1M17').",
      metadata: {
        tokensUsed: 0,
        executionTime,
        toolsCalled: [...toolsCalled, "clarification_guard_structure_anchor"],
        intentRoute: intentDecision.route,
        structureDecision: "Structure requested but missing resolvable anchor.",
      },
    };
  }

  // Step 1: Fetch real data from MCP servers
  console.log("[Groq] Fetching MCP data for query:", question);
  const {
    mcpData,
    toolsCalled: mcpTools,
    expectedLigand,
  } = await fetchMCPData(question, entities, {
    allowStructure: intentDecision.route === "structure_required",
  });
  toolsCalled.push(...mcpTools);
  console.log("[Groq] MCP tools called:", mcpTools);
  console.log(
    "[Groq] PDB structure found:",
    mcpData.pdbStructure?.pdbId || "none",
  );

  // Step 2: Build context with MCP data
  let mcpContext =
    Object.keys(mcpData).length > 0 ? buildMCPContext(mcpData) : "";
  // Append structure context from frontend (e.g. currently viewed structure) if provided
  if (structureContext?.pdbId) {
    mcpContext += `\n\nCurrently viewing structure: PDB ${structureContext.pdbId}`;
    if (structureContext.ligand)
      mcpContext += `, ligand: ${structureContext.ligand}`;
    if (structureContext.title) mcpContext += ` (${structureContext.title})`;
  }
  if (followUpMemory?.structureContext?.pdbId) {
    mcpContext += `\n\nFollow-up memory structure: PDB ${followUpMemory.structureContext.pdbId}`;
    if (followUpMemory.structureContext.ligand) {
      mcpContext += `, ligand ${followUpMemory.structureContext.ligand}`;
    }
    if (followUpMemory.structureContext.title) {
      mcpContext += ` (${followUpMemory.structureContext.title})`;
    }
  }
  if (followUpMemory?.lastAssistantAnswer) {
    mcpContext += `\n\nPrevious assistant answer summary (for continuity): ${followUpMemory.lastAssistantAnswer.slice(0, 600)}`;
  }
  if (compareModeDecision.enabled) {
    mcpContext +=
      "\n\n[Comparison Mode]: The user asked for a comparison. Provide a balanced side-by-side comparison that covers mechanism, primary targets, structural/binding differences (if available), clinical use, and key safety/limitations. If data is missing for one side, say so explicitly.";
  }

  // Step 3: Call Groq LLM with MCP context + conversation history
  try {
    // Build messages array with conversation history for multi-turn support
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: BIOJARVIS_SYSTEM_PROMPT },
    ];

    // Add last 4 turns of conversation history (to stay within context limits)
    if (followUpMemory?.persistedConversation?.length) {
      const persistedRecent = followUpMemory.persistedConversation.slice(-4);
      for (const msg of persistedRecent) {
        messages.push({ role: msg.role, content: msg.content.slice(0, 1200) });
      }
    }

    if (conversationHistory?.length) {
      const recentHistory = conversationHistory.slice(-8); // Last 4 exchanges (8 messages)
      for (const msg of recentHistory) {
        messages.push({
          role: msg.role,
          // Truncate long assistant messages to save tokens
          content:
            msg.role === "assistant"
              ? msg.content.slice(0, 1500) +
                (msg.content.length > 1500 ? "..." : "")
              : msg.content,
        });
      }
    }

    // Add current question with MCP data
    messages.push({ role: "user", content: question + mcpContext });

    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages,
        max_tokens: 4000,
        temperature: 0.15,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Groq API Error ${response.status}: ${errorData}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";
    const tokensUsed =
      (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0);

    // Clean up any JSON artifacts from the response
    content = content
      .replace(/^\s*\{[\s\S]*?"text"\s*:\s*"/, "")
      .replace(/"\s*,?\s*"structure"[\s\S]*$/, "")
      .replace(/^["']|["']$/g, "")
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .trim();

    // Extract mutations: strict policy — only UniProt-validated variants
    let mutations: Array<{
      original: string;
      position: number;
      mutated: string;
      label: string;
      clinicalSignificance?: string;
      diseaseAssociation?: string;
      evidenceTier?: "clinical" | "literature" | "computational" | "predicted";
    }> = [];
    let mutationSource: "uniprot" | "none" = "none";
    if (mcpData.uniprotVariants && mcpData.uniprotVariants.length > 0) {
      mutationSource = "uniprot";
      mutations = mcpData.uniprotVariants.slice(0, 20).map((v) => ({
        original: v.original,
        position: v.position,
        mutated: v.variant,
        label: v.label,
        clinicalSignificance: v.clinicalSignificance,
        diseaseAssociation: v.diseaseAssociation,
        evidenceTier: classifyMutationTier(
          v.clinicalSignificance,
          v.diseaseAssociation,
        ),
      }));
      console.log(
        "[Groq] Using",
        mutations.length,
        "UniProt-verified variants",
      );
    }

    // Build structure data from MCP
    let structure: AIResponse["structure"] | undefined;
    if (mcpData.pdbStructure) {
      // Convert binding site residues to highlight array format
      const highlight: string[] = [];
      if (mcpData.pdbStructure.bindingSite?.residues) {
        for (const residue of mcpData.pdbStructure.bindingSite.residues) {
          if (typeof residue === "object" && residue.number) {
            highlight.push(`${residue.chain || "A"}:${residue.number}`);
          }
        }
      }

      // Select the correct drug ligand (not a random ion like CL)
      const bestLigand = selectBestLigand(
        mcpData.pdbStructure.ligands,
        expectedLigand,
        extractDrugName(question) || undefined,
      );

      // ENHANCEMENT: For protein-only queries with no drug binding site,
      // use UniProt active site residues as fallback visualization
      let bindingSiteSource: "pdb" | "uniprot-fallback" | undefined = mcpData
        .pdbStructure.bindingSite
        ? "pdb"
        : undefined;
      let bindingSiteData:
        | {
            residues: Array<{
              chain?: string;
              number: number;
              name: string;
              distance?: number;
            }>;
            name?: string;
          }
        | undefined = mcpData.pdbStructure.bindingSite
        ? {
            ...mcpData.pdbStructure.bindingSite,
            name: undefined as string | undefined,
          }
        : undefined;
      if (!bindingSiteData && mcpData.uniprotData?.domains?.length) {
        // Extract active site residues from UniProt domains
        const activeSites = mcpData.uniprotData.domains.filter(
          (d) =>
            d.name?.includes("Active site") || d.name?.includes("Binding site"),
        );
        if (activeSites.length > 0) {
          // Use residue range from active site domains as highlight
          for (const site of activeSites) {
            if (site.start && site.end) {
              for (let i = site.start; i <= site.end; i++) {
                highlight.push(`A:${i}`);
              }
            }
          }
          bindingSiteData = {
            residues: activeSites.map(
              (
                site, // Convert domain ranges to residue objects
              ) => ({
                chain: undefined,
                number: site.start || 0,
                name: site.name?.replace("Active site: ", "") || "Active Site",
                distance: undefined,
              }),
            ),
            name: "Active/Binding Site (UniProt features)",
          };
          bindingSiteSource = "uniprot-fallback";
          console.log(
            "[Groq] Enhanced binding site with UniProt active sites:",
            activeSites.length,
          );
        }
      }

      let structureConfidence: "high" | "medium" | "low" = "low";
      let structureEvidence =
        "Best-effort structure retrieval with limited target confidence";
      if (
        toolsCalled.includes("pdb_get_structure") ||
        toolsCalled.includes("pdb_get_structure_curated") ||
        toolsCalled.includes("pdb_search_drug_target")
      ) {
        structureConfidence = "high";
        structureEvidence =
          "Direct PDB retrieval from explicit/cross-validated target evidence";
      } else if (toolsCalled.includes("pdb_search_protein")) {
        structureConfidence = "medium";
        structureEvidence = "Protein-level PDB search with moderate confidence";
      } else if (toolsCalled.includes("alphafold_get_structure")) {
        structureConfidence = "low";
        structureEvidence = "AlphaFold predicted model fallback";
      }

      structure = {
        pdbId: mcpData.pdbStructure.pdbId,
        title: mcpData.pdbStructure.title,
        ligand: bestLigand?.name,
        ligandFullName: bestLigand?.fullName,
        isAlphaFold: mcpData.pdbStructure.isAlphaFold || undefined,
        resolution: mcpData.pdbStructure.resolution || undefined,
        method: mcpData.pdbStructure.method || undefined,
        highlight: highlight.length > 0 ? highlight : undefined,
        // CRITICAL: pass bindingSite through so viewer can highlight residues
        bindingSite: bindingSiteData?.residues?.length
          ? {
              residues: bindingSiteData.residues,
              name: bestLigand
                ? `${bestLigand.fullName} (${bestLigand.name})`
                : bindingSiteData.name || "Binding Site",
              source: bindingSiteSource,
            }
          : undefined,
        mutations: mutations.length > 0 ? mutations : undefined,
        annotationProvenance: {
          bindingSiteConfidence:
            bindingSiteSource === "pdb"
              ? "high"
              : bindingSiteSource === "uniprot-fallback"
                ? "medium"
                : undefined,
          mutationConfidence: mutationSource === "uniprot" ? "high" : undefined,
          ligandConfidence: bestLigand ? "high" : undefined,
          structureConfidence,
          bindingSiteEvidence:
            bindingSiteSource === "pdb"
              ? "PDB/PDBe binding-site residues"
              : bindingSiteSource === "uniprot-fallback"
                ? "UniProt active/binding-site feature fallback"
                : undefined,
          mutationEvidence:
            mutationSource === "uniprot"
              ? "UniProt reviewed variant annotations"
              : undefined,
          ligandEvidence: bestLigand
            ? "PDB ligand records filtered by expected query ligand"
            : undefined,
          structureEvidence,
        },
      };

      if (structureConfidence === "low") {
        content +=
          "\n\nNote: Structure confidence is low for this candidate. Treat residue-level interpretation cautiously and consider confirming with an experimentally resolved PDB co-crystal.";
      }
      console.log(
        "[Groq] Returning structure with",
        highlight.length,
        "binding residues,",
        structure.bindingSite?.residues?.length || 0,
        "bindingSite residues,",
        mutations.length,
        "mutations",
      );
    }

    let compareStructures: AIResponse["compareStructures"];
    if (compareModeDecision.enabled) {
      compareStructures = await buildCompareStructures(
        question,
        toolsCalled,
        structure,
      );
    }

    // Build sources from PubMed articles + Perplexity citations
    const sources: AIResponse["sources"] =
      mcpData.pubmedArticles?.map((article) => ({
        title: article.title,
        url: article.url,
        journal: article.journal,
        year:
          article.publicationDate?.split(" ")?.[0] || article.publicationDate,
      })) || [];

    // Add Perplexity web citations as additional sources
    if (mcpData.perplexityResearch?.citations?.length) {
      for (const citation of mcpData.perplexityResearch.citations.slice(0, 5)) {
        // Perplexity citations are URLs
        if (citation.startsWith("http")) {
          const domain = getDomainFromUrl(citation);
          if (!domain) continue;
          sources.push({
            title: `Web source: ${domain}`,
            url: citation,
          });
        }
      }
    }

    const evidenceClaims = buildEvidenceClaims(mcpData, structure);
    const policyResult = applyEvidencePolicy(content, evidenceClaims);
    const policyAdjustedContent = policyResult.text;
    const claimTraceability = buildClaimTraceability(
      policyAdjustedContent,
      evidenceClaims,
    );
    const responseConfidence = deriveResponseConfidence(
      evidenceClaims,
      structure,
    );

    const uncertaintyWarning = generateUncertaintyWarning(
      responseConfidence.level,
      evidenceClaims,
      structure,
    );

    return {
      text: policyAdjustedContent,
      structure,
      compareStructures,
      sources,
      evidenceClaims,
      claimTraceability,
      metadata: {
        tokensUsed,
        executionTime: Date.now() - startTime,
        toolsCalled,
        responseConfidence: responseConfidence.level,
        confidenceRationale: responseConfidence.rationale,
        uncertaintyWarning,
        intentRoute: intentDecision.route,
        structureDecision: intentDecision.reason,
        compareMode: compareModeDecision.enabled,
        compareReason: compareModeDecision.reason,
        policyFlags: policyResult.policyFlags,
        reviewStatus: "draft",
      },
    };
  } catch (error) {
    console.error("[Groq] API error:", error);

    // Fallback: return MCP data even if LLM fails
    let fallbackText = `I encountered an error processing your request. `;

    if (mcpData.pdbStructure) {
      fallbackText += `However, I found a relevant structure: ${mcpData.pdbStructure.pdbId} - ${mcpData.pdbStructure.title}`;
    }

    let fallbackStructure: AIResponse["structure"] | undefined;
    if (mcpData.pdbStructure) {
      const fallbackHighlight: string[] = [];
      if (mcpData.pdbStructure.bindingSite?.residues?.length) {
        for (const residue of mcpData.pdbStructure.bindingSite.residues) {
          fallbackHighlight.push(`${residue.chain || "A"}:${residue.number}`);
        }
      }

      const fallbackLigand = selectBestLigand(
        mcpData.pdbStructure.ligands,
        expectedLigand,
        extractDrugName(question) || undefined,
      );

      const fallbackMutations =
        mcpData.uniprotVariants?.slice(0, 20).map((v) => ({
          original: v.original,
          position: v.position,
          mutated: v.variant,
          label: v.label,
          clinicalSignificance: v.clinicalSignificance,
          diseaseAssociation: v.diseaseAssociation,
          evidenceTier: classifyMutationTier(
            v.clinicalSignificance,
            v.diseaseAssociation,
          ),
        })) || [];

      let structureConfidence: "high" | "medium" | "low" = "low";
      let structureEvidence =
        "Best-effort structure retrieval after LLM fallback";
      if (
        toolsCalled.includes("pdb_get_structure") ||
        toolsCalled.includes("pdb_get_structure_curated") ||
        toolsCalled.includes("pdb_search_drug_target")
      ) {
        structureConfidence = "high";
        structureEvidence =
          "Direct PDB retrieval from explicit/cross-validated target evidence";
      } else if (toolsCalled.includes("pdb_search_protein")) {
        structureConfidence = "medium";
        structureEvidence = "Protein-level PDB search with moderate confidence";
      }

      fallbackStructure = {
        pdbId: mcpData.pdbStructure.pdbId,
        title: mcpData.pdbStructure.title,
        ligand: fallbackLigand?.name,
        ligandFullName: fallbackLigand?.fullName,
        isAlphaFold:
          "isAlphaFold" in mcpData.pdbStructure
            ? (mcpData.pdbStructure as { isAlphaFold?: boolean }).isAlphaFold ||
              undefined
            : undefined,
        resolution: mcpData.pdbStructure.resolution || undefined,
        method: mcpData.pdbStructure.method || undefined,
        highlight: fallbackHighlight.length > 0 ? fallbackHighlight : undefined,
        bindingSite: mcpData.pdbStructure.bindingSite?.residues?.length
          ? {
              residues: mcpData.pdbStructure.bindingSite.residues,
              name: fallbackLigand
                ? `${fallbackLigand.fullName} (${fallbackLigand.name})`
                : "Binding Site",
              source: "pdb",
            }
          : undefined,
        mutations: fallbackMutations.length > 0 ? fallbackMutations : undefined,
        annotationProvenance: {
          bindingSiteConfidence: mcpData.pdbStructure.bindingSite?.residues
            ?.length
            ? "high"
            : undefined,
          mutationConfidence: fallbackMutations.length > 0 ? "high" : undefined,
          ligandConfidence: fallbackLigand ? "high" : undefined,
          structureConfidence,
          bindingSiteEvidence: mcpData.pdbStructure.bindingSite?.residues
            ?.length
            ? "PDB/PDBe binding-site residues"
            : undefined,
          mutationEvidence:
            fallbackMutations.length > 0
              ? "UniProt reviewed variant annotations"
              : undefined,
          ligandEvidence: fallbackLigand
            ? "PDB ligand records filtered by expected query ligand"
            : undefined,
          structureEvidence,
        },
      };
    }

    const fallbackEvidenceClaims = buildEvidenceClaims(
      mcpData,
      fallbackStructure,
    );
    const fallbackPolicyResult = applyEvidencePolicy(
      fallbackText,
      fallbackEvidenceClaims,
    );
    const fallbackClaimTraceability = buildClaimTraceability(
      fallbackPolicyResult.text,
      fallbackEvidenceClaims,
    );
    const fallbackResponseConfidence = deriveResponseConfidence(
      fallbackEvidenceClaims,
      fallbackStructure,
    );

    const fallbackUncertaintyWarning = generateUncertaintyWarning(
      fallbackResponseConfidence.level,
      fallbackEvidenceClaims,
      fallbackStructure,
    );

    return {
      text: fallbackPolicyResult.text,
      structure: fallbackStructure,
      compareStructures: compareModeDecision.enabled
        ? await buildCompareStructures(question, toolsCalled, fallbackStructure)
        : undefined,
      sources:
        mcpData.pubmedArticles?.map((article) => ({
          title: article.title,
          url: article.url,
          journal: article.journal,
          year: article.publicationDate?.split(" ")?.[0],
        })) || [],
      evidenceClaims: fallbackEvidenceClaims,
      claimTraceability: fallbackClaimTraceability,
      metadata: {
        tokensUsed: 0,
        executionTime: Date.now() - startTime,
        toolsCalled,
        responseConfidence: fallbackResponseConfidence.level,
        confidenceRationale: fallbackResponseConfidence.rationale,
        uncertaintyWarning: fallbackUncertaintyWarning,
        intentRoute: intentDecision.route,
        structureDecision: intentDecision.reason,
        compareMode: compareModeDecision.enabled,
        compareReason: compareModeDecision.reason,
        policyFlags: fallbackPolicyResult.policyFlags,
        reviewStatus: "draft",
      },
    };
  }
}
