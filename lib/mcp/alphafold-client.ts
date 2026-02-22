import { MCPToolResult } from '@/types/mcp'

const ALPHAFOLD_API_URL = 'https://alphafold.ebi.ac.uk/api'

export interface AlphaFoldStructure {
  entryId: string
  title: string
  uniprotId: string
  gene: string
  organism: string
  paeUrl: string
  cifUrl: string
  pdbUrl: string
  confidenceScore: number // Average pLDDT
  modelVersion: number
}

// Get predicted structure from AlphaFold by UniProt accession
export async function alphafoldGetStructure(
  uniprotId: string
): Promise<MCPToolResult<AlphaFoldStructure>> {
  const startTime = Date.now()

  try {
    const normalizedId = uniprotId.trim().toUpperCase()

    const response = await fetch(
      `${ALPHAFOLD_API_URL}/prediction/${normalizedId}`,
      { next: { revalidate: 604800 } } // Cache for 7 days (predicted structures rarely change)
    )

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`No AlphaFold prediction found for UniProt ${normalizedId}`)
      }
      throw new Error(`AlphaFold API error: ${response.status}`)
    }

    const data = await response.json()

    // AlphaFold returns an array, take the first (latest) prediction
    const prediction = Array.isArray(data) ? data[0] : data

    if (!prediction) {
      throw new Error(`No AlphaFold prediction available for ${normalizedId}`)
    }

    return {
      success: true,
      data: {
        entryId: prediction.entryId || `AF-${normalizedId}-F1`,
        title: `AlphaFold predicted structure for ${prediction.uniprotDescription || normalizedId}`,
        uniprotId: normalizedId,
        gene: prediction.gene || '',
        organism: prediction.organismScientificName || '',
        paeUrl: prediction.paeDocUrl || prediction.paeImageUrl || '',
        cifUrl: prediction.cifUrl || `https://alphafold.ebi.ac.uk/files/AF-${normalizedId}-F1-model_v4.cif`,
        pdbUrl: prediction.pdbUrl || `https://alphafold.ebi.ac.uk/files/AF-${normalizedId}-F1-model_v4.pdb`,
        confidenceScore: prediction.globalMetricValue || prediction.plddt || 0,
        modelVersion: prediction.latestVersion || 4,
      },
      executionTime: Date.now() - startTime,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTime: Date.now() - startTime,
    }
  }
}

// Search AlphaFold predictions by organism and gene
export async function alphafoldSearch(
  query: string,
  organism?: string
): Promise<MCPToolResult<AlphaFoldStructure[]>> {
  const startTime = Date.now()

  try {
    // AlphaFold doesn't have a search API - use UniProt search to find accession,
    // then check if AlphaFold has a prediction
    const uniprotSearchUrl = `https://rest.uniprot.org/uniprotkb/search?query=${encodeURIComponent(query)}${
      organism ? `+AND+organism_name:${encodeURIComponent(organism)}` : ''
    }&format=json&fields=accession,gene_names,organism_name,protein_name&size=5&sort=annotation_score+desc`

    const searchResponse = await fetch(uniprotSearchUrl, {
      next: { revalidate: 86400 },
    })

    if (!searchResponse.ok) {
      throw new Error(`UniProt search failed: ${searchResponse.status}`)
    }

    const searchData = await searchResponse.json()
    const results: AlphaFoldStructure[] = []

    for (const entry of searchData.results?.slice(0, 3) || []) {
      const accession = entry.primaryAccession
      const afResult = await alphafoldGetStructure(accession)
      if (afResult.success && afResult.data) {
        results.push(afResult.data)
      }
    }

    return {
      success: results.length > 0,
      data: results,
      error: results.length === 0 ? `No AlphaFold predictions found for "${query}"` : undefined,
      executionTime: Date.now() - startTime,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTime: Date.now() - startTime,
    }
  }
}
