import { PubMedArticle, MCPToolResult } from '@/types/mcp'

const PUBMED_BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'

// Search PubMed for articles
export async function pubmedSearch(
  query: string,
  limit: number = 5
): Promise<MCPToolResult<PubMedArticle[]>> {
  const startTime = Date.now()
  
  try {
    // Step 1: Search for article IDs
    const searchResponse = await fetch(
      `${PUBMED_BASE_URL}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${limit}&retmode=json`,
      { next: { revalidate: 3600 } } // Cache for 1 hour
    )
    
    if (!searchResponse.ok) {
      throw new Error(`PubMed search failed: ${searchResponse.status}`)
    }
    
    const searchData = await searchResponse.json()
    const pmids = searchData.esearchresult?.idlist || []
    
    if (pmids.length === 0) {
      return {
        success: true,
        data: [],
        executionTime: Date.now() - startTime,
      }
    }
    
    // Step 2: Fetch article details
    const summaryResponse = await fetch(
      `${PUBMED_BASE_URL}/esummary.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=json`,
      { next: { revalidate: 3600 } }
    )
    
    if (!summaryResponse.ok) {
      throw new Error(`PubMed summary fetch failed: ${summaryResponse.status}`)
    }
    
    const summaryData = await summaryResponse.json()
    const articles: PubMedArticle[] = []
    
    for (const pmid of pmids) {
      const article = summaryData.result?.[pmid]
      if (article) {
        articles.push({
          pmid,
          title: article.title || '',
          authors: article.authors?.map((a: { name: string }) => a.name) || [],
          journal: article.source || '',
          publicationDate: article.pubdate || '',
          doi: article.elocationid?.replace('doi: ', '') || undefined,
          url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        })
      }
    }

    return {
      success: true,
      data: articles,
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

// Get abstract for a specific article
export async function pubmedGetAbstract(pmid: string): Promise<MCPToolResult<PubMedArticle>> {
  const startTime = Date.now()
  
  try {
    // Get full article details including abstract
    const response = await fetch(
      `${PUBMED_BASE_URL}/efetch.fcgi?db=pubmed&id=${pmid}&rettype=abstract&retmode=xml`,
      { next: { revalidate: 86400 } }
    )
    
    if (!response.ok) {
      throw new Error(`PubMed article ${pmid} not found`)
    }
    
    const xmlText = await response.text()
    
    // Parse XML to extract abstract (simplified)
    const abstractMatch = xmlText.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)
    let abstract = ''
    if (abstractMatch) {
      abstract = abstractMatch
        .map(m => m.replace(/<[^>]+>/g, '').trim())
        .join(' ')
    }
    
    const titleMatch = xmlText.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/)
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : ''
    
    const journalMatch = xmlText.match(/<Title>([\s\S]*?)<\/Title>/)
    const journal = journalMatch ? journalMatch[1].trim() : ''
    
    // Extract authors
    const authors: string[] = []
    const authorMatches = xmlText.matchAll(/<LastName>([^<]+)<\/LastName>\s*<ForeName>([^<]+)<\/ForeName>/g)
    for (const match of authorMatches) {
      authors.push(`${match[2]} ${match[1]}`)
    }
    
    // Extract publication date
    const yearMatch = xmlText.match(/<PubDate[^>]*>[\s\S]*?<Year>(\d{4})<\/Year>/)
    const monthMatch = xmlText.match(/<PubDate[^>]*>[\s\S]*?<Month>(\w+)<\/Month>/)
    const pubDate = yearMatch 
      ? `${yearMatch[1]}${monthMatch ? ` ${monthMatch[1]}` : ''}`
      : ''
    
    // Extract DOI
    const doiMatch = xmlText.match(/<ArticleId IdType="doi">([^<]+)<\/ArticleId>/)
    const doi = doiMatch ? doiMatch[1] : undefined

    return {
      success: true,
      data: {
        pmid,
        title,
        abstract,
        authors,
        journal,
        publicationDate: pubDate,
        doi,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
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

// Search for drug mechanism papers
export async function pubmedSearchDrugMechanism(
  drugName: string,
  targetName?: string,
  limit: number = 5
): Promise<MCPToolResult<PubMedArticle[]>> {
  let query = `${drugName}[Title/Abstract] AND (mechanism[Title/Abstract] OR pharmacology[Title/Abstract])`
  if (targetName) {
    query += ` AND ${targetName}[Title/Abstract]`
  }
  query += ' AND humans[MeSH Terms]'
  
  return pubmedSearch(query, limit)
}
