import { createClient } from './client'
import { AIResponse, QueryHistory, Profile, UsageTracking } from '@/types/database'

// Type helpers for Supabase responses
type ProfileRow = { subscription_tier?: string }
type UsageRow = { query_count?: number; tokens_used?: number }
type CacheRow = { response?: AIResponse; hit_count?: number }

// Save a query to the history
export async function saveQuery(
  userId: string,
  question: string,
  response: AIResponse,
  mcpTools: string[],
  tokensUsed: number,
  executionTime: number,
  metadata: {
    pdbId?: string
    drugName?: string
    targetProtein?: string
  }
): Promise<QueryHistory> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('query_history')
    .insert({
      user_id: userId,
      question,
      response,
      mcp_tools_used: mcpTools,
      tokens_used: tokensUsed,
      execution_time_ms: executionTime,
      pdb_id: metadata.pdbId,
      drug_name: metadata.drugName,
      target_protein: metadata.targetProtein,
    } as Record<string, unknown>)
    .select()
    .single()

  if (error) throw error

  // Update usage tracking
  const today = new Date().toISOString().split('T')[0]
  const { data: existingUsage } = await supabase
    .from('usage_tracking')
    .select('query_count, tokens_used')
    .eq('user_id', userId)
    .eq('date', today)
    .single()

  if (existingUsage) {
    const existing = existingUsage as UsageRow
    await supabase
      .from('usage_tracking')
      .update({
        query_count: (existing.query_count || 0) + 1,
        tokens_used: (existing.tokens_used || 0) + tokensUsed,
      } as Record<string, unknown>)
      .eq('user_id', userId)
      .eq('date', today)
  } else {
    await supabase.from('usage_tracking').insert({
      user_id: userId,
      date: today,
      query_count: 1,
      tokens_used: tokensUsed,
    } as Record<string, unknown>)
  }

  return data as QueryHistory
}

// Get user query history
export async function getUserHistory(userId: string, limit = 50): Promise<QueryHistory[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('query_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

// Search user history
export async function searchHistory(userId: string, searchTerm: string): Promise<QueryHistory[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('query_history')
    .select('*')
    .eq('user_id', userId)
    .or(`question.ilike.%${searchTerm}%,drug_name.ilike.%${searchTerm}%,target_protein.ilike.%${searchTerm}%`)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

// Check user quota
export async function checkUserQuota(userId: string): Promise<{
  limit: number
  used: number
  remaining: number
  canQuery: boolean
}> {
  const supabase = createClient()

  const { data: profileData } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .single()
  const profile = profileData as ProfileRow | null

  const today = new Date().toISOString().split('T')[0]
  const { data: usageData } = await supabase
    .from('usage_tracking')
    .select('query_count')
    .eq('user_id', userId)
    .eq('date', today)
    .single()
  const usage = usageData as UsageRow | null

  const quotas: Record<string, number> = {
    free: 10,
    pro: 1000,
    enterprise: Infinity,
  }

  const tier = (profile?.subscription_tier || 'free') as string
  const limit = quotas[tier] || 10
  const used = usage?.query_count || 0

  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
    canQuery: used < limit,
  }
}

// Get cached query
export async function getCachedQuery(queryKey: string): Promise<AIResponse | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('query_cache')
    .select('response, hit_count')
    .eq('query_key', queryKey)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (error || !data) return null

  const cacheData = data as CacheRow

  // Increment hit count
  await supabase
    .from('query_cache')
    .update({ hit_count: (cacheData.hit_count || 0) + 1 } as Record<string, unknown>)
    .eq('query_key', queryKey)

  return cacheData.response || null
}

// Set cached query
export async function setCachedQuery(queryKey: string, response: AIResponse): Promise<void> {
  const supabase = createClient()

  await supabase.from('query_cache').upsert({
    query_key: queryKey,
    response,
    hit_count: 0,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  } as Record<string, unknown>)
}

// Get user profile
export async function getUserProfile(userId: string): Promise<Profile | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) return null
  return data as Profile
}

// Update user profile
export async function updateUserProfile(
  userId: string,
  updates: Partial<Profile>
): Promise<Profile | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() } as Record<string, unknown>)
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error
  return data as Profile
}

// Add to favorites
export async function addToFavorites(
  userId: string,
  queryId: string,
  query: string,
  notes?: string
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.from('favorites').insert({
    user_id: userId,
    query_id: queryId,
    query,
    notes,
  } as Record<string, unknown>)

  if (error && error.code !== '23505') throw error // Ignore duplicate errors
}

// Remove from favorites
export async function removeFromFavorites(userId: string, favoriteId: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('id', favoriteId)

  if (error) throw error
}

// Get user favorites
export async function getUserFavorites(userId: string): Promise<Array<{ id: string; query: string; notes: string | null; query_id: string | null; created_at: string }>> {
  const supabase = createClient()

  const { data: favorites, error: favError } = await supabase
    .from('favorites')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (favError) throw favError

  return (favorites || []) as Array<{ id: string; query: string; notes: string | null; query_id: string | null; created_at: string }>
}

// Get user's daily usage
export async function getDailyUsage(userId: string): Promise<UsageTracking | null> {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('usage_tracking')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single()

  if (error) return null
  return data as UsageTracking
}
