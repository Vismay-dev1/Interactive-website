const crypto = require("node:crypto");
const dns = require("node:dns").promises;
const net = require("node:net");
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");

const caBundlePath = process.env.NODE_EXTRA_CA_CERTS || "/etc/ssl/certs/ca-certificates.crt";
const caBundle = fs.existsSync(caBundlePath) ? fs.readFileSync(caBundlePath) : undefined;

const MAX_REPOSITORY_FILES = 60;
const MAX_TEXT_BYTES = 750000;
const MAX_TOTAL_BYTES = 5000000;
const TEXT_EXTENSIONS = /\.(?:html?|css|scss|sass|less|js|jsx|mjs|cjs|ts|tsx|vue|svelte|astro|json|ya?ml|xml|md|txt|env|ini|conf|config|php|py|rb|go|java|kt|swift|sh|sql|toml)$/i;
const BINARY_EXTENSIONS = /\.(?:png|jpe?g|gif|webp|bmp|ico|pdf|zip|gz|tar|7z|mp[34]|woff2?|ttf|eot|exe|dll|so|dylib|class)$/i;
const SENSITIVE_PATH = /(^|\/)(?:\.env(?:\.|$)|id_rsa(?:\.|$)|credentials?(?:\.|$)|secrets?(?:\.|$)|.*\.(?:pem|key|p12|pfx))$/i;

