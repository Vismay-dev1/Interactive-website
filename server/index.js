const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { createUser, findUserByEmail, verifyPassword, createSession, getUserBySession, createTarget, getTarget, createScan, getScan, updateScan, addAuditLog } = require("./store");
const { runScan, assertPublicTarget } = require("./scanner");

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "0.0.0.0";
const AUTHORIZATION_TEXT = "I confirm that I own this target or have explicit authorization to test it.";
const PUBLIC_ROOT = process.cwd();
const rateBuckets = new Map();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".txt": "text/plain; charset=utf-8"
};

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer"
  });
  response.end(JSON.stringify(payload));
}

function sendError(response, status, message) {
  sendJson(response, status, { error: message });
}

function getIp(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || request.socket.remoteAddress || "unknown";
}

function hashIp(ip) {
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 24);
}

function rateLimit(request, limit = 30, windowMs = 15 * 60 * 1000) {
  const key = hashIp(getIp(request));
  const now = Date.now();
  const bucket = rateBuckets.get(key) || { started: now, count: 0 };
  if (now - bucket.started > windowMs) {
    bucket.started = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  return bucket.count <= limit;
}

function bearerToken(request) {
  const header = String(request.headers.authorization || "");
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

function optionalUser(request) {
  return getUserBySession(bearerToken(request));
}

function readBody(request, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > maxBytes) {
        reject(new Error("Request body is too large."));
        request.destroy();
        return;
      }
      body += chunk;
    });
    request.on("end", () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch { reject(new Error("Request body must be valid JSON.")); }
    });
    request.on("error", reject);
  });
}

function isSafeWebsite(value) {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && Boolean(url.hostname);
  } catch { return false; }
}

function isGithubRepository(value) {
  try {
    const input = /^https?:\/\//i.test(value) ? value : `https://github.com/${value}`;
    const url = new URL(input);
    const parts = url.pathname.split("/").filter(Boolean);
    return url.hostname.toLowerCase() === "github.com" && parts.length >= 2;
  } catch { return false; }
}

function publicScan(scan) {
  if (!scan) return null;
  return {
    id: scan.id,
    targetId: scan.targetId,
    sourceType: scan.sourceType,
    status: scan.status,
    progress: scan.progress || null,
    startedAt: scan.startedAt,
    finishedAt: scan.finishedAt,
    findings: scan.findings || [],
    metadata: scan.metadata || null,
    notes: scan.notes || [],
    error: scan.error || null,
    createdAt: scan.createdAt
  };
}

function launchScan(scan) {
  setImmediate(async () => {
    updateScan(scan.id, { status: "recon", startedAt: new Date().toISOString(), progress: { status: "recon", message: "Scan accepted after authorization check." } });
    addAuditLog({ action: "scan_started", scanId: scan.id, targetId: scan.targetId, operatorUserId: scan.operatorUserId || null, sourceIpHash: scan.sourceIpHash });
    try {
      const result = await runScan(scan, (progress) => {
        const nextStatus = progress.status === "scanning" ? "scanning" : progress.status;
        updateScan(scan.id, { status: nextStatus, progress: { ...progress, updatedAt: new Date().toISOString() } });
      });
      updateScan(scan.id, {
        status: "done",
        finishedAt: new Date().toISOString(),
        findings: result.findings || [],
        metadata: result.metadata || null,
        notes: result.notes || [],
        progress: { status: "done", message: result.label || "Scan complete", updatedAt: new Date().toISOString() }
      });
      addAuditLog({ action: "scan_finished", scanId: scan.id, targetId: scan.targetId, operatorUserId: scan.operatorUserId || null, sourceIpHash: scan.sourceIpHash, findingCount: (result.findings || []).length });
    } catch (error) {
      updateScan(scan.id, { status: "failed", finishedAt: new Date().toISOString(), error: error.message || "Scan failed", progress: { status: "failed", message: "No result was created." } });
      addAuditLog({ action: "scan_failed", scanId: scan.id, targetId: scan.targetId, operatorUserId: scan.operatorUserId || null, sourceIpHash: scan.sourceIpHash });
    }
  });
}

