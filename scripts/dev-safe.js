const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const lockPath = path.join(projectRoot, ".next", "dev", "lock");

function isProcessRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function parsePid(content) {
  if (!content) return null;
  const match = String(content).match(/\d+/);
  if (!match) return null;
  const pid = Number.parseInt(match[0], 10);
  return Number.isNaN(pid) ? null : pid;
}

if (fs.existsSync(lockPath)) {
  let lockContent = "";
  try {
    lockContent = fs.readFileSync(lockPath, "utf8");
  } catch {
    lockContent = "";
  }

  const pid = parsePid(lockContent);
  if (pid && isProcessRunning(pid)) {
    console.error(`\nA Next.js dev server is already running (pid ${pid}).`);
    console.error("Stop the existing process before starting a new one.\n");
    process.exit(1);
  }

  try {
    fs.rmSync(lockPath, { force: true });
    console.log(`Removed stale lock: ${lockPath}`);
  } catch (error) {
    console.error(`Failed to remove lock file: ${lockPath}`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

const devCommand = process.platform === "win32" ? "npx next dev" : "next dev";

try {
  execSync(devCommand, {
    stdio: "inherit",
    env: process.env,
    cwd: projectRoot,
  });
} catch (error) {
  process.exit(error && typeof error.status === "number" ? error.status : 1);
}
