const fs = require("fs");
const path = require("path");

const BASE_URL = process.env.BIOJARVIS_BASE_URL || "http://localhost:3000";
const REPORT_PATH = path.join(process.cwd(), "tricky-chat-stress-report.json");

async function postTurns(turns) {
  const response = await fetch(`${BASE_URL}/api/test-followup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ turns: turns.map((question) => ({ question })) }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} calling /api/test-followup`);
  }

  return response.json();
}

function evaluate(test, payload) {
  const turns = payload.turns || [];
  const failures = [];

  for (const rule of test.rules) {
    const turn = turns[rule.turn - 1];
    if (!turn) {
      failures.push(`Missing turn ${rule.turn}`);
      continue;
    }

    if (rule.expectRoute && turn.intentRoute !== rule.expectRoute) {
      failures.push(
        `Turn ${rule.turn} route expected ${rule.expectRoute}, got ${turn.intentRoute}`,
      );
    }

    const hasStructure = Boolean(turn.structure && turn.structure.pdbId);

    if (rule.expectStructure === true && !hasStructure) {
      failures.push(`Turn ${rule.turn} expected structure payload, got none`);
    }

    if (rule.expectStructure === false && hasStructure) {
      failures.push(
        `Turn ${rule.turn} expected no structure payload, got ${turn.structure.pdbId}`,
      );
    }

    if (rule.expectDecisionContains) {
      const decision = String(turn.structureDecision || "").toLowerCase();
      if (!decision.includes(rule.expectDecisionContains.toLowerCase())) {
        failures.push(
          `Turn ${rule.turn} decision expected to include "${rule.expectDecisionContains}", got "${turn.structureDecision || ""}"`,
        );
      }
    }
  }

  return {
    name: test.name,
    mode: test.mode,
    status: failures.length === 0 ? "PASS" : "FAIL",
    failures,
    turns: turns.map((t) => ({
      turn: t.turn,
      question: t.question,
      intentRoute: t.intentRoute,
      structureDecision: t.structureDecision,
      pdbId: t.structure?.pdbId || null,
      toolsCalled: t.toolsCalled || [],
    })),
  };
}

async function run() {
  const tests = [
    {
      name: "same_chat_pronoun_chain",
      mode: "same-chat",
      turns: [
        "Show me EGFR structure with erlotinib",
        "now show same one again",
        "ok now explain dosing only, no structure",
      ],
      rules: [
        { turn: 1, expectRoute: "structure_required", expectStructure: true },
        { turn: 2, expectRoute: "structure_required", expectStructure: true },
        { turn: 3, expectRoute: "text_only", expectStructure: false },
      ],
    },
    {
      name: "same_chat_ambiguous_no_anchor",
      mode: "same-chat",
      turns: ["give structure of that"],
      rules: [
        {
          turn: 1,
          expectRoute: "structure_required",
          expectStructure: false,
          expectDecisionContains: "missing resolvable anchor",
        },
      ],
    },
    {
      name: "same_chat_topic_switch",
      mode: "same-chat",
      turns: [
        "Show me EGFR structure",
        "what about BRCA1 function in DNA repair?",
        "and now for previous one, show structure",
      ],
      rules: [
        { turn: 1, expectRoute: "structure_required", expectStructure: true },
        { turn: 2, expectRoute: "text_only", expectStructure: false },
        { turn: 3, expectRoute: "structure_required" },
      ],
    },
    {
      name: "different_chat_short_ambiguous",
      mode: "different-chat",
      isolatedQuestions: ["same one", "that structure please", "show it"],
      rulesPerQuestion: [
        {
          expectRoute: "text_only",
          expectStructure: false,
        },
        {
          expectRoute: "structure_required",
          expectStructure: false,
          expectDecisionContains: "missing resolvable anchor",
        },
        {
          expectRoute: "text_only",
          expectStructure: false,
        },
      ],
    },
    {
      name: "different_chat_noise_and_typo",
      mode: "different-chat",
      isolatedQuestions: [
        "yo 😂 give egfr strucutre pls",
        "dont show structure just explain mechanism of venetoclax",
      ],
      rulesPerQuestion: [
        { expectRoute: "structure_required", expectStructure: true },
        { expectRoute: "text_only", expectStructure: false },
      ],
    },
  ];

  const results = [];

  for (const test of tests) {
    if (test.mode === "same-chat") {
      try {
        const payload = await postTurns(test.turns);
        results.push(evaluate(test, payload));
      } catch (error) {
        results.push({
          name: test.name,
          mode: test.mode,
          status: "FAIL",
          failures: [error instanceof Error ? error.message : String(error)],
          turns: [],
        });
      }
      continue;
    }

    if (test.mode === "different-chat") {
      for (let index = 0; index < test.isolatedQuestions.length; index++) {
        const question = test.isolatedQuestions[index];
        const rule = test.rulesPerQuestion[index];
        const caseName = `${test.name}#${index + 1}`;

        try {
          const payload = await postTurns([question]);
          results.push(
            evaluate(
              {
                name: caseName,
                mode: test.mode,
                rules: [{ turn: 1, ...rule }],
              },
              payload,
            ),
          );
        } catch (error) {
          results.push({
            name: caseName,
            mode: test.mode,
            status: "FAIL",
            failures: [error instanceof Error ? error.message : String(error)],
            turns: [],
          });
        }
      }
    }
  }

  const summary = {
    total: results.length,
    passed: results.filter((r) => r.status === "PASS").length,
    failed: results.filter((r) => r.status === "FAIL").length,
    passRatePercent: Number(
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
    failedCases: results.filter((r) => r.status === "FAIL"),
    results,
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  for (const result of results) {
    console.log(
      `${result.status.padEnd(4)} | ${result.mode.padEnd(14)} | ${result.name}`,
    );
    if (result.status === "FAIL") {
      for (const fail of result.failures) {
        console.log(`      - ${fail}`);
      }
    }
  }

  console.log(
    `\nSummary: ${summary.passed}/${summary.total} passed (${summary.passRatePercent}%)`,
  );
  console.log(`Report: ${REPORT_PATH}`);

  if (summary.failed > 0) {
    process.exitCode = 2;
  }
}

run().catch((error) => {
  console.error(
    "Tricky stress run failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
