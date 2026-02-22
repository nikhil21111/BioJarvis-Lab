const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function parseArgs(argv) {
  const args = {
    apply: false,
    maxGapMinutes: 20,
    maxTurnsPerConversation: 12,
    backupDir: "backups",
  };

  for (const token of argv.slice(2)) {
    if (token === "--apply") args.apply = true;
    if (token.startsWith("--max-gap-minutes=")) {
      const value = Number(token.split("=")[1]);
      if (!Number.isNaN(value) && value > 0) args.maxGapMinutes = value;
    }
    if (token.startsWith("--max-turns=")) {
      const value = Number(token.split("=")[1]);
      if (!Number.isNaN(value) && value > 0) args.maxTurnsPerConversation = value;
    }
    if (token.startsWith("--backup-dir=")) {
      const value = token.split("=")[1];
      if (value) args.backupDir = value;
    }
  }

  return args;
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    env[key] = value;
  }
  return env;
}

function createConversationId(timestamp, userId) {
  const t = new Date(timestamp).getTime().toString(36);
  const u = (userId || "user").slice(0, 8);
  const rand = Math.random().toString(36).slice(2, 7);
  return `conv_${u}_${t}_${rand}`;
}

function getConversationIdFromResponse(response) {
  if (!response || typeof response !== "object") return null;
  const metadata = response.metadata;
  if (!metadata || typeof metadata !== "object") return null;
  const conversationId = metadata.conversationId;
  return typeof conversationId === "string" ? conversationId : null;
}

function ensureResponseObject(response) {
  if (response && typeof response === "object") return { ...response };
  return { text: "", metadata: {} };
}

function ensureMetadataObject(metadata) {
  if (metadata && typeof metadata === "object") return { ...metadata };
  return {};
}

async function run() {
  const args = parseArgs(process.argv);
  const env = {
    ...readEnvFile(path.join(process.cwd(), ".env.local")),
    ...process.env,
  };

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("query_history")
    .select("id, user_id, created_at, response")
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to load query_history: ${error.message}`);

  const rows = data || [];
  const byUser = new Map();
  for (const row of rows) {
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
    byUser.get(row.user_id).push(row);
  }

  const updates = [];
  const backupRows = [];
  const maxGapMs = args.maxGapMinutes * 60 * 1000;

  for (const [userId, userRows] of byUser.entries()) {
    userRows.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    let activeConversationId = null;
    let activeLastTime = 0;
    let activeTurnCount = 0;

    for (const row of userRows) {
      const createdAt = new Date(row.created_at).getTime();
      const existingConversationId = getConversationIdFromResponse(row.response);

      if (existingConversationId) {
        activeConversationId = existingConversationId;
        activeLastTime = createdAt;
        activeTurnCount = 1;
        continue;
      }

      const withinGap = activeConversationId && createdAt - activeLastTime <= maxGapMs;
      const hasTurnCapacity = activeTurnCount < args.maxTurnsPerConversation;

      if (!withinGap || !hasTurnCapacity) {
        activeConversationId = createConversationId(row.created_at, userId);
        activeTurnCount = 0;
      }

      const response = ensureResponseObject(row.response);
      const metadata = ensureMetadataObject(response.metadata);
      const patchedResponse = {
        ...response,
        metadata: {
          ...metadata,
          conversationId: activeConversationId,
        },
      };

      updates.push({ id: row.id, response: patchedResponse });
      backupRows.push({ id: row.id, user_id: row.user_id, created_at: row.created_at, response: row.response });

      activeLastTime = createdAt;
      activeTurnCount += 1;
    }
  }

  const summary = {
    mode: args.apply ? "apply" : "dry-run",
    totalRows: rows.length,
    updatesPlanned: updates.length,
    usersAffected: new Set(updates.map((u) => rows.find((r) => r.id === u.id)?.user_id)).size,
    maxGapMinutes: args.maxGapMinutes,
    maxTurnsPerConversation: args.maxTurnsPerConversation,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!args.apply) {
    return;
  }

  if (updates.length === 0) {
    console.log("No records to update.");
    return;
  }

  const backupDir = path.join(process.cwd(), args.backupDir);
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(
    backupDir,
    `query_history_conversation_backfill_${Date.now()}.json`,
  );
  fs.writeFileSync(backupPath, JSON.stringify(backupRows, null, 2));
  console.log(`Backup written: ${backupPath}`);

  let applied = 0;
  for (const update of updates) {
    const { error: updateError } = await supabase
      .from("query_history")
      .update({ response: update.response })
      .eq("id", update.id);

    if (updateError) {
      if (String(updateError.message || "").includes("has no field \"updated_at\"")) {
        throw new Error(
          "Schema mismatch: query_history update trigger expects updated_at column. Apply migration supabase/migrations/20260219_fix_history_updated_at_columns.sql, then rerun this script.",
        );
      }
      throw new Error(`Failed updating ${update.id}: ${updateError.message}`);
    }
    applied += 1;
  }

  console.log(`Applied updates: ${applied}`);
}

run().catch((error) => {
  console.error("Backfill failed:", error.message || error);
  process.exit(1);
});
