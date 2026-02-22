import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  addFavoriteSchema,
  deleteFavoriteSchema,
  validateRequestBody,
} from "@/lib/utils/validation";
import {
  checkRateLimit,
  RATE_LIMITS,
  getRateLimitHeaders,
} from "@/lib/utils/rate-limiter";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting
    const rateLimitResult = checkRateLimit({
      ...RATE_LIMITS.readonly,
      identifier: `favorites:${user.id}`,
    });

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: getRateLimitHeaders(rateLimitResult) },
      );
    }

    // Get favorites with their associated queries
    const { data: favorites, error } = await supabase
      .from("favorites")
      .select(
        `
        id,
        query_id,
        notes,
        created_at,
        query,
        linked_query:query_history(*)
      `,
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const normalizedFavorites = (favorites || []).map((favorite) => {
      const linkedQuery = favorite.linked_query as {
        question?: string;
        drug_name?: string | null;
      } | null;

      return {
        id: favorite.id,
        user_id: user.id,
        query_id: favorite.query_id,
        query: linkedQuery?.question || favorite.query || "",
        title: linkedQuery?.drug_name || null,
        notes: favorite.notes,
        created_at: favorite.created_at,
      };
    });

    return NextResponse.json(
      { favorites: normalizedFavorites },
      { headers: getRateLimitHeaders(rateLimitResult) },
    );
  } catch (error) {
    console.error("Favorites API error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Failed to fetch favorites",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate request body
    const validation = await validateRequestBody(request, addFavoriteSchema);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", message: validation.error },
        { status: 400 },
      );
    }

    const { queryId, notes } = validation.data;

    // Verify the query belongs to the user
    const { data: query } = await supabase
      .from("query_history")
      .select("id, question")
      .eq("id", queryId)
      .eq("user_id", user.id)
      .single();

    if (!query) {
      return NextResponse.json({ error: "Query not found" }, { status: 404 });
    }

    const { data: favorite, error } = await supabase
      .from("favorites")
      .insert({
        user_id: user.id,
        query_id: queryId,
        query: query.question,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      // Handle duplicate
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Already in favorites" },
          { status: 409 },
        );
      }
      throw error;
    }

    return NextResponse.json({ favorite });
  } catch (error) {
    console.error("Add favorite error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Failed to add favorite",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate request body
    const validation = await validateRequestBody(request, deleteFavoriteSchema);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", message: validation.error },
        { status: 400 },
      );
    }

    const { id, queryId } = validation.data;

    const favoriteQuery = supabase
      .from("favorites")
      .delete()
      .eq("user_id", user.id);

    const { error } = id
      ? await favoriteQuery.eq("id", id)
      : await favoriteQuery.eq("query_id", queryId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove favorite error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Failed to remove favorite",
      },
      { status: 500 },
    );
  }
}
