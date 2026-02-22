import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { processQueryWithGroq } from "@/lib/ai/groq-client";
import { chatRequestSchema } from "@/lib/utils/validation";
import { createHash } from "crypto";
import { AIResponse } from "@/types/database";

function createConversationId() {
  return `conv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseLimit(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please log in to use BioJarvis" },
        { status: 401 },
      );
    }

    const rawBody = await request.json();

    const normalizedBody = {
      ...rawBody,
      conversationHistory: Array.isArray(rawBody?.conversationHistory)
        ? rawBody.conversationHistory.slice(-8).map((msg: unknown) => {
            const typed = msg as { role?: unknown; content?: unknown };
            return {
              role: typed.role,
              content:
                typeof typed.content === "string"
                  ? typed.content.slice(0, 2000)
                  : typed.content,
            };
          })
        : rawBody?.conversationHistory,
      followUpMemory: rawBody?.followUpMemory
        ? {
            ...rawBody.followUpMemory,
            lastAssistantAnswer:
              typeof rawBody.followUpMemory?.lastAssistantAnswer === "string"
                ? rawBody.followUpMemory.lastAssistantAnswer.slice(0, 2000)
                : rawBody.followUpMemory?.lastAssistantAnswer,
          }
        : rawBody?.followUpMemory,
    };

    const parsedBody = chatRequestSchema.safeParse(normalizedBody);
    if (!parsedBody.success) {
      const message = parsedBody.error.issues.map((i) => i.message).join(", ");
      return NextResponse.json(
        {
          error: "Invalid request",
          message,
        },
        { status: 400 },
      );
    }

    const {
      question,
      conversationHistory,
      structureContext,
      followUpMemory,
      conversationId,
    } = parsedBody.data;

    const activeConversationId = conversationId || createConversationId();

    if (
      !question ||
      typeof question !== "string" ||
      question.trim().length === 0
    ) {
      return NextResponse.json(
        {
          error: "Invalid request",
          message: "Please provide a valid question",
        },
        { status: 400 },
      );
    }

    if (question.length > 1000) {
      return NextResponse.json(
        {
          error: "Question too long",
          message: "Please keep your question under 1000 characters",
        },
        { status: 400 },
      );
    }

    // Check user quota
    const { data: profileData } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .single();
    const profile = profileData as { subscription_tier?: string } | null;

    const today = new Date().toISOString().split("T")[0];
    const { data: usageData } = await supabase
      .from("usage_tracking")
      .select("query_count")
      .eq("user_id", user.id)
      .eq("date", today)
      .single();
    const usage = usageData as { query_count?: number } | null;

    const defaultFreeLimit = process.env.NODE_ENV === "production" ? 10 : 1000;
    const quotas: Record<string, number> = {
      free: parseLimit(
        process.env.BIOJARVIS_FREE_DAILY_LIMIT,
        defaultFreeLimit,
      ),
      pro: parseLimit(process.env.BIOJARVIS_PRO_DAILY_LIMIT, 1000),
      enterprise: parseLimit(
        process.env.BIOJARVIS_ENTERPRISE_DAILY_LIMIT,
        10000,
      ),
    };

    const tier = (profile?.subscription_tier || "free") as string;
    const limit = quotas[tier] || 10;
    const used = usage?.query_count || 0;

    if (used >= limit) {
      return NextResponse.json(
        {
          error: "Quota exceeded",
          message: `You've reached your daily limit of ${limit} queries. Upgrade to Pro for more.`,
          limit,
          used,
          remaining: 0,
        },
        { status: 429 },
      );
    }

    // Check cache (context-aware to prevent stale follow-up collisions)
    const conversationKeyPayload = {
      question: question.toLowerCase().trim(),
      history: (conversationHistory || []).slice(-4).map((msg) => ({
        role: msg.role,
        content: msg.content.toLowerCase().trim().slice(0, 280),
      })),
      structureContext: structureContext || followUpMemory?.structureContext,
      followUpAnswerHint: followUpMemory?.lastAssistantAnswer
        ?.toLowerCase()
        .trim()
        .slice(0, 280),
      conversationId: activeConversationId,
    };
    const queryKey = createHash("md5")
      .update(JSON.stringify(conversationKeyPayload))
      .digest("hex");
    const { data: cachedData } = await supabase
      .from("query_cache")
      .select("response, hit_count")
      .eq("query_key", queryKey)
      .gt("expires_at", new Date().toISOString())
      .single();
    const cached = cachedData as {
      response?: AIResponse;
      hit_count?: number;
    } | null;

    if (cached?.response) {
      // Skip cache if it's a stale entry without bindingSite data (pre-annotation update)
      const cachedStructure = (
        cached.response as unknown as Record<string, unknown>
      )?.structure as Record<string, unknown> | undefined;
      const isStaleCache =
        cachedStructure?.pdbId && !cachedStructure?.bindingSite;
      // Also skip cache from pre-ChEMBL-guided pipeline (v1) — may have wrong target protein
      const cachedMeta = (cached.response as unknown as Record<string, unknown>)
        ?.metadata as Record<string, unknown> | undefined;
      const toolsCalled = (cachedMeta?.toolsCalled as string[]) || [];
      const isPreChemblPipeline =
        cachedStructure?.pdbId &&
        !toolsCalled.includes("chembl_get_targets") &&
        !toolsCalled.includes("pdb_get_structure_curated");

      if (!isStaleCache && !isPreChemblPipeline) {
        // Increment cache hit count
        await supabase
          .from("query_cache")
          .update({ hit_count: (cached.hit_count || 0) + 1 } as Record<
            string,
            unknown
          >)
          .eq("query_key", queryKey);

        return NextResponse.json({
          ...cached.response,
          cached: true,
          metadata: {
            ...cached.response.metadata,
            cached: true,
          },
        });
      }
      // Stale cache — fall through to re-process with updated pipeline
      console.log(
        "[API Chat] Skipping stale cache entry (missing bindingSite or pre-ChEMBL pipeline)",
      );
    }

    // Process query with AI (Groq / LLaMA 3.3)
    // Validate and sanitize conversation history
    const sanitizedHistory: Array<{
      role: "user" | "assistant";
      content: string;
    }> = [];
    if (Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory.slice(-8)) {
        if (
          msg &&
          typeof msg.content === "string" &&
          (msg.role === "user" || msg.role === "assistant")
        ) {
          sanitizedHistory.push({
            role: msg.role,
            content: msg.content.slice(0, 2000), // Limit individual message size
          });
        }
      }
    }

    const { data: persistedHistoryData } = await supabase
      .from("query_history")
      .select("question, response, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3);

    const persistedConversation =
      (
        persistedHistoryData as Array<{
          question: string;
          response?: AIResponse;
          created_at: string;
        }> | null
      )
        ?.flatMap((entry) => {
          const turns: Array<{ role: "user" | "assistant"; content: string }> =
            [];
          if (typeof entry.question === "string" && entry.question.trim()) {
            turns.push({
              role: "user",
              content: entry.question.slice(0, 1000),
            });
          }
          if (
            typeof entry.response?.text === "string" &&
            entry.response.text.trim()
          ) {
            turns.push({
              role: "assistant",
              content: entry.response.text.slice(0, 1500),
            });
          }
          return turns;
        })
        .slice(-6) || [];

    const response = await processQueryWithGroq(
      question,
      user.id,
      structureContext,
      sanitizedHistory.length > 0 ? sanitizedHistory : undefined,
      {
        ...followUpMemory,
        persistedConversation,
      },
    );

    const responseWithConversation: AIResponse = {
      ...response,
      metadata: {
        ...response.metadata,
        conversationId: activeConversationId,
      },
    };
    const responseMeta = {
      tokensUsed: responseWithConversation.metadata?.tokensUsed || 0,
      executionTime: responseWithConversation.metadata?.executionTime || 0,
      toolsCalled: responseWithConversation.metadata?.toolsCalled || [],
      intentRoute: responseWithConversation.metadata?.intentRoute,
      structureDecision: responseWithConversation.metadata?.structureDecision,
      conversationId: responseWithConversation.metadata?.conversationId,
    };

    console.log(
      "[API Chat] Response structure:",
      responseWithConversation.structure?.pdbId || "NO STRUCTURE",
    );
    console.log(
      "[API Chat] Tools called:",
      responseWithConversation.metadata?.toolsCalled,
    );
    console.log(
      "[API Chat] Sources count:",
      responseWithConversation.sources?.length || 0,
    );
    const metadata = {
      pdbId: responseWithConversation.structure?.pdbId,
      drugName: extractDrugName(question),
      targetProtein: extractTargetProtein(responseWithConversation.text),
    };

    // Save to query history
    await supabase.from("query_history").insert({
      user_id: user.id,
      question,
      response: responseWithConversation,
      mcp_tools_used: responseMeta.toolsCalled,
      tokens_used: responseMeta.tokensUsed,
      execution_time_ms: responseMeta.executionTime,
      pdb_id: metadata.pdbId,
      drug_name: metadata.drugName,
      target_protein: metadata.targetProtein,
    } as Record<string, unknown>);

    // Update usage tracking (using upsert instead of rpc for simplicity)
    const existingUsage = await supabase
      .from("usage_tracking")
      .select("query_count, tokens_used")
      .eq("user_id", user.id)
      .eq("date", today)
      .single();

    if (existingUsage.data) {
      await supabase
        .from("usage_tracking")
        .update({
          query_count:
            ((existingUsage.data as { query_count?: number }).query_count ||
              0) + 1,
          tokens_used:
            ((existingUsage.data as { tokens_used?: number }).tokens_used ||
              0) + responseMeta.tokensUsed,
        } as Record<string, unknown>)
        .eq("user_id", user.id)
        .eq("date", today);
    } else {
      await supabase.from("usage_tracking").insert({
        user_id: user.id,
        date: today,
        query_count: 1,
        tokens_used: responseMeta.tokensUsed,
      } as Record<string, unknown>);
    }

    // Cache the response
    await supabase.from("query_cache").upsert({
      query_key: queryKey,
      response: responseWithConversation,
      hit_count: 0,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    } as Record<string, unknown>);

    return NextResponse.json(responseWithConversation);
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to process your question",
      },
      { status: 500 },
    );
  }
}

// Helper function to extract drug name from question
function extractDrugName(question: string): string | undefined {
  const drugPatterns = [
    /\b([A-Z][a-z]+(?:ilin|pirin|cillin|mycin|mab|nib|zole|pine|statin|pril|olol|sartan|dipine|prazole))\b/i,
    /\b(aspirin|ibuprofen|penicillin|insulin|metformin|acetaminophen|paracetamol|amoxicillin|lisinopril|omeprazole)\b/i,
  ];

  for (const pattern of drugPatterns) {
    const match = question.match(pattern);
    if (match) return match[1];
  }

  return undefined;
}

// Helper function to extract target protein from response
function extractTargetProtein(text: string): string | undefined {
  const proteinPatterns = [
    /\b(COX-[12]|PTGS[12])\b/i,
    /\b([A-Z]{2,}[0-9]*[A-Z]?)\b/,
  ];

  for (const pattern of proteinPatterns) {
    const match = text.match(pattern);
    if (match) return match[1].toUpperCase();
  }

  return undefined;
}
