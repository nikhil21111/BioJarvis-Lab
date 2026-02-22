import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

interface UsageRow {
  query_count?: number
  tokens_used?: number
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user profile for subscription tier
    const { data: profileData } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single()
    const profile = profileData as { subscription_tier?: string } | null

    // Get today's usage
    const today = new Date().toISOString().split('T')[0]
    const { data: usageData } = await supabase
      .from('usage_tracking')
      .select('query_count, tokens_used')
      .eq('user_id', user.id)
      .eq('date', today)
      .single()
    const usage = usageData as UsageRow | null

    // Get total usage this month
    const firstOfMonth = new Date()
    firstOfMonth.setDate(1)
    firstOfMonth.setHours(0, 0, 0, 0)

    const { data: monthlyUsageData } = await supabase
      .from('usage_tracking')
      .select('query_count, tokens_used')
      .eq('user_id', user.id)
      .gte('date', firstOfMonth.toISOString().split('T')[0])
    const monthlyUsage = (monthlyUsageData || []) as UsageRow[]

    const monthlyQueries = monthlyUsage.reduce((acc, u) => acc + (u.query_count || 0), 0)
    const monthlyTokens = monthlyUsage.reduce((acc, u) => acc + (u.tokens_used || 0), 0)

    // Quota limits by tier
    const quotas: Record<string, number> = {
      free: 10,
      pro: 1000,
      enterprise: 10000,
    }

    const tier = (profile?.subscription_tier || 'free') as string
    const dailyLimit = quotas[tier] || 10
    const dailyUsed = usage?.query_count || 0

    return NextResponse.json({
      tier,
      daily: {
        limit: dailyLimit,
        used: dailyUsed,
        remaining: Math.max(0, dailyLimit - dailyUsed),
        canQuery: dailyUsed < dailyLimit,
      },
      monthly: {
        queries: monthlyQueries,
        tokens: monthlyTokens,
      },
      today: {
        queries: dailyUsed,
        tokens: usage?.tokens_used || 0,
      },
    })
  } catch (error) {
    console.error('Usage API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Failed to fetch usage',
      },
      { status: 500 }
    )
  }
}
