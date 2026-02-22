const fs = require("fs");
const path = require("path");

const BASE_URL = process.env.BIOJARVIS_BASE_URL || "http://localhost:3000";
const MIN_INTERVAL_MS = 1200;
let lastRequestAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postFollowup(turns) {
  const now = Date.now();
  const waitMs = MIN_INTERVAL_MS - (now - lastRequestAt);
  if (waitMs > 0) {
    await sleep(waitMs);
  }

  const response = await fetch(`${BASE_URL}/api/test-followup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ turns: turns.map((question) => ({ question })) }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} calling /api/test-followup`);
  }

  lastRequestAt = Date.now();

  return response.json();
}

async function postFollowupWithRetry(turns, shouldRetry) {
  const first = await postFollowup(turns);
  if (!shouldRetry(first)) return first;
  await sleep(1500);
  return postFollowup(turns);
}

function pass(condition, detail) {
  return { pass: Boolean(condition), detail };
}

async function run() {
  const checks = [];

  // 1) Text-only general mechanism question
  {
    const r = await postFollowup([
      "How does erlotinib work in non-small cell lung cancer?",
    ]);
    const t1 = r.turns[0];
    checks.push(
      pass(
        t1.intentRoute === "text_only",
        `Case1 route expected text_only, got ${t1.intentRoute}`,
      ),
    );
    checks.push(
      pass(
        t1.structure === null,
        `Case1 structure expected null, got ${t1.structure ? t1.structure.pdbId : "null"}`,
      ),
    );
  }

  // 2) Explicit structure intent should generate structure
  {
    const r = await postFollowupWithRetry(
      ["Show me EGFR structure with erlotinib binding site"],
      (res) => {
        const t = res?.turns?.[0];
        return (t?.structure?.bindingSiteResidues || 0) === 0;
      },
    );
    const t1 = r.turns[0];
    checks.push(
      pass(
        t1.intentRoute === "structure_required",
        `Case2 route expected structure_required, got ${t1.intentRoute}`,
      ),
    );
    checks.push(
      pass(
        !!t1.structure?.pdbId,
        `Case2 expected structure pdbId, got ${t1.structure?.pdbId || "none"}`,
      ),
    );
    checks.push(
      pass(
        (t1.structure?.bindingSiteResidues || 0) > 0,
        `Case2 expected bindingSiteResidues > 0, got ${t1.structure?.bindingSiteResidues || 0}`,
      ),
    );
  }

  // 3) Same-chat follow-up non-structure question should remain text_only
  {
    const r = await postFollowup([
      "Show me EGFR structure with erlotinib binding site",
      "What about adverse effects and dosing?",
    ]);
    const t2 = r.turns[1];
    checks.push(
      pass(
        t2.intentRoute === "text_only",
        `Case3 follow-up route expected text_only, got ${t2.intentRoute}`,
      ),
    );
    checks.push(
      pass(
        t2.structure === null,
        `Case3 follow-up expected no structure, got ${t2.structure ? t2.structure.pdbId : "null"}`,
      ),
    );
  }

  // 4) Same-chat follow-up structure question should use structure context
  {
    const r = await postFollowup([
      "Show me EGFR structure with erlotinib binding site",
      "Tell me more about its binding site and key residues",
    ]);
    const t2 = r.turns[1];
    checks.push(
      pass(
        t2.intentRoute === "structure_required",
        `Case4 follow-up route expected structure_required, got ${t2.intentRoute}`,
      ),
    );
    checks.push(
      pass(
        !!t2.structure?.pdbId,
        `Case4 follow-up expected structure, got ${t2.structure ? t2.structure.pdbId : "none"}`,
      ),
    );
  }

  // 5) Mutation evidence should remain strict (UniProt validated)
  {
    const r = await postFollowupWithRetry(
      ["Map T790M on EGFR structure and list clinically relevant mutations"],
      (res) => {
        const t = res?.turns?.[0];
        return (
          (t?.structure?.mutationCount || 0) === 0 ||
          t?.structure?.mutationEvidence !==
            "UniProt reviewed variant annotations"
        );
      },
    );
    const t1 = r.turns[0];
    checks.push(
      pass(
        (t1.structure?.mutationCount || 0) > 0,
        `Case5 expected mutationCount > 0, got ${t1.structure?.mutationCount || 0}`,
      ),
    );
    checks.push(
      pass(
        t1.structure?.mutationEvidence ===
          "UniProt reviewed variant annotations",
        `Case5 expected UniProt mutation evidence, got ${t1.structure?.mutationEvidence || "none"}`,
      ),
    );
  }

  // 6) BRCA1 functional question should stay text-only
  {
    const r = await postFollowup(["Explain BRCA1 function in DNA repair"]);
    const t1 = r.turns[0];
    checks.push(
      pass(
        t1.intentRoute === "text_only",
        `Case6 route expected text_only, got ${t1.intentRoute}`,
      ),
    );
    checks.push(
      pass(
        t1.structure === null,
        `Case6 expected no structure, got ${t1.structure ? t1.structure.pdbId : "null"}`,
      ),
    );
  }

  // 7) Viewer interaction controls from authenticated E2E output (if present)
  {
    const outputPath = path.join(process.cwd(), "e2e-auth-viewer-output.txt");
    if (fs.existsSync(outputPath)) {
      const parsed = JSON.parse(fs.readFileSync(outputPath, "utf8"));
      checks.push(
        pass(
          parsed?.controls?.hBonds === true,
          `Case7 expected hBonds control true, got ${parsed?.controls?.hBonds}`,
        ),
      );
      checks.push(
        pass(
          parsed?.controls?.saltBridges === true,
          `Case7 expected saltBridges control true, got ${parsed?.controls?.saltBridges}`,
        ),
      );
      checks.push(
        pass(
          parsed?.controls?.bFactor === true,
          `Case7 expected bFactor control true, got ${parsed?.controls?.bFactor}`,
        ),
      );
      checks.push(
        pass(
          parsed?.controls?.hydrophobic === true,
          `Case7 expected hydrophobic control true, got ${parsed?.controls?.hydrophobic}`,
        ),
      );
    } else {
      checks.push(
        pass(false, "Case7 skipped: e2e-auth-viewer-output.txt not found"),
      );
    }
  }

  const total = checks.length;
  const passed = checks.filter((c) => c.pass).length;
  const failed = total - passed;
  const accuracy = total > 0 ? (passed / total) * 100 : 0;

  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    summary: {
      totalChecks: total,
      passed,
      failed,
      accuracyPercent: Number(accuracy.toFixed(2)),
    },
    failedChecks: checks.filter((c) => !c.pass).map((c) => c.detail),
  };

  const reportPath = path.join(process.cwd(), "accuracy-benchmark-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(JSON.stringify(report, null, 2));

  if (failed > 0) {
    process.exitCode = 2;
  }
}

run().catch((error) => {
  console.error("Benchmark run failed:", error);
  process.exit(1);
});
