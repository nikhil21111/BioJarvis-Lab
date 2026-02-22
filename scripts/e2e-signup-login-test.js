const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { createClient } = require("@supabase/supabase-js");

function loadEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

async function findUserByEmail(admin, email, maxAttempts = 8) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const user = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (user) return user;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return null;
}

async function isDashboard(page) {
  return /\/dashboard/.test(page.url());
}

async function hasLoginInputs(page) {
  const emailCount = await page
    .locator('input[placeholder="researcher@institution.edu"]')
    .count();
  const passwordCount = await page
    .locator('input[placeholder="••••••••••••"]')
    .count();
  return emailCount > 0 && passwordCount > 0;
}

(async () => {
  const env = {
    ...loadEnv(path.join(process.cwd(), ".env.local")),
    ...process.env,
  };
  const baseUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const nonce = Date.now();
  const email = `signup-login-${nonce}@biojarvis.local`;
  const password = `BioJ@rvis!${nonce}`;
  const fullName = `E2E User ${nonce}`;

  const result = {
    email,
    signupUi: "unknown",
    loginBeforeConfirm: "unknown",
    confirmedViaAdmin: false,
    finalLogin: false,
    notes: [],
  };

  let createdUserId = null;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);

  try {
    await page.goto(`${baseUrl}/signup`, { waitUntil: "domcontentloaded" });
    await page.locator('input[placeholder="Dr. Jane Doe"]').fill(fullName);
    await page
      .locator('input[placeholder="researcher@institution.edu"]')
      .fill(email);
    await page.locator('input[placeholder="••••••••••••"]').fill(password);
    await page.getByRole("button", { name: /Register Node/i }).click();

    await page.waitForTimeout(4000);
    const currentUrl = page.url();
    if (/\/dashboard/.test(currentUrl)) {
      result.signupUi = "auto-confirmed-session";
      result.finalLogin = true;
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    const successMsgVisible =
      (await page.locator("text=Sequence Verification Required").count()) > 0;
    result.signupUi = successMsgVisible
      ? "verification-required"
      : "signup-completed-unknown-state";

    const user = await findUserByEmail(admin, email);
    if (!user) {
      result.notes.push("User not found in Supabase after signup.");
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    createdUserId = user.id;

    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);

    if (await isDashboard(page)) {
      result.loginBeforeConfirm = "success-existing-session";
      result.finalLogin = true;
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (!(await hasLoginInputs(page))) {
      result.loginBeforeConfirm = "failed-other";
      result.notes.push(`Login form not visible at URL: ${page.url()}`);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    await page
      .locator('input[placeholder="researcher@institution.edu"]')
      .first()
      .fill(email);
    await page
      .locator('input[placeholder="••••••••••••"]')
      .first()
      .fill(password);
    await page
      .getByRole("button", { name: /Initiate Session/i })
      .first()
      .click();
    await page.waitForTimeout(3500);

    if (/\/dashboard/.test(page.url())) {
      result.loginBeforeConfirm = "success";
      result.finalLogin = true;
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    const errorText = await page.locator("body").innerText();
    if (/not confirmed|verify|confirmation link/i.test(errorText)) {
      result.loginBeforeConfirm = "blocked-unconfirmed";
    } else {
      result.loginBeforeConfirm = "failed-other";
      result.notes.push("Login did not reach dashboard before confirmation.");
    }

    const { error: confirmError } = await admin.auth.admin.updateUserById(
      user.id,
      {
        email_confirm: true,
      },
    );
    if (confirmError) {
      result.notes.push(`Admin confirm failed: ${confirmError.message}`);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    result.confirmedViaAdmin = true;

    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    if (!(await hasLoginInputs(page))) {
      if (await isDashboard(page)) {
        result.finalLogin = true;
      } else {
        result.finalLogin = false;
        result.notes.push(`Final login form not visible at URL: ${page.url()}`);
      }
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    await page
      .locator('input[placeholder="researcher@institution.edu"]')
      .first()
      .fill(email);
    await page
      .locator('input[placeholder="••••••••••••"]')
      .first()
      .fill(password);
    await page
      .getByRole("button", { name: /Initiate Session/i })
      .first()
      .click();
    await page.waitForTimeout(4500);

    result.finalLogin = /\/dashboard/.test(page.url());
    if (!result.finalLogin) {
      result.notes.push(
        "Final login after confirmation did not reach dashboard.",
      );
    }

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
    if (createdUserId) {
      await admin.auth.admin.deleteUser(createdUserId);
    }
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
