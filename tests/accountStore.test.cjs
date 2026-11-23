const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createAccountStore } = require('../server/accountStore.cjs');
const { createStreambertServer } = require('../server/streambert-server.cjs');

async function jsonRequest(base, route, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${base}${route}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { response, payload: await response.json() };
}

test('accounts, progress, sessions, and isolated episode forums persist through the API', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mirrorflix-accounts-'));
  const filePath = path.join(directory, 'accounts.json');
  const store = createAccountStore({ filePath });
  const scraper = {};
  const aniwave = {};
  const server = createStreambertServer(scraper, {}, aniwave, store);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/streambert`;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const registration = await jsonRequest(base, '/auth/register', {
    method: 'POST', body: { username: 'Anime Fan', password: 'correct horse battery' },
  });
  assert.equal(registration.response.status, 201);
  const token = registration.payload.token;
  assert.equal(registration.payload.user.username, 'Anime Fan');

  const duplicate = await jsonRequest(base, '/auth/register', {
    method: 'POST', body: { username: 'anime fan', password: 'another password' },
  });
  assert.equal(duplicate.response.status, 409);

  const partial = await jsonRequest(base, '/progress', {
    method: 'PUT', token,
    body: { movieId: '42', episodeId: '1', title: 'Test Anime', genres: ['Action'], position: 300, duration: 1200 },
  });
  assert.equal(partial.response.status, 200);
  assert.equal(partial.payload.progress['42'].episodes['1'].completed, false);

  const completed = await jsonRequest(base, '/progress', {
    method: 'PUT', token,
    body: { movieId: '42', episodeId: '1', title: 'Test Anime', genres: ['Action'], position: 1120, duration: 1200 },
  });
  assert.equal(completed.payload.progress['42'].episodes['1'].completed, true);

  for (const [episodeId, body] of [[null, 'General thread'], ['1', 'First episode'], ['2', 'Second episode']]) {
    const posted = await jsonRequest(base, '/forum', { method: 'POST', token, body: { movieId: '42', episodeId, body } });
    assert.equal(posted.response.status, 201);
  }
  const episodeOne = await jsonRequest(base, '/forum?movieId=42&episodeId=1');
  const episodeTwo = await jsonRequest(base, '/forum?movieId=42&episodeId=2');
  const general = await jsonRequest(base, '/forum?movieId=42');
  assert.deepEqual(episodeOne.payload.posts.map((post) => post.body), ['First episode']);
  assert.deepEqual(episodeTwo.payload.posts.map((post) => post.body), ['Second episode']);
  assert.deepEqual(general.payload.posts.map((post) => post.body), ['General thread']);

  const unauthenticated = await jsonRequest(base, '/progress', { method: 'PUT', body: {} });
  assert.equal(unauthenticated.response.status, 401);
  const restored = createAccountStore({ filePath });
  const restoredUser = restored.authenticate(token);
  assert.equal(restoredUser.progress['42'].episodes['1'].position, 1120);
  assert.equal(restored.getForum('42', '1').length, 1);

  const disk = fs.readFileSync(filePath, 'utf8');
  assert.equal(disk.includes('correct horse battery'), false);
  assert.equal(disk.includes(token), false);
  const login = await jsonRequest(base, '/auth/login', { method: 'POST', body: { username: 'ANIME FAN', password: 'correct horse battery' } });
  assert.equal(login.response.status, 200);
  assert.equal(login.payload.progress['42'].episodes['1'].completed, true);
});

test('short videos are not completed at timestamp zero and multiline posts are preserved', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mirrorflix-store-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = createAccountStore({ filePath: path.join(directory, 'accounts.json') });
  const account = await store.register({ username: 'reader', password: 'long enough' });
  const user = store.authenticate(account.token);
  await store.saveProgress(user, { movieId: 'short', episodeId: '1', title: 'Short', position: 0, duration: 30 });
  assert.equal(user.progress.short.episodes['1'].completed, false);
  await store.addPost(user, { movieId: 'short', episodeId: '1', body: 'First line\nSecond line' });
  assert.equal(store.getForum('short', '1')[0].body, 'First line\nSecond line');
});
