const { spawnSync } = require("node:child_process");
const net = require("node:net");

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new Error(detail || `${command} exited with status ${result.status}.`);
  }
  return result.stdout;
}

function parseNetstatListeners(output, port) {
  const pids = new Set();
  for (const line of output.split(/\r?\n/)) {
    const columns = line.trim().split(/\s+/);
    if (columns.length < 5 || columns[0] !== "TCP" || columns[3] !== "LISTENING") {
      continue;
    }
    const localAddress = columns[1];
    const localPort = Number(localAddress.slice(localAddress.lastIndexOf(":") + 1));
    const pid = Number(columns[4]);
    if (localPort === port && Number.isInteger(pid) && pid > 0) pids.add(pid);
  }
  return [...pids];
}

function getListenerPids(port, platform = process.platform) {
  if (platform === "win32") {
    return parseNetstatListeners(runCommand("netstat", ["-ano", "-p", "tcp"]), port);
  }

  const output = runCommand("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]);
  return [...new Set(output.split(/\s+/).map(Number).filter((pid) => pid > 0))];
}

function terminateProcess(pid, platform = process.platform) {
  if (platform === "win32") {
    runCommand("taskkill", ["/PID", String(pid), "/T", "/F"]);
    return;
  }
  process.kill(pid, "SIGTERM");
}

function isPortAvailable(port, host) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        resolve(false);
        return;
      }
      reject(error);
    });
    probe.listen(port, host, () => {
      probe.close(() => resolve(true));
    });
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForPortRelease(port, host, portAvailable) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (await portAvailable(port, host)) return;
    await delay(100);
  }
  throw new Error(`Port ${port} is still occupied after stopping its listener.`);
}

async function findAvailablePort(startPort, host, portAvailable = isPortAvailable) {
  for (let port = startPort; port <= 65535; port += 1) {
    if (await portAvailable(port, host)) return port;
  }
  throw new Error(`No free TCP port found from ${startPort} through 65535.`);
}

async function prepareStreambertPort({
  port = 3001,
  host = "127.0.0.1",
  platform = process.platform,
  listPids = getListenerPids,
  killPid = terminateProcess,
  portAvailable = isPortAvailable,
} = {}) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid Streambert port: ${port}.`);
  }

  const killedPids = listPids(port, platform);
  for (const pid of killedPids) killPid(pid, platform);

  if (killedPids.length > 0) {
    await waitForPortRelease(port, host, portAvailable);
    return {
      killedPids,
      port: await findAvailablePort(port + 1, host, portAvailable),
    };
  }

  return {
    killedPids,
    port: await findAvailablePort(port, host, portAvailable),
  };
}

module.exports = {
  findAvailablePort,
  getListenerPids,
  isPortAvailable,
  parseNetstatListeners,
  prepareStreambertPort,
};
