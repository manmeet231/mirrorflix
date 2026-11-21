const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseNetstatListeners,
  prepareStreambertPort,
} = require('../server/devPorts.cjs');

test('netstat parsing returns only listeners on the requested port', () => {
  const output = `
  TCP    127.0.0.1:3001    0.0.0.0:0    LISTENING    412
  TCP    127.0.0.1:3001    0.0.0.0:0    ESTABLISHED  999
  TCP    127.0.0.1:3002    0.0.0.0:0    LISTENING    788
  TCP    [::1]:3001        [::]:0        LISTENING    412
`;
  assert.deepEqual(parseNetstatListeners(output, 3001), [412]);
});

test('an occupied default port is stopped and replaced with the next free port', async () => {
  const killed = [];
  const result = await prepareStreambertPort({
    port: 3001,
    listPids: () => [412],
    killPid: (pid) => killed.push(pid),
    portAvailable: async (port) => port === 3001 || port === 3002,
  });

  assert.deepEqual(killed, [412]);
  assert.deepEqual(result, { killedPids: [412], port: 3002 });
});

test('a free requested port is retained without stopping a process', async () => {
  let killCalled = false;
  const result = await prepareStreambertPort({
    port: 3001,
    listPids: () => [],
    killPid: () => { killCalled = true; },
    portAvailable: async () => true,
  });

  assert.equal(killCalled, false);
  assert.deepEqual(result, { killedPids: [], port: 3001 });
});

test('fallback selection skips other occupied ports without killing their owners', async () => {
  const listedPorts = [];
  const result = await prepareStreambertPort({
    port: 3001,
    listPids: (port) => {
      listedPorts.push(port);
      return [412];
    },
    killPid: () => {},
    portAvailable: async (port) => port !== 3002,
  });

  assert.deepEqual(listedPorts, [3001]);
  assert.equal(result.port, 3003);
});
