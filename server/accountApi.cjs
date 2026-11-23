async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32768) {
      const error = new Error("Request body is too large.");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.status = 400;
    throw error;
  }
}

function bearerToken(req) {
  const match = /^Bearer ([A-Za-z0-9_-]{20,200})$/.exec(req.headers.authorization || "");
  return match?.[1] || null;
}

function requireUser(req, store) {
  const token = bearerToken(req);
  const user = store.authenticate(token);
  if (!user) {
    const error = new Error("Please log in again to continue.");
    error.status = 401;
    throw error;
  }
  return { token, user };
}

function createAccountApi(store, sendJson) {
  return async function handleAccountRequest(req, res, url) {
    const isAccountRoute = /^\/api\/streambert\/(auth\/|progress$|forum$)/.test(url.pathname);
    if (!isAccountRoute) return false;

    if (req.method === "POST" && url.pathname === "/api/streambert/auth/register") {
      sendJson(res, 201, await store.register(await readJson(req)));
      return true;
    }
    if (req.method === "POST" && url.pathname === "/api/streambert/auth/login") {
      sendJson(res, 200, await store.login(await readJson(req)));
      return true;
    }
    if (req.method === "POST" && url.pathname === "/api/streambert/auth/logout") {
      await store.logout(bearerToken(req));
      sendJson(res, 200, { ok: true });
      return true;
    }
    if (req.method === "GET" && url.pathname === "/api/streambert/auth/session") {
      const { user } = requireUser(req, store);
      sendJson(res, 200, { user: store.publicUser(user), progress: user.progress });
      return true;
    }
    if (req.method === "PUT" && url.pathname === "/api/streambert/progress") {
      const { user } = requireUser(req, store);
      await store.saveProgress(user, await readJson(req));
      sendJson(res, 200, { progress: user.progress });
      return true;
    }
    if (req.method === "GET" && url.pathname === "/api/streambert/forum") {
      sendJson(res, 200, {
        posts: store.getForum(url.searchParams.get("movieId"), url.searchParams.get("episodeId")),
      });
      return true;
    }
    if (req.method === "POST" && url.pathname === "/api/streambert/forum") {
      const { user } = requireUser(req, store);
      sendJson(res, 201, { post: await store.addPost(user, await readJson(req)) });
      return true;
    }
    sendJson(res, 404, { error: "Not found" });
    return true;
  };
}

module.exports = { createAccountApi, readJson, bearerToken };
