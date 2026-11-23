const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_POST_LENGTH = 2000;

function publicUser(user) {
  return { id: user.id, username: user.username, createdAt: user.createdAt };
}

function cleanText(value, maximum, label, allowNewlines = false) {
  const text = String(value ?? "").trim();
  const invalidControls = allowNewlines ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/;
  if (!text || text.length > maximum || invalidControls.test(text)) {
    const error = new Error(`${label} is required and must be at most ${maximum} characters.`);
    error.status = 400;
    throw error;
  }
  return text;
}

function normalizeUsername(value) {
  const username = cleanText(value, 24, "Username");
  if (username.length < 3 || !/^[A-Za-z0-9_]+(?: [A-Za-z0-9_]+)*$/.test(username)) {
    const error = new Error("Username must be 3–24 characters using letters, numbers, underscores, and single spaces.");
    error.status = 400;
    throw error;
  }
  return username;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function hashPassword(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (error, key) => {
      if (error) reject(error);
      else resolve(key.toString("hex"));
    });
  });
}

function createAccountStore({
  filePath = path.resolve(__dirname, "..", "data", "accounts.json"),
  now = () => Date.now(),
} = {}) {
  let data = { version: 1, users: [], sessions: {}, posts: [] };
  if (fs.existsSync(filePath)) {
    const saved = JSON.parse(fs.readFileSync(filePath, "utf8"));
    data = {
      version: 1,
      users: Array.isArray(saved.users) ? saved.users : [],
      sessions: saved.sessions && typeof saved.sessions === "object" ? saved.sessions : {},
      posts: Array.isArray(saved.posts) ? saved.posts : [],
    };
  }
  let writeQueue = Promise.resolve();

  function commit() {
    const snapshot = JSON.stringify(data, null, 2);
    const write = async () => {
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      const temporary = `${filePath}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
      await fs.promises.writeFile(temporary, snapshot, { mode: 0o600 });
      await fs.promises.rename(temporary, filePath);
    };
    writeQueue = writeQueue.then(write, write);
    return writeQueue;
  }

  function findUser(id) {
    return data.users.find((user) => user.id === id);
  }

  async function createSession(userId) {
    const token = crypto.randomBytes(32).toString("base64url");
    data.sessions[hashToken(token)] = {
      userId,
      expiresAt: now() + SESSION_DURATION_MS,
    };
    await commit();
    return token;
  }

  async function register({ username, password }) {
    const displayName = normalizeUsername(username);
    const normalized = displayName.toLowerCase();
    if (typeof password !== "string" || password.length < 8 || password.length > 128) {
      const error = new Error("Password must be between 8 and 128 characters.");
      error.status = 400;
      throw error;
    }
    if (data.users.some((user) => user.normalizedUsername === normalized)) {
      const error = new Error("That username is already registered.");
      error.status = 409;
      throw error;
    }
    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = await hashPassword(password, salt);
    if (data.users.some((user) => user.normalizedUsername === normalized)) {
      const error = new Error("That username is already registered.");
      error.status = 409;
      throw error;
    }
    const user = {
      id: crypto.randomUUID(),
      username: displayName,
      normalizedUsername: normalized,
      passwordSalt: salt,
      passwordHash,
      createdAt: new Date(now()).toISOString(),
      progress: {},
    };
    data.users.push(user);
    const token = await createSession(user.id);
    return { token, user: publicUser(user), progress: user.progress };
  }

  async function login({ username, password }) {
    const normalized = String(username ?? "").trim().toLowerCase();
    const user = data.users.find((candidate) => candidate.normalizedUsername === normalized);
    if (!user || typeof password !== "string") {
      const error = new Error("Username or password is incorrect.");
      error.status = 401;
      throw error;
    }
    const candidate = await hashPassword(password.slice(0, 128), user.passwordSalt);
    const expected = Buffer.from(user.passwordHash, "hex");
    const actual = Buffer.from(candidate, "hex");
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
      const error = new Error("Username or password is incorrect.");
      error.status = 401;
      throw error;
    }
    const token = await createSession(user.id);
    return { token, user: publicUser(user), progress: user.progress };
  }

  function authenticate(token) {
    if (!token) return null;
    const key = hashToken(token);
    const session = data.sessions[key];
    if (!session || session.expiresAt <= now()) {
      if (session) delete data.sessions[key];
      return null;
    }
    return findUser(session.userId) || null;
  }


  async function logout(token) {
    if (token) delete data.sessions[hashToken(token)];
    await commit();
  }

  async function saveProgress(user, input) {
    const movieId = cleanText(input.movieId, 120, "Movie ID");
    const episodeId = cleanText(input.episodeId, 60, "Episode ID");
    const position = Number(input.position);
    const duration = Number(input.duration);
    if (!Number.isFinite(position) || position < 0 || position > 604800 ||
        !Number.isFinite(duration) || duration < 0 || duration > 604800) {
      const error = new Error("Playback position and duration must be valid timestamps.");
      error.status = 400;
      throw error;
    }
    const previousShow = user.progress[movieId] || {};
    const previousEpisode = previousShow.episodes?.[episodeId] || {};
    const completed = Boolean(previousEpisode.completed || input.completed ||
      (duration > 0 && position > 0 &&
        (position / duration >= 0.9 || (duration - position <= 45 && position / duration >= 0.75))));
    const show = {
      movieId,
      title: cleanText(input.title || previousShow.title || "Untitled", 200, "Title"),
      poster: String(input.poster ?? previousShow.poster ?? "").slice(0, 2000),
      genres: (Array.isArray(input.genres) ? input.genres : previousShow.genres || [])
        .slice(0, 12).map((genre) => String(genre).trim().slice(0, 60)).filter(Boolean),
      episodes: {
        ...(previousShow.episodes || {}),
        [episodeId]: {
          position: Math.round(position * 10) / 10,
          duration: Math.round(duration * 10) / 10,
          completed,
          updatedAt: new Date(now()).toISOString(),
        },
      },
      lastEpisodeId: episodeId,
      updatedAt: new Date(now()).toISOString(),
    };
    user.progress[movieId] = show;
    await commit();
    return show;
  }

  function getForum(movieId, episodeId) {
    const showId = cleanText(movieId, 120, "Movie ID");
    const threadId = episodeId == null ? null : cleanText(episodeId, 60, "Episode ID");
    return data.posts
      .filter((post) => post.movieId === showId && post.episodeId === threadId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 100)
      .map((post) => ({
        id: post.id,
        movieId: post.movieId,
        episodeId: post.episodeId,
        username: post.username,
        body: post.body,
        createdAt: post.createdAt,
      }));
  }

  async function addPost(user, input) {
    const body = cleanText(input.body, MAX_POST_LENGTH, "Message", true);
    const movieId = cleanText(input.movieId, 120, "Movie ID");
    const episodeId = input.episodeId == null ? null : cleanText(input.episodeId, 60, "Episode ID");
    const post = {
      id: crypto.randomUUID(),
      userId: user.id,
      username: user.username,
      movieId,
      episodeId,
      body,
      createdAt: new Date(now()).toISOString(),
    };
    data.posts.push(post);
    await commit();
    return {
      id: post.id,
      movieId,
      episodeId,
      username: post.username,
      body,
      createdAt: post.createdAt,
    };
  }

  return {
    register,
    login,
    logout,
    authenticate,
    saveProgress,
    getForum,
    addPost,
    publicUser,
    flush: () => writeQueue,
  };
}

module.exports = { createAccountStore, publicUser };