async function handleApi(request, response, url) {
  const method = request.method || "GET";
  const pathname = url.pathname;

  if (method === "GET" && pathname === "/api/health") return sendJson(response, 200, { ok: true, service: "breachai-api", time: new Date().toISOString() });

  if (method === "POST" && pathname === "/api/auth/signup") {
    try {
      const body = await readBody(request);
      if (!body.name || !/^\S+@\S+\.\S+$/.test(String(body.email)) || String(body.password || "").length < 12) return sendError(response, 400, "Name, valid email and a password of at least 12 characters are required.");
      const user = createUser({ name: String(body.name), email: String(body.email), password: String(body.password) });
      const token = createSession(user.id);
      return sendJson(response, 201, { user, token });
    } catch (error) { return sendError(response, 400, error.message || "Could not create account."); }
  }

  if (method === "POST" && pathname === "/api/auth/login") {
    try {
      const body = await readBody(request);
      const user = findUserByEmail(String(body.email || ""));
      if (!user || !verifyPassword(String(body.password || ""), user.passwordHash)) return sendError(response, 401, "Email or password is incorrect.");
      const token = createSession(user.id);
      return sendJson(response, 200, { user: { id: user.id, name: user.name, email: user.email }, token });
    } catch (error) { return sendError(response, 400, error.message || "Could not sign in."); }
  }

  if (method === "GET" && pathname === "/api/auth/me") {
    const user = optionalUser(request);
    return user ? sendJson(response, 200, { user }) : sendError(response, 401, "Not signed in.");
  }

  if (method === "POST" && pathname === "/api/targets") {
    if (!rateLimit(request, 60)) return sendError(response, 429, "Too many requests. Try again later.");
    try {
      const user = optionalUser(request);
      if (!user) return sendError(response, 401, "Sign in before creating a target.");
      const body = await readBody(request);
      if (!body.authorizationConfirmed || body.authorizationText !== AUTHORIZATION_TEXT) return sendError(response, 403, "The exact authorization confirmation is required before creating a target.");
      if (body.sourceType === "website" && !isSafeWebsite(body.url)) return sendError(response, 400, "A valid http or https website URL is required.");
      if (body.sourceType === "website") await assertPublicTarget(new URL(String(body.url)));
      if (body.sourceType === "github" && !isGithubRepository(body.url)) return sendError(response, 400, "A valid GitHub repository is required.");
      if (!["website", "github"].includes(body.sourceType)) return sendError(response, 400, "Target source must be website or github.");
      const target = createTarget({ url: String(body.url), sourceType: body.sourceType, environment: String(body.environment || "development"), ownerUserId: user.id, authorizedAt: new Date().toISOString(), authorizationText: AUTHORIZATION_TEXT });
      addAuditLog({ action: "target_created", targetId: target.id, operatorUserId: user?.id || null, sourceIpHash: hashIp(getIp(request)) });
      return sendJson(response, 201, { target: { id: target.id, url: target.url, sourceType: target.sourceType, environment: target.environment, authorizedAt: target.authorizedAt } });
    } catch (error) { return sendError(response, 400, error.message || "Could not create target."); }
  }

  if (method === "POST" && pathname === "/api/scans") {
    if (!rateLimit(request, 20)) return sendError(response, 429, "Scan rate limit reached. Try again later.");
    try {
      const user = optionalUser(request);
      if (!user) return sendError(response, 401, "Sign in before starting a scan.");
      const body = await readBody(request);
      if (!body.authorizationConfirmed || body.authorizationText !== AUTHORIZATION_TEXT) return sendError(response, 403, "The exact authorization confirmation is required before starting a scan.");
      if (!body.sourceType || !body.target) return sendError(response, 400, "sourceType and target are required.");
      if (body.sourceType === "website" && !isSafeWebsite(body.target)) return sendError(response, 400, "A valid http or https website URL is required.");
      if (body.sourceType === "website") await assertPublicTarget(new URL(String(body.target)));
      if (body.sourceType === "github" && !isGithubRepository(body.target)) return sendError(response, 400, "A valid GitHub repository is required.");
      if (!["website", "github"].includes(body.sourceType)) return sendError(response, 400, "This server scan supports website and GitHub sources only.");
      const target = createTarget({ url: String(body.target), sourceType: body.sourceType, environment: String(body.environment || "development"), ownerUserId: user.id, authorizedAt: new Date().toISOString(), authorizationText: AUTHORIZATION_TEXT });
      const scan = createScan({ targetId: target.id, target: target.url, sourceType: target.sourceType, operatorUserId: user?.id || null, sourceIpHash: hashIp(getIp(request)) });
      addAuditLog({ action: "scan_queued", scanId: scan.id, targetId: target.id, operatorUserId: user?.id || null, sourceIpHash: hashIp(getIp(request)) });
      launchScan(scan);
      return sendJson(response, 202, { scan: publicScan(scan), authorization: { confirmed: true, authorizedAt: target.authorizedAt } });
    } catch (error) { return sendError(response, 400, error.message || "Could not start scan."); }
  }

  const scanMatch = pathname.match(/^\/api\/scans\/([a-z0-9_-]+)$/i);
  if (method === "GET" && scanMatch) {
    const scan = getScan(scanMatch[1]);
    return scan ? sendJson(response, 200, { scan: publicScan(scan) }) : sendError(response, 404, "Scan not found.");
  }

  const reportMatch = pathname.match(/^\/api\/scans\/([a-z0-9_-]+)\/report$/i);
  if (method === "GET" && reportMatch) {
    const scan = getScan(reportMatch[1]);
    if (!scan) return sendError(response, 404, "Scan not found.");
    if (scan.status !== "done") return sendError(response, 409, "The scan has not completed.");
    return sendJson(response, 200, { report: publicScan(scan), generatedAt: new Date().toISOString() });
  }

  return sendError(response, 404, "API route not found.");
}

function serveStatic(request, response, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.resolve(PUBLIC_ROOT, `.${pathname}`);
  if (!filePath.startsWith(PUBLIC_ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return sendError(response, 404, "Not found.");
  const extension = path.extname(filePath).toLowerCase();
  response.writeHead(200, { "content-type": mimeTypes[extension] || "application/octet-stream", "cache-control": "no-cache", "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin" });
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) return await handleApi(request, response, url);
    return serveStatic(request, response, url);
  } catch (error) {
    if (!response.headersSent) sendError(response, 500, "Unexpected server error.");
  }
});

server.listen(PORT, HOST, () => console.log(`BREACHAI server listening on http://${HOST}:${PORT}`));
