const fs = require("fs");
const path = require("path");

const reportPath =
  process.env.BIOJARVIS_BENCHMARK_REPORT ||
  path.join(process.cwd(), "accuracy-benchmark-report.json");
const baselinePath =
  process.env.BIOJARVIS_BENCHMARK_BASELINE ||
  path.join(process.cwd(), "accuracy-benchmark-baseline.json");

const maxAccuracyDrop = Number(
  process.env.BIOJARVIS_MAX_ACCURACY_DROP_PERCENT || "2",
);
const maxFailedDelta = Number(process.env.BIOJARVIS_MAX_FAILED_DELTA || "0");
const minAbsoluteAccuracy = Number(
  process.env.BIOJARVIS_MIN_ABSOLUTE_ACCURACY_PERCENT || "95",
);

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getSummary(report, label) {
  const summary = report?.summary;
  if (!summary || typeof summary !== "object") {
    throw new Error(`Invalid ${label}: missing summary object`);
  }
  const accuracy = Number(summary.accuracyPercent);
  const failed = Number(summary.failed);
  if (Number.isNaN(accuracy) || Number.isNaN(failed)) {
    throw new Error(`Invalid ${label}: summary accuracy/failed not numeric`);
  }
  return { accuracy, failed };
}

function run() {
  const report = readJson(reportPath);
  const baseline = readJson(baselinePath);

  const current = getSummary(report, "report");
  const previous = getSummary(baseline, "baseline");

  const accuracyDrop = previous.accuracy - current.accuracy;
  const failedDelta = current.failed - previous.failed;

  const checks = [
    {
      ok: accuracyDrop <= maxAccuracyDrop,
      detail: `Accuracy drop ${accuracyDrop.toFixed(2)}% (max allowed ${maxAccuracyDrop.toFixed(2)}%)`,
    },
    {
      ok: failedDelta <= maxFailedDelta,
      detail: `Failed-check delta ${failedDelta} (max allowed ${maxFailedDelta})`,
    },
    {
      ok: current.accuracy >= minAbsoluteAccuracy,
      detail: `Absolute accuracy ${current.accuracy.toFixed(2)}% (minimum ${minAbsoluteAccuracy.toFixed(2)}%)`,
    },
  ];

  const output = {
    timestamp: new Date().toISOString(),
    files: {
      reportPath,
      baselinePath,
    },
    thresholdConfig: {
      maxAccuracyDrop,
      maxFailedDelta,
      minAbsoluteAccuracy,
    },
    baseline: previous,
    current,
    deltas: {
      accuracyDrop: Number(accuracyDrop.toFixed(2)),
      failedDelta,
    },
    checks,
  };

  console.log(JSON.stringify(output, null, 2));

  const failedChecks = checks.filter((item) => !item.ok);
  if (failedChecks.length > 0) {
    process.exitCode = 2;
  }
}

try {
  run();
} catch (error) {
  console.error(
    "Drift check failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
}
