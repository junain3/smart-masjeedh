import { execSync } from "node:child_process";

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: "inherit", ...opts });
}

try {
  const status = execSync("git status --porcelain", { encoding: "utf8" }).trim();
  if (!status) {
    console.log("No changes to commit");
    process.exit(0);
  }
  run("git add -A");
  const msg = `sync: ${new Date().toISOString()}`;
  run(`git commit -m "${msg}"`);
  run("git push origin main");
  console.log("Pushed to origin main");
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
