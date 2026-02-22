import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { historyQuerySchema, sanitizeForLike, deleteItemSchema, validateRequestBody, validateQueryParams } from '@/lib/utils/validation'
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from '@/lib/utils/rate-limiter'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please log in to view your history' },
        { status: 401 }
      )
    }

    // Rate limiting
    const rateLimitResult = checkRateLimit({
      ...RATE_LIMITS.readonly,
      identifier: `history:${user.id}`,
    })

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', message: 'Too many requests. Please wait.' },
        { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
      )
    }

    // Validate query params
    const validation = validateQueryParams(request.nextUrl.searchParams, historyQuerySchema)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', message: validation.error },
        { status: 400 }
      )
    }

    const { limit, offset, search } = validation.data

    let query = supabase
      .from('query_history')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (search) {
      const sanitizedSearch = sanitizeForLike(search)
      query = query.or(
        `question.ilike.%${sanitizedSearch}%,drug_name.ilike.%${sanitizedSearch}%,target_protein.ilike.%${sanitizedSearch}%`
      )
    }

    const { data: history, error, count } = await query

    if (error) {
      throw error
    }

    return NextResponse.json(
      {
        history: history || [],
        total: count || 0,
        limit,
        offset,
      },
      { headers: getRateLimitHeaders(rateLimitResult) }
    )
  } catch (error) {
    console.error('History API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Failed to fetch history',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
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

    // Validate request body
    const validation = await validateRequestBody(request, deleteItemSchema)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', message: validation.error },
        { status: 400 }
      )
    }

    const { id } = validation.data

    const { error } = await supabase
      .from('query_history')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete history error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Failed to delete query',
      },
      { status: 500 }
    )
  }
}
