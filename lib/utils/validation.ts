import { z } from "zod";

export const conversationMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(2000),
});

// Schema for structure context (for follow-up questions)
export const structureContextSchema = z
  .object({
    pdbId: z.string().optional(),
    ligand: z.string().optional(),
    title: z.string().optional(),
    bindingSiteResidues: z.array(z.string()).optional(),
  })
  .optional();

export const followUpMemorySchema = z
  .object({
    structureContext: structureContextSchema,
    lastAssistantAnswer: z.string().max(2000).optional(),
    selectedStructureIndex: z.number().int().min(0).optional(),
  })
  .optional();

// Schema for chat API request
export const chatRequestSchema = z.object({
  question: z
    .string()
    .min(1, "Question cannot be empty")
    .max(1000, "Question must be under 1000 characters")
    .trim(),
  conversationHistory: z.array(conversationMessageSchema).max(8).optional(),
  structureContext: structureContextSchema,
  followUpMemory: followUpMemorySchema,
  conversationId: z.string().min(3).max(120).optional(),
});

// Schema for history API request params
export const historyQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  search: z.string().max(100).optional(),
});

// Schema for favorites POST request
export const addFavoriteSchema = z.object({
  queryId: z.string().uuid("Invalid query ID"),
  notes: z.string().max(500).optional(),
});

// Schema for favorites DELETE/history DELETE request
export const deleteItemSchema = z.object({
  id: z.string().uuid("Invalid ID"),
});

// Schema for delete favorite by query ID
export const deleteFavoriteSchema = z
  .object({
    id: z.string().uuid("Invalid favorite ID").optional(),
    queryId: z.string().uuid("Invalid query ID").optional(),
  })
  .refine((data) => !!data.id || !!data.queryId, {
    message: "Either id or queryId is required",
  });

// Helper function to validate request body
export async function validateRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>,
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      const errors = result.error.issues.map((e) => e.message).join(", ");
      return { success: false, error: errors };
    }

    return { success: true, data: result.data };
  } catch {
    return { success: false, error: "Invalid JSON body" };
  }
}

// Helper function to validate URL search params
export function validateQueryParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>,
): { success: true; data: T } | { success: false; error: string } {
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const result = schema.safeParse(params);

  if (!result.success) {
    const errors = result.error.issues.map((e) => e.message).join(", ");
    return { success: false, error: errors };
  }

  return { success: true, data: result.data };
}

// Sanitize string for SQL LIKE queries
export function sanitizeForLike(input: string): string {
  // Escape special characters used in LIKE patterns
  return input
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/'/g, "''");
}
