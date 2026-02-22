const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { createClient } = require("@supabase/supabase-js");

function loadEnv(filePath) {
  const env = {};
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    env[key] = value;
  }
  return env;
}

(async () => {
  const root = process.cwd();
  const envPath = path.join(root, ".env.local");
  const env = loadEnv(envPath);

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase URL or service role key in .env.local");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const nonce = Date.now();
  const email = `e2e-viewer-${nonce}@biojarvis.local`;
  const password = `BioJ@rvis!${nonce}`;

  const createRes = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createRes.error || !createRes.data?.user) {
    throw new Error(`Failed to create test user: ${createRes.error?.message}`);
  }

  const userId = createRes.data.user.id;

  const result = {
    login: false,
    turn1: { sent: false, structureVisible: false },
    turn2: { sent: false, extraStructureGenerated: null },
    controls: {
      hBonds: false,
      saltBridges: false,
      bFactor: false,
      hydrophobic: false,
    },
    notes: [],
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);

  try {
    await page.goto("http://localhost:3000/login", {
      waitUntil: "domcontentloaded",
    });

    await page
      .locator('input[placeholder="researcher@institution.edu"]')
      .fill(email);
    await page.locator('input[placeholder="••••••••••••"]').fill(password);
    await page.getByRole("button", { name: /Initiate Session/i }).click();

    await page.waitForURL(/\/dashboard/);
    result.login = true;

    const input = page
      .getByPlaceholder("Ask about proteins, drugs, or molecular structures...")
      .first();

    const sendButton = page
      .locator('button[aria-label="Send message"]:not([disabled])')
      .first();

    await input.fill("Show me EGFR structure with erlotinib binding site");
    await sendButton.click();
    result.turn1.sent = true;

    await page.waitForTimeout(22000);

    const structureCardsAfterTurn1 = await page
      .locator("[id^='structure-card-']")
      .count();
    const viewerHeaderCount = await page.locator("text=3D Structures").count();
    result.turn1.structureVisible =
      structureCardsAfterTurn1 >= 1 && viewerHeaderCount > 0;

    if (!result.turn1.structureVisible) {
      result.notes.push(
        "No structure card visible after turn 1; controls cannot be fully validated.",
      );
    }

    await input.fill("What are adverse effects and dosing considerations?");
    await sendButton.click();
    result.turn2.sent = true;

    await page.waitForTimeout(12000);

    const structureCardsAfterTurn2 = await page
      .locator("[id^='structure-card-']")
      .count();
    result.turn2.extraStructureGenerated =
      structureCardsAfterTurn2 > structureCardsAfterTurn1;

    const hbButton = page.locator('button[title="Drug-Protein H-Bonds"]');
    if ((await hbButton.count()) > 0) {
      await hbButton.first().click();
      await page.waitForTimeout(700);
      result.controls.hBonds =
        (await page.locator('button[title="Hide Drug H-Bonds"]').count()) > 0;
    }

    const saltButton = page.locator('button[title="Salt Bridges"]');
    if ((await saltButton.count()) > 0) {
      await saltButton.first().click();
      await page.waitForTimeout(700);
      result.controls.saltBridges =
        (await page.locator('button[title="Hide Salt Bridges"]').count()) > 0;
    }

    const bFactorButton = page.locator('button[title="B-Factor Coloring"]');
    if ((await bFactorButton.count()) > 0) {
      await bFactorButton.first().click();
      await page.waitForTimeout(700);
      result.controls.bFactor =
        (await page.locator('button[title="Hide B-Factor"]').count()) > 0;
    }

    const hydroButton = page.locator('button[title="Hydrophobic Contacts"]');
    if ((await hydroButton.count()) > 0) {
      await hydroButton.first().click();
      await page.waitForTimeout(700);
      result.controls.hydrophobic =
        (await page.locator('button[title="Hide Hydrophobic"]').count()) > 0;
    }

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
    await admin.auth.admin.deleteUser(userId);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
