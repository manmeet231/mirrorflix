const { spawn } = require("node:child_process");
const path = require("node:path");
const { prepareStreambertPort } = require("./devPorts.cjs");

const root = path.resolve(__dirname, "..");
const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 150).unref();
}

function startChild(script, env) {
  const child = spawn(process.execPath, [script], {
    cwd: root,
    env,
    stdio: "inherit",
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(`[dev] ${error.message}`);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) stop(code || 0);
  });
}

async function main() {
  const host = process.env.STREAMBERT_HOST || "127.0.0.1";
  const requestedPort = Number(process.env.STREAMBERT_PORT || 3001);
  const { killedPids, port } = await prepareStreambertPort({
    host,
    port: requestedPort,
  });

  if (killedPids.length > 0) {
    console.log(
      `[dev] Stopped process(es) ${killedPids.join(", ")} on Streambert port ${requestedPort}.`,
    );
  }
  if (port !== requestedPort) {
    console.log(`[dev] Streambert using fallback port ${port}.`);
  }

  const originHost = host.includes(":") ? `[${host}]` : host;
  const env = {
    ...process.env,
    STREAMBERT_HOST: host,
    STREAMBERT_PORT: String(port),
    STREAMBERT_ORIGIN: `http://${originHost}:${port}`,
  };

  startChild("server/streambert-server.cjs", env);
  startChild("node_modules/vite/bin/vite.js", env);
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

main().catch((error) => {
  console.error(`[dev] Unable to start services: ${error.message}`);
  process.exitCode = 1;
});
