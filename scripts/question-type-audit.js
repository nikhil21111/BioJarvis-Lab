const fs = require("fs");
const path = require("path");

const BASE_URL = process.env.BIOJARVIS_BASE_URL || "http://localhost:3000";
const REPORT_PATH = path.join(process.cwd(), "question-type-audit-report.json");

const cases = [
  {
    type: "drug_mechanism",
    question: "How does venetoclax work in CLL?",
    expectedRoute: "text_only",
  },
  {
    type: "protein_function",
    question: "Explain BRCA1 function in DNA repair",
    expectedRoute: "text_only",
  },
  {
    type: "structure_protein",
    question: "Show me EGFR structure with erlotinib",
    expectedRoute: "structure_required",
  },
  {
    type: "structure_pdb_direct",
    question: "Give PDB 1M17 and key binding residues",
    expectedRoute: "structure_required",
  },
  {
    type: "binding_site",
    question: "What are the binding site residues for aspirin on COX-1?",
    expectedRoute: "structure_required",
  },
  {
    type: "mutation_mapping",
    question: "Map T790M on EGFR structure",
    expectedRoute: "structure_required",
  },
  {
    type: "clinical_compare",
    question: "Compare venetoclax vs navitoclax clinically",
    expectedRoute: "text_only",
  },
  {
    type: "structure_compare",
    question: "Compare EGFR and HER2 binding pockets",
    expectedRoute: "structure_required",
  },
  {
    type: "followup_non_structure",
    turns: [
      { question: "Show me EGFR structure with erlotinib" },
      { question: "What about adverse effects and dosing?" },
    ],
    expectedLastRoute: "text_only",
  },
  {
    type: "followup_structure",
    turns: [
      { question: "Show me EGFR structure with erlotinib" },
      { question: "Tell me more about its binding site" },
    ],
    expectedLastRoute: "structure_required",
  },
  {
    type: "ambiguous_followup",
    question: "give structure of that",
    expectedRoute: "structure_required",
    expectedDecisionContains: "missing resolvable anchor",
  },
  {
    type: "casual_chat",
    question: "hey can you simplify that in one line?",
    expectedRoute: "text_only",
  },
  {
    type: "typo_heavy_structure",
    question: "plz show strucutre of egfr and bindng site residues",
    expectedRoute: "structure_required",
  },
  {
    type: "mixed_language_structure",
    question: "EGFR ka structure dikhao with erlotinib",
    expectedRoute: "structure_required",
  },
  {
    type: "short_followup_structure",
    turns: [
      { question: "Show me EGFR structure with erlotinib" },
      { question: "show same one now" },
    ],
    expectedLastRoute: "structure_required",
  },
  {
    type: "negated_structure_request",
    question: "don't show structure, just explain mechanism",
    expectedRoute: "text_only",
  },
  {
    type: "noisy_slang_structure",
    question: "yo 😂 give me egfr structure pls",
    expectedRoute: "structure_required",
  },
];

async function postTurns(turns) {
  const response = await fetch(`${BASE_URL}/api/test-followup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ turns }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} calling /api/test-followup`);
  }

  return response.json();
}

async function run() {
  const results = [];

  for (const testCase of cases) {
    try {
      const turns = testCase.turns || [{ question: testCase.question }];
      const payload = await postTurns(turns);
      const turnResults = payload.turns || [];
      const last = turnResults[turnResults.length - 1];

      const expected = testCase.expectedLastRoute || testCase.expectedRoute;
      const actual = last?.intentRoute || "unknown";
      const decision = String(last?.structureDecision || "");
      const pdb = last?.structure?.pdbId || "-";

      let pass = actual === expected;
      if (pass && testCase.expectedDecisionContains) {
        pass = decision
          .toLowerCase()
          .includes(testCase.expectedDecisionContains.toLowerCase());
      }

      results.push({
        type: testCase.type,
        expected,
        actual,
        pdb,
        decision,
        status: pass ? "PASS" : "FAIL",
      });
    } catch (error) {
      results.push({
        type: testCase.type,
        expected: testCase.expectedLastRoute || testCase.expectedRoute,
        actual: "ERROR",
        pdb: "-",
        decision: error instanceof Error ? error.message : String(error),
        status: "FAIL",
      });
    }
  }

  const summary = {
    total: results.length,
    pass: results.filter((r) => r.status === "PASS").length,
    fail: results.filter((r) => r.status === "FAIL").length,
    accuracyPercent: Number(
      (
        (results.filter((r) => r.status === "PASS").length / results.length) *
        100
      ).toFixed(2),
    ),
  };

  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    summary,
    failed: results.filter((r) => r.status === "FAIL"),
    results,
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  for (const row of results) {
    console.log(
      `${row.status.padEnd(4)} | ${row.type.padEnd(26)} | expected=${row.expected.padEnd(18)} | actual=${row.actual.padEnd(18)} | pdb=${row.pdb}`,
    );
  }
  console.log(
    `\nSummary: ${summary.pass}/${summary.total} passed (${summary.accuracyPercent}%)`,
  );

  if (summary.fail > 0) {
    process.exitCode = 2;
  }
}

run().catch((error) => {
  console.error(
    "Question-type audit failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