const checks = [
  { key: "secret-assignment", regex: /\b(api[_-]?key|secret|token|password|client_secret)\b\s*[:=]\s*["'][^"']{8,}["']/gi, severity: "high", title: "Credential-like value in source", category: "Secrets exposure", description: "A credential-like assignment was detected. The matched value is intentionally redacted.", evidence: "A secret-shaped assignment was found; the value was not collected into the report." },
  { key: "private-key", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g, severity: "critical", title: "Private key material in source", category: "Secrets exposure", description: "Private key material appears in a scanned file.", evidence: "A private-key header was matched; key contents were never displayed." },
  { key: "eval", regex: /\beval\s*\(/g, severity: "medium", title: "Dynamic code execution pattern", category: "Unsafe input handling", description: "The source uses eval-like dynamic execution. Review whether untrusted input can reach it.", evidence: "The token eval( was matched in the scanned source." },
  { key: "html-sink", regex: /\.(innerHTML|outerHTML|insertAdjacentHTML)\s*=/g, severity: "medium", title: "Unsafe HTML sink pattern", category: "Cross-site scripting", description: "A direct HTML-writing sink was found. Confirm that content is trusted or safely encoded.", evidence: "A direct HTML sink assignment was matched; no payload was sent." },
  { key: "command-execution", regex: /\b(child_process|execFile|execSync|spawnSync|\.exec)\s*\(?/g, severity: "high", title: "Command execution API pattern", category: "Injection", description: "A command execution API was found. Confirm that arguments cannot be controlled by untrusted input.", evidence: "A command execution API token was matched; no command was executed." },
  { key: "insecure-http", regex: /\bhttp:\/\/[^\s"'`<>]+/gi, severity: "low", title: "Insecure HTTP URL reference", category: "Transport security", description: "A plaintext HTTP URL appears in source. Review whether it is safe to use outside local development.", evidence: "An http:// URL reference was matched in the scanned source." }
];

function lineNumberAt(text, index) {
  return text.slice(0, index).split("\n").length;
}

function makeFinding(data) {
  return { id: crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex").slice(0, 16), confidence: "heuristic", ...data };
}

function scanText(text, filePath, sourceLink = "") {
  const findings = [];
  for (const check of checks) {
    check.regex.lastIndex = 0;
    let match;
    let count = 0;
    while ((match = check.regex.exec(text)) && count < 3) {
      const line = lineNumberAt(text, match.index);
      findings.push(makeFinding({ key: `${check.key}:${filePath}:${line}`, severity: check.severity, title: check.title, category: check.category, description: check.description, evidence: `${check.evidence} Line ${line} in ${filePath}.`, path: filePath, line, link: sourceLink }));
      count += 1;
    }
  }
  return findings;
}

function scanPath(filePath, sourceLink = "") {
  const findings = [];
  if (SENSITIVE_PATH.test(filePath)) findings.push(makeFinding({ key: `sensitive-file:${filePath}`, severity: "high", title: "Sensitive-looking file path", category: "Secrets exposure", description: "A filename commonly used for keys, credentials or environment secrets is present in the selected source.", evidence: `The path ${filePath} matches a sensitive-file pattern. File contents were not displayed.`, path: filePath, link: sourceLink }));
  if (/\.map$/i.test(filePath)) findings.push(makeFinding({ key: `source-map:${filePath}`, severity: "low", title: "Public source map file", category: "Information exposure", description: "A source map is present. Confirm that publishing source maps is intended for this environment.", evidence: `The source map path ${filePath} was found.`, path: filePath, link: sourceLink }));
  return findings;
}

function request(url, { headers = {}, maxBytes = 10 * 1024 * 1024, collectBody = true, timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === "https:" ? https : http;
    const requestOptions = { protocol: parsed.protocol, hostname: parsed.hostname, port: parsed.port || undefined, path: `${parsed.pathname}${parsed.search}`, method: "GET", headers, timeout: timeoutMs, rejectUnauthorized: true };
    if (caBundle && parsed.protocol === "https:") requestOptions.ca = caBundle;
    const requestHandle = client.request(requestOptions, (response) => {
      if (!collectBody) {
        response.resume();
        resolve({ statusCode: response.statusCode || 0, statusMessage: response.statusMessage || "", headers: response.headers, body: "" });
        return;
      }
      let size = 0;
      const chunks = [];
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        size += Buffer.byteLength(chunk);
        if (size > maxBytes) {
          requestHandle.destroy(new Error("Remote response exceeded the scanner limit."));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => resolve({ statusCode: response.statusCode || 0, statusMessage: response.statusMessage || "", headers: response.headers, body: chunks.join("") }));
    });
    requestHandle.on("timeout", () => requestHandle.destroy(new Error("Remote request timed out.")));
    requestHandle.on("error", reject);
    requestHandle.end();
  });
}

async function githubJson(url) {
  const response = await request(url, { headers: { accept: "application/vnd.github+json", "user-agent": "BREACHAI-authorized-scanner" } });
  if (response.statusCode < 200 || response.statusCode >= 300) throw new Error(`GitHub returned ${response.statusCode} for ${new URL(url).pathname}.`);
  try { return JSON.parse(response.body); } catch { throw new Error("GitHub returned invalid JSON."); }
}

function parseGithubTarget(target) {
  let input = String(target || "").trim();
  if (!input) throw new Error("A GitHub repository is required.");
  if (!/^https?:\/\//i.test(input)) input = `https://github.com/${input}`;
  const url = new URL(input);
  if (url.hostname.toLowerCase() !== "github.com") throw new Error("Only github.com repositories are supported by this worker.");
  const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  if (parts.length < 2 || !/^[\w.-]+$/.test(parts[0]) || !/^[\w.-]+$/.test(parts[1])) throw new Error("Use github.com/owner/repository.");
  return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
}

function decodeBase64(value) {
  return Buffer.from(String(value).replace(/\s/g, ""), "base64").toString("utf8");
}

async function scanGithubRepository(target, onProgress = () => {}) {
  const { owner, repo } = parseGithubTarget(target);
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  onProgress({ status: "recon", message: "Reading repository metadata." });
  const metadata = await githubJson(base);
  const branch = metadata.default_branch || "main";
  const tree = await githubJson(`${base}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
  const entries = (tree.tree || []).filter((entry) => entry.type === "blob");
  const candidates = entries.filter((entry) => TEXT_EXTENSIONS.test(entry.path) || SENSITIVE_PATH.test(entry.path) || /\.map$/i.test(entry.path)).slice(0, MAX_REPOSITORY_FILES);
  const notes = [];
  if (tree.truncated) notes.push("GitHub marked the recursive tree as truncated; the result is partial.");
  if (entries.length > candidates.length) notes.push(`Inspected ${candidates.length} text-like paths out of ${entries.length} repository paths.`);
  const findings = [];
  let scannedFiles = 0;
  let totalBytes = 0;
  for (let index = 0; index < candidates.length; index += 1) {
    const entry = candidates[index];
    onProgress({ status: "scanning", message: `Inspecting ${entry.path} (${index + 1}/${candidates.length}).`, completed: index, total: candidates.length });
    const sourceLink = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/blob/${encodeURIComponent(branch)}/${entry.path.split("/").map(encodeURIComponent).join("/")}`;
    findings.push(...scanPath(entry.path, sourceLink));
    if (entry.size > MAX_TEXT_BYTES || SENSITIVE_PATH.test(entry.path)) continue;
    try {
      const blob = await githubJson(`${base}/git/blobs/${entry.sha}`);
      if (blob.encoding !== "base64" || !blob.content) continue;
      const text = decodeBase64(blob.content);
      totalBytes += Buffer.byteLength(text);
      if (totalBytes > MAX_TOTAL_BYTES) {
        notes.push(`Stopped reading after ${MAX_TOTAL_BYTES / 1000000} MB of source text.`);
        break;
      }
      scannedFiles += 1;
      findings.push(...scanText(text, entry.path, sourceLink));
    } catch {
      notes.push(`${entry.path}: GitHub did not return a readable blob.`);
    }
  }
  return { sourceType: "github", source: `${owner}/${repo}`, label: `${owner}/${repo} · ${scannedFiles} source file${scannedFiles === 1 ? "" : "s"}`, findings, notes, metadata: { fullName: metadata.full_name, branch, language: metadata.language, license: metadata.license?.spdx_id || metadata.license?.name || null } };
}

function headerFinding({ key, severity, title, category, description, evidence, recommendation }) {
  return makeFinding({ key, severity, title, category, description, evidence, recommendation });
}

function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const octets = address.split(".").map(Number);
    const [a, b] = octets;
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 0) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const normalized = address.toLowerCase();
  return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:") || normalized.startsWith("::ffff:127.") || normalized.startsWith("::ffff:10.") || normalized.startsWith("::ffff:192.168.");
}

async function assertPublicTarget(url) {
  const hostname = url.hostname.toLowerCase();
  if (["localhost", "localhost.localdomain", "metadata.google.internal"].includes(hostname) || hostname.endsWith(".localhost") || hostname.endsWith(".internal")) throw new Error("Private and internal network targets are blocked by the safe scanner.");
  const addresses = net.isIP(hostname) ? [{ address: hostname }] : await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((item) => isPrivateAddress(item.address))) throw new Error("The target resolves to a private or reserved network address and was blocked.");
}

async function scanWebsite(target, onProgress = () => {}) {
  const url = new URL(target);
  if (!/^https?:$/.test(url.protocol)) throw new Error("Only http and https targets are supported.");
  await assertPublicTarget(url);
  onProgress({ status: "scanning", message: "Making one passive GET request." });
    const response = await request(url.href, { collectBody: false, timeoutMs: 12000, headers: { "user-agent": "BREACHAI-safe-passive-check/0.1" } });
    const getHeader = (name) => String(response.headers[name.toLowerCase()] || "");
    const findings = [];
    const headers = [
      ["content-security-policy", "Content Security Policy", "medium", "Add a tested Content-Security-Policy header."],
      ["strict-transport-security", "HTTP Strict Transport Security", "medium", "Serve the site over HTTPS and configure HSTS after verifying the deployment."],
      ["x-content-type-options", "X-Content-Type-Options", "low", "Set X-Content-Type-Options: nosniff."],
      ["referrer-policy", "Referrer-Policy", "low", "Set a deliberate Referrer-Policy."],
      ["permissions-policy", "Permissions-Policy", "low", "Set a Permissions-Policy appropriate for the application."],
      ["x-frame-options", "Frame protection", "medium", "Set X-Frame-Options or frame-ancestors in CSP."]
    ];
    for (const [key, name, severity, recommendation] of headers) {
      const csp = getHeader("content-security-policy");
      const present = Boolean(getHeader(key)) || (key === "x-frame-options" && /frame-ancestors/i.test(csp));
      if (!present) findings.push(headerFinding({ key: `header:${key}`, severity, title: `Missing ${name}`, category: "Security headers", description: `The fetched response did not expose a ${name} header.`, evidence: `GET ${url.origin}${url.pathname} returned no readable ${name} header.`, recommendation }));
    }
    if (url.protocol !== "https:") findings.push(headerFinding({ key: "transport:http", severity: "medium", title: "Website uses HTTP", category: "Transport security", description: "The target URL uses plaintext HTTP.", evidence: `The scan target protocol is ${url.protocol}.`, recommendation: "Redirect the application to HTTPS and enable HSTS after verifying the deployment." }));
    if (response.statusCode < 200 || response.statusCode >= 300) findings.push(headerFinding({ key: `status:${response.statusCode}`, severity: "low", title: "Unexpected HTTP response status", category: "Availability", description: "The target returned a non-success HTTP status to the passive request.", evidence: `The response status was ${response.statusCode} ${response.statusMessage}.` }));
  return { sourceType: "website", source: url.origin, label: `${response.statusCode} ${response.statusMessage || "response"} · passive response check`, findings, notes: ["One GET request was made. No crawling, authentication, payloads or exploitation were performed."], metadata: { status: response.statusCode, contentType: getHeader("content-type") || null } };
}

async function runScan(scan, onProgress) {
  if (scan.sourceType === "website") return scanWebsite(scan.target, onProgress);
  if (scan.sourceType === "github") return scanGithubRepository(scan.target, onProgress);
  throw new Error("Unsupported server scan source. Use website or GitHub repository.");
}

module.exports = { runScan, assertPublicTarget };
