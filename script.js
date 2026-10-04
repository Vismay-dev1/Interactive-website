(() => {
  "use strict";

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const REPOSITORY = "Vismay-dev1/Interactive-website";
  const GITHUB_API = `https://api.github.com/repos/${REPOSITORY}`;

  const escapeHtml = (value = "") => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const formatCount = (value) => Number.isFinite(Number(value)) ? Number(value).toLocaleString() : "—";
  const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    const seconds = Math.round((date.getTime() - Date.now()) / 1000);
    const absolute = Math.abs(seconds);
    const units = [[31536000, "year"], [2592000, "month"], [604800, "week"], [86400, "day"], [3600, "hour"], [60, "minute"]];
    for (const [unit, label] of units) {
      if (absolute >= unit) {
        const amount = Math.round(seconds / unit);
        return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(amount, label);
      }
    }
    return "just now";
  };
  const writeAll = (attribute, value) => $$(`[${attribute}]`).forEach((element) => { element.textContent = value; });
  const setGithubStatus = (key, value) => $$(`[data-github-status="${key}"]`).forEach((element) => { element.textContent = value; });
  const markUnavailable = (message = "Unavailable") => {
    ["stars", "forks", "issues", "watchers", "relative"].forEach((key) => {
      writeAll(`data-github="${key}"`, "—");
      setGithubStatus(key, message);
    });
    ["description", "branch", "language", "license", "pushed", "updated", "created"].forEach((key) => writeAll(`data-repo="${key}"`, "—"));
    writeAll("data-repo-name", REPOSITORY);
  };

  // Responsive navigation.
  const menuToggle = $(".menu-toggle");
  const mobileNav = $(".mobile-nav");
  const closeMobileNav = () => {
    if (!menuToggle || !mobileNav) return;
    menuToggle.setAttribute("aria-expanded", "false");
    mobileNav.classList.remove("open");
    mobileNav.setAttribute("aria-hidden", "true");
  };
  menuToggle?.addEventListener("click", () => {
    const open = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!open));
    mobileNav.classList.toggle("open", !open);
    mobileNav.setAttribute("aria-hidden", String(open));
  });
  $$(".mobile-nav a").forEach((link) => link.addEventListener("click", closeMobileNav));
  window.addEventListener("resize", () => { if (window.innerWidth > 850) closeMobileNav(); });

  // Section reveals.
  const revealItems = $$(".reveal");
  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -35px" });
    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("visible"));
  }

  // Toast notifications for actions that are intentionally not backed by a server.
  const toast = $("#toast");
  let toastTimeout;
  const showToast = (message) => {
    if (!toast) return;
    $("p", toast).textContent = message;
    toast.classList.add("visible");
    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => toast.classList.remove("visible"), 3800);
  };
  $$(".toast-trigger").forEach((trigger) => trigger.addEventListener("click", () => showToast(trigger.dataset.toast || "This frontend action is not connected to a backend.")));

  // Read real public repository data. There is deliberately no fabricated fallback.
  const fetchGithubJson = async (url) => {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/vnd.github+json" }
    });
    if (!response.ok) throw new Error(`GitHub request failed: ${response.status}`);
    return response.json();
  };

  const renderRepository = (repo) => {
    writeAll("data-repo-name", repo.full_name || REPOSITORY);
    writeAll("data-repo=\"description\"", repo.description || "No description provided by the repository.");
    writeAll("data-repo=\"branch\"", repo.default_branch || "Not specified");
    writeAll("data-repo=\"language\"", repo.language || "Not specified");
    writeAll("data-repo=\"license\"", repo.license?.spdx_id || repo.license?.name || "Not specified");
    writeAll("data-repo=\"pushed\"", formatDate(repo.pushed_at));
    writeAll("data-repo=\"updated\"", formatDate(repo.updated_at));
    writeAll("data-repo=\"created\"", formatDate(repo.created_at));
    writeAll("data-github=\"stars\"", formatCount(repo.stargazers_count));
    writeAll("data-github=\"forks\"", formatCount(repo.forks_count));
    writeAll("data-github=\"issues\"", formatCount(repo.open_issues_count));
    writeAll("data-github=\"watchers\"", formatCount(repo.watchers_count));
    writeAll("data-github=\"relative\"", formatDate(repo.pushed_at));
    ["stars", "forks", "issues", "watchers", "relative"].forEach((key) => setGithubStatus(key, "Live from GitHub"));
    writeAll("data-repo=\"issues-state\"", "Live");
  };

  const renderIssues = (issues) => {
    const container = $("#github-issues-list");
    if (!container) return;
    const publicIssues = issues.filter((issue) => !issue.pull_request);
    if (!publicIssues.length) {
      container.innerHTML = `<div class="issue-empty"><span class="issue-empty-icon">✓</span><strong>No open issues returned.</strong><p>GitHub currently returned an empty public issue list for this repository. Nothing has been added to fill the space.</p><a class="text-link" href="https://github.com/${REPOSITORY}/issues" target="_blank" rel="noopener noreferrer">Open the issue tracker <span>↗</span></a></div>`;
      return;
    }
    container.innerHTML = publicIssues.map((issue) => {
      const labels = (issue.labels || []).map((label) => `<span class="issue-label">${escapeHtml(label.name)}</span>`).join("");
      const body = issue.body ? escapeHtml(issue.body.replace(/\s+/g, " ").trim().slice(0, 170)) : "No description added.";
      return `<article class="issue-card"><div class="issue-card-head"><span class="issue-state">OPEN</span><span class="issue-number">#${formatCount(issue.number)}</span><time>${escapeHtml(formatDate(issue.updated_at))}</time></div><h3><a href="${escapeHtml(issue.html_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(issue.title)} <span aria-hidden="true">↗</span></a></h3><p>${body}${issue.body && issue.body.length > 170 ? "…" : ""}</p><div class="issue-card-foot"><span>Opened by ${escapeHtml(issue.user?.login || "GitHub user")}</span><span class="issue-labels">${labels}</span></div></article>`;
    }).join("");
  };

  const renderContributors = (contributors) => {
    const container = $("#contributors-list");
    if (!container) return;
    if (!contributors.length) {
      container.innerHTML = `<div class="issue-empty compact"><strong>No contributor data returned.</strong><p>GitHub did not return public contributors for this repository.</p></div>`;
      return;
    }
    container.innerHTML = contributors.map((contributor) => `<a class="contributor-row" href="${escapeHtml(contributor.html_url)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(contributor.avatar_url)}" alt="" loading="lazy" /><span><b>${escapeHtml(contributor.login)}</b><small>${formatCount(contributor.contributions)} public contributions</small></span><span aria-hidden="true">↗</span></a>`).join("");
  };

  const loadGithubData = async () => {
    try {
      const repo = await fetchGithubJson(GITHUB_API);
      renderRepository(repo);
    } catch (error) {
      markUnavailable("Unavailable");
      const description = $(".repo-description");
      if (description) description.textContent = "GitHub metadata could not be loaded in this browser session.";
    }

    const [issuesResult, contributorsResult] = await Promise.allSettled([
      fetchGithubJson(`${GITHUB_API}/issues?state=open&per_page=10&sort=updated`),
      fetchGithubJson(`${GITHUB_API}/contributors?per_page=8`)
    ]);
    if (issuesResult.status === "fulfilled") {
      renderIssues(issuesResult.value);
      writeAll("data-repo=\"issues-state\"", "Live");
    } else {
      const issues = $("#github-issues-list");
      if (issues) issues.innerHTML = `<div class="issue-empty"><strong>GitHub issue data is unavailable.</strong><p>Try opening the repository directly to inspect its current public issues.</p><a class="text-link" href="https://github.com/${REPOSITORY}/issues" target="_blank" rel="noopener noreferrer">Open GitHub issues <span>↗</span></a></div>`;
      writeAll("data-repo=\"issues-state\"", "Unavailable");
    }
    if (contributorsResult.status === "fulfilled") {
      renderContributors(contributorsResult.value);
    } else {
      const contributors = $("#contributors-list");
      if (contributors) contributors.innerHTML = `<div class="issue-empty compact"><strong>Contributor data is unavailable.</strong><p>Open the public contributor graph on GitHub to inspect it directly.</p></div>`;
    }
  };
  loadGithubData();
  // Refresh public repository metadata periodically without inventing a fallback value.
  window.setInterval(loadGithubData, 300000);

  // Safe, real scan engine. It performs passive website checks and local/source inspection only.
  const stages = $$(".scan-stage");
  const progress = $("#scan-progress");
  const scanPercent = $("#scan-percent");
  const scanStatus = $("#scan-status");
  const scanModeLabel = $("#scan-mode-label");
  const scanTitle = $("#scan-title");
  const demoTarget = $("#demo-target");
  const demoScore = $("#demo-score");
  const demoScanButton = $("#demo-scan-button");
  const scanResults = $("#scan-results");
  const reportEmpty = $("#report-empty");
  const reportLive = $("#report-live");
  const heroForm = $("#hero-scan-form");
  let activeSource = "website";
  let selectedFiles = [];
  let scanRunning = false;
  let activeStageIndex = -1;
  const stageStartedAt = new Map();
  const setSource = (source) => {
    activeSource = source;
    $$(".scan-source-tab").forEach((tab) => {
      const selected = tab.dataset.sourceTab === source;
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-selected", String(selected));
    });
    $$(".scan-source-panel").forEach((panel) => {
      const selected = panel.id === `scan-source-${source}`;
      panel.classList.toggle("active", selected);
      panel.hidden = !selected;
    });
    if (scanModeLabel) scanModeLabel.textContent = "AUTHORIZATION REQUIRED / NO SCAN RUN";
    if (scanStatus) scanStatus.textContent = source === "website" ? "Enter an authorized website" : source === "repository" ? "Enter a GitHub repository" : "Choose files or a folder";
  };
  $$(".scan-source-tab").forEach((tab) => tab.addEventListener("click", () => setSource(tab.dataset.sourceTab)));

  const mergeFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    const merged = new Map(selectedFiles.map((file) => [`${file.webkitRelativePath || file.name}:${file.lastModified}`, file]));
    incoming.forEach((file) => merged.set(`${file.webkitRelativePath || file.name}:${file.lastModified}`, file));
    selectedFiles = Array.from(merged.values());
    const label = $("#selected-files");
    if (label) label.textContent = selectedFiles.length ? `${selectedFiles.length.toLocaleString()} file${selectedFiles.length === 1 ? "" : "s"} selected locally.` : "No files selected.";
  };
  $("#source-files")?.addEventListener("change", (event) => mergeFiles(event.target.files));
  $("#source-folder")?.addEventListener("change", (event) => mergeFiles(event.target.files));

  const resetStages = () => {
    activeStageIndex = -1;
    stageStartedAt.clear();
    stages.forEach((stage) => {
      stage.classList.remove("done", "warning", "running", "error");
      $(".stage-status", stage).textContent = "○";
      $("time", stage).textContent = "--";
    });
    if (progress) progress.style.width = "0%";
    if (scanPercent) scanPercent.textContent = "0%";
  };
  const setStage = (index, status = "running") => {
    activeStageIndex = Math.min(index, stages.length - 1);
    stages.forEach((stage, stageIndex) => {
      stage.classList.remove("done", "warning", "running", "error");
      const started = stageStartedAt.get(stageIndex);
      if (stageIndex < index || (status === "done" && stageIndex === index)) {
        stage.classList.add("done");
        $(".stage-status", stage).textContent = "✓";
        $("time", stage).textContent = started ? `${Math.max(1, Math.round(performance.now() - started))}ms` : "done";
      } else if (stageIndex === index && status === "running") {
        stage.classList.add("running");
        stageStartedAt.set(stageIndex, performance.now());
        $(".stage-status", stage).textContent = "◌";
        $("time", stage).textContent = "…";
      } else if (stageIndex === index && status === "error") {
        stage.classList.add("error");
        $(".stage-status", stage).textContent = "!";
        $("time", stage).textContent = started ? `${Math.max(1, Math.round(performance.now() - started))}ms` : "stopped";
      } else {
        $(".stage-status", stage).textContent = "○";
        $("time", stage).textContent = "--";
      }
    });
    const percent = status === "done" && index >= stages.length ? 100 : Math.min(99, Math.round((index / stages.length) * 100));
    if (progress) progress.style.width = `${percent}%`;
    if (scanPercent) scanPercent.textContent = `${percent}%`;
  };

  const lineNumberAt = (text, index) => text.slice(0, index).split("\n").length;
  const finding = (data) => ({ severity: "medium", ...data });
  const sourceChecks = [
    { key: "secret-assignment", regex: /\b(api[_-]?key|secret|token|password|client_secret)\b\s*[:=]\s*["'][^"']{8,}["']/gi, severity: "high", title: "Credential-like value in source", category: "Secrets exposure", description: "A credential-like assignment was detected. The matched value is intentionally redacted.", evidence: "A secret-shaped assignment was found; the value was not collected into the report." },
    { key: "private-key", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g, severity: "critical", title: "Private key material in source", category: "Secrets exposure", description: "Private key material appears in a scanned file.", evidence: "A private-key header was matched; key contents were never displayed." },
    { key: "eval", regex: /\beval\s*\(/g, severity: "medium", title: "Dynamic code execution pattern", category: "Unsafe input handling", description: "The source uses eval-like dynamic execution. Review whether untrusted input can reach it.", evidence: "The token eval( was matched in the scanned source." },
    { key: "html-sink", regex: /\.(innerHTML|outerHTML|insertAdjacentHTML)\s*=/g, severity: "medium", title: "Unsafe HTML sink pattern", category: "Cross-site scripting", description: "A direct HTML-writing sink was found. Confirm that content is trusted or safely encoded.", evidence: "A direct HTML sink assignment was matched; no payload was sent." },
    { key: "command-execution", regex: /\b(child_process|execFile|execSync|spawnSync|\.exec)\s*\(?/g, severity: "high", title: "Command execution API pattern", category: "Injection", description: "A command execution API was found. Confirm that arguments cannot be controlled by untrusted input.", evidence: "A command execution API token was matched; no command was executed." },
    { key: "insecure-http", regex: /\bhttp:\/\/[^\s"'`<>]+/gi, severity: "low", title: "Insecure HTTP URL reference", category: "Transport security", description: "A plaintext HTTP URL appears in source. Review whether it is safe to use outside local development.", evidence: "An http:// URL reference was matched in the scanned source." }
  ];
  const textExtensions = /\.(?:html?|css|scss|sass|less|js|jsx|mjs|cjs|ts|tsx|vue|svelte|astro|json|ya?ml|xml|md|txt|env|ini|conf|config|php|py|rb|go|java|kt|swift|sh|sql|toml)$/i;
  const binaryExtensions = /\.(?:png|jpe?g|gif|webp|bmp|ico|pdf|zip|gz|tar|7z|mp[34]|woff2?|ttf|eot|exe|dll|so|dylib|class)$/i;
  const sensitivePath = /(^|\/)(?:\.env(?:\.|$)|id_rsa(?:\.|$)|credentials?(?:\.|$)|secrets?(?:\.|$)|.*\.(?:pem|key|p12|pfx))$/i;

  const scanText = (text, path, link = "") => {
    const findings = [];
    sourceChecks.forEach((check) => {
      check.regex.lastIndex = 0;
      let match;
      let matches = 0;
      while ((match = check.regex.exec(text)) && matches < 3) {
        findings.push(finding({
          key: `${check.key}:${path}:${lineNumberAt(text, match.index)}`,
          severity: check.severity,
          title: check.title,
          category: check.category,
          description: check.description,
          evidence: `${check.evidence} Line ${lineNumberAt(text, match.index)} in ${path}.`,
          path,
          line: lineNumberAt(text, match.index),
          link
        }));
        matches += 1;
      }
    });
    return findings;
  };

  const pathFindings = (path, link = "") => {
    const findings = [];
    if (sensitivePath.test(path)) {
      findings.push(finding({ key: `sensitive-file:${path}`, severity: "high", title: "Sensitive-looking file path", category: "Secrets exposure", description: "A filename commonly used for keys, credentials or environment secrets is present in the selected source.", evidence: `The path ${path} matches a sensitive-file pattern. File contents were not displayed.`, path, link }));
    }
    if (/\.map$/i.test(path)) {
      findings.push(finding({ key: `source-map:${path}`, severity: "low", title: "Public source map file", category: "Information exposure", description: "A source map is present. Confirm that publishing source maps is intended for this environment.", evidence: `The source map path ${path} was found.`, path, link }));
    }
    return findings;
  };

  const readLocalFile = async (file) => {
    const path = file.webkitRelativePath || file.name;
    if (file.size > 750000 || binaryExtensions.test(path)) return { path, skipped: true, reason: "binary or larger than 750 KB" };
    if (!textExtensions.test(path) && file.size > 250000) return { path, skipped: true, reason: "unrecognised large file type" };
    try {
      return { path, text: await file.text(), link: "" };
    } catch {
      return { path, skipped: true, reason: "could not be read by the browser" };
    }
  };

  const scanLocalFiles = async (files) => {
    const findings = [];
    const notes = [];
    const capped = files.slice(0, 200);
    if (files.length > capped.length) notes.push(`Only the first ${capped.length} files were read to keep the browser responsive.`);
    let scanned = 0;
    for (const file of capped) {
      const path = file.webkitRelativePath || file.name;
      findings.push(...pathFindings(path));
      const result = await readLocalFile(file);
      if (result.skipped) { notes.push(`${path}: skipped (${result.reason}).`); continue; }
      scanned += 1;
      findings.push(...scanText(result.text, result.path));
    }
    return { kind: "files", label: `${scanned} local text file${scanned === 1 ? "" : "s"}`, findings, notes };
  };

  const parseGithubRepository = (value) => {
    const raw = value.trim();
    if (!raw) throw new Error("Enter a GitHub repository URL or owner/repository.");
    let path = raw;
    try {
      const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://github.com/${raw}`);
      if (url.hostname.toLowerCase() !== "github.com") throw new Error("Only github.com repositories are supported.");
      path = url.pathname;
    } catch (error) {
      if (error.message.includes("Only github")) throw error;
    }
    const parts = path.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
    if (parts.length < 2 || !/^[\w.-]+$/.test(parts[0]) || !/^[\w.-]+$/.test(parts[1])) throw new Error("Use a GitHub URL such as github.com/owner/repository.");
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
  };

  const decodeGithubBlob = (content) => {
    const binary = atob(content.replace(/\s/g, ""));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  };

  const scanGithubRepository = async (value) => {
    const serverResult = await scanThroughApi("github", value);
    if (serverResult) return serverResult;
    const { owner, repo } = parseGithubRepository(value);
    const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const metadata = await fetchGithubJson(base);
    const branch = metadata.default_branch || "main";
    const treeResponse = await fetchGithubJson(`${base}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
    const entries = (treeResponse.tree || []).filter((entry) => entry.type === "blob");
    const notes = [];
    if (treeResponse.truncated) notes.push("GitHub marked this recursive tree as truncated; the result is partial.");
    const candidates = entries.filter((entry) => textExtensions.test(entry.path) || sensitivePath.test(entry.path) || /\.map$/i.test(entry.path)).slice(0, 60);
    if (entries.length > candidates.length) notes.push(`Inspected ${candidates.length} text-like paths out of ${entries.length} repository paths.`);
    const findings = [];
    let scanned = 0;
    let totalBytes = 0;
    for (const entry of candidates) {
      const blobPath = entry.path.split("/").map(encodeURIComponent).join("/");
      const link = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/blob/${encodeURIComponent(branch)}/${blobPath}`;
      findings.push(...pathFindings(entry.path, link));
      if (entry.size > 750000 || sensitivePath.test(entry.path)) continue;
      try {
        const blob = await fetchGithubJson(`${base}/git/blobs/${entry.sha}`);
        if (blob.encoding !== "base64" || !blob.content) continue;
        const text = decodeGithubBlob(blob.content);
        totalBytes += text.length;
        if (totalBytes > 5000000) { notes.push("Stopped reading after 5 MB of text to keep this browser scan bounded."); break; }
        scanned += 1;
        findings.push(...scanText(text, entry.path, link));
      } catch {
        notes.push(`${entry.path}: GitHub did not return a readable blob.`);
      }
    }
    return { kind: "repository", label: `${owner}/${repo} · ${scanned} source file${scanned === 1 ? "" : "s"}`, findings, notes, metadata };
  };

  const scanThroughApi = async (sourceType, value) => {
    let health;
    try {
      health = await fetch("/api/health", { cache: "no-store" });
    } catch {
      return null;
    }
    if (!health.ok) return null;
    const sessionToken = localStorage.getItem("breachai_session");
    const response = await fetch("/api/scans", {
      method: "POST",
      headers: { "content-type": "application/json", ...(sessionToken ? { authorization: `Bearer ${sessionToken}` } : {}) },
      body: JSON.stringify({ sourceType, target: value, authorizationConfirmed: true, authorizationText: "I confirm that I own this target or have explicit authorization to test it." })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "The scan server rejected the request.");
    const scanId = payload.scan?.id;
    if (!scanId) throw new Error("The scan server did not return a scan id.");
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const statusResponse = await fetch(`/api/scans/${encodeURIComponent(scanId)}`, { cache: "no-store" });
      const statusPayload = await statusResponse.json().catch(() => ({}));
      if (!statusResponse.ok) throw new Error(statusPayload.error || "Could not read scan status.");
      const scan = statusPayload.scan;
      if (scanStatus && scan?.progress?.message) scanStatus.textContent = scan.progress.message;
      if (scan?.status === "done") return { kind: sourceType === "github" ? "repository" : "website", label: `Server scan · ${value}`, findings: scan.findings || [], notes: scan.notes || [], metadata: scan.metadata || null };
      if (scan?.status === "failed") throw new Error(scan.error || "The server-side scan failed.");
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    }
    throw new Error("The scan server did not finish within the browser wait window.");
  };

  const scanWebsite = async (value) => {
    const serverResult = await scanThroughApi("website", value);
    if (serverResult) return serverResult;
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) throw new Error("Only http and https URLs are supported.");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url.href, { method: "GET", mode: "cors", redirect: "follow", credentials: "omit", signal: controller.signal, cache: "no-store" });
      const findings = [];
      const headers = [
        ["content-security-policy", "Content Security Policy", "medium", "Add a tested Content-Security-Policy header."],
        ["strict-transport-security", "HTTP Strict Transport Security", "medium", "Serve the site over HTTPS and configure HSTS when the deployment is ready."],
        ["x-content-type-options", "X-Content-Type-Options", "low", "Set X-Content-Type-Options: nosniff."],
        ["referrer-policy", "Referrer-Policy", "low", "Set a deliberate Referrer-Policy for the application."],
        ["permissions-policy", "Permissions-Policy", "low", "Set a Permissions-Policy appropriate for the application."],
        ["x-frame-options", "Frame protection", "medium", "Set frame protection with X-Frame-Options or frame-ancestors in CSP."]
      ];
      headers.forEach(([key, name, severity, recommendation]) => {
        const present = Boolean(response.headers.get(key)) || (key === "x-frame-options" && Boolean(response.headers.get("content-security-policy")?.match(/frame-ancestors/i)));
        if (!present) findings.push(finding({ key: `website-header:${key}`, severity, title: `Missing ${name}`, category: "Security headers", description: `The fetched response did not expose a ${name} header.`, evidence: `GET ${url.origin}${url.pathname} returned no readable ${name} header.`, recommendation, path: url.href }));
      });
      if (url.protocol !== "https:") findings.push(finding({ key: "website-http", severity: "medium", title: "Website uses HTTP", category: "Transport security", description: "The supplied URL uses plaintext HTTP.", evidence: `The scan target protocol is ${url.protocol}.`, recommendation: "Redirect the application to HTTPS and enable HSTS after verifying the deployment." }));
      if (!response.ok) findings.push(finding({ key: `website-status:${response.status}`, severity: "low", title: "Unexpected HTTP response status", category: "Availability", description: "The target returned a non-success HTTP status to the passive request.", evidence: `The response status was ${response.status} ${response.statusText}.` }));
      return { kind: "website", label: `${response.status} ${response.statusText || "response"} · passive response check`, findings, notes: ["Only one GET request was made. No crawling, payloads, authentication attempts or exploitation were performed."], metadata: { status: response.status, contentType: response.headers.get("content-type") || "Not exposed" } };
    } catch (error) {
      const reason = error.name === "AbortError" ? "The request timed out after 12 seconds." : "The browser could not read this target. The server may not allow cross-origin reads.";
      return { kind: "website-blocked", label: "No browser-readable response", findings: [], notes: [reason, "No active testing was attempted. Use the repository or local files scan for source inspection, or connect an authorized server-side scanner."], error: true };
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const renderLiveReport = (result) => {
    if (!reportEmpty || !reportLive || result.error) return;
    reportEmpty.hidden = true;
    reportLive.hidden = false;
    const title = $("#report-title");
    const source = $("#report-source");
    const count = $("#report-observation-count");
    const completed = $("#report-completed-at");
    const status = $("#report-status");
    const findingList = $("#report-finding-list");
    const notes = $("#report-notes");
    if (title) title.textContent = result.label || "Completed scan";
    if (source) source.textContent = result.kind === "repository" ? "GitHub repository" : "Website passive check";
    if (count) count.textContent = String(result.findings.length);
    if (completed) completed.textContent = new Date().toLocaleString();
    if (status) status.textContent = "Complete";
    if (findingList) findingList.innerHTML = result.findings.length ? result.findings.map((item) => `<article><span class="severity ${escapeHtml(item.severity)}">${escapeHtml(item.severity.toUpperCase())}</span><div><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.description)}</p><small>${escapeHtml(item.evidence)}</small></div></article>`).join("") : `<div class="report-no-findings"><strong>No observations returned.</strong><p>No matching checks were detected in the selected source. This is not proof of security.</p></div>`;
    if (notes) notes.innerHTML = result.notes?.length ? `<strong>Scan notes</strong><ul>${result.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>` : "";
  };

  const renderScanResults = (result) => {
    if (!scanResults) return;
    const count = result.findings.length;
    if (demoScore) demoScore.textContent = result.error ? "—" : String(count);
    if (scanModeLabel) scanModeLabel.textContent = `${result.kind === "website-blocked" ? "NO RESPONSE" : "SCAN COMPLETE"} / SOURCE-DERIVED RESULTS`;
    if (scanTitle) scanTitle.textContent = result.kind === "website-blocked" ? "The browser could not read that target." : `${result.label} inspected`;
    const notes = (result.notes || []).map((note) => `<li>${escapeHtml(note)}</li>`).join("");
    const findings = result.findings.map((item) => `<article class="real-finding"><div class="real-finding-head"><span class="severity ${escapeHtml(item.severity)}">${escapeHtml(item.severity.toUpperCase())}</span><span>${escapeHtml(item.category)}</span></div><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.description)}</p><div class="real-finding-evidence"><strong>Safe evidence</strong><span>${escapeHtml(item.evidence)}</span></div>${item.recommendation ? `<div class="real-finding-fix"><strong>Suggested next step</strong><span>${escapeHtml(item.recommendation)}</span></div>` : ""}${item.link ? `<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">Open source location ↗</a>` : ""}</article>`).join("");
    const summaryCount = result.error ? "—" : `${count.toLocaleString()} observation${count === 1 ? "" : "s"}`;
    const emptyState = result.error ? "" : `<div class="scan-empty success"><span class="issue-empty-icon">✓</span><p>No matching patterns were detected in the inspected source. This is not proof that the source is secure.</p></div>`;
    scanResults.innerHTML = `<div class="scan-summary"><strong>${summaryCount}</strong><span>${result.kind === "website-blocked" ? "No target data was available to inspect." : "Derived from the selected source; no values were invented."}</span></div>${findings || emptyState}${notes ? `<div class="scan-notes"><strong>Scan notes</strong><ul>${notes}</ul></div>` : ""}`;
    renderLiveReport(result);
  };

  const scanConfig = () => {
    const authorized = $("#hero-authorized");
    if (!authorized?.checked) throw new Error("Confirm that you own the target or have explicit authorization before scanning.");
    if (activeSource === "website") {
      const value = $("#hero-url")?.value.trim() || "";
      try { const parsed = new URL(value); if (!/^https?:$/.test(parsed.protocol)) throw new Error(); } catch { throw new Error("Enter a valid http or https website URL."); }
      return { mode: "website", value };
    }
    if (activeSource === "repository") return { mode: "repository", value: $("#repo-url")?.value.trim() || "" };
    if (!selectedFiles.length) throw new Error("Choose at least one file or a folder to scan locally.");
    return { mode: "files", files: selectedFiles };
  };

  const startScan = async (config) => {
    if (scanRunning) return;
    scanRunning = true;
    resetStages();
    if (demoScanButton) { demoScanButton.disabled = true; demoScanButton.textContent = "Scanning…"; }
    if (scanResults) scanResults.innerHTML = `<div class="scan-empty"><span class="loader-dot"></span><p>Running safe checks against the selected source…</p></div>`;
    if (reportEmpty && reportLive) { reportEmpty.hidden = false; reportLive.hidden = true; }
    if (demoTarget) demoTarget.textContent = config.mode === "website" ? new URL(config.value).origin : config.mode === "repository" ? config.value : `${config.files.length.toLocaleString()} local file${config.files.length === 1 ? "" : "s"}`;
    if (scanStatus) scanStatus.textContent = "Preparing scan…";
    try {
      setStage(0);
      if (scanStatus) scanStatus.textContent = "Authorization confirmed; preparing source…";
      setStage(1);
      if (scanStatus) scanStatus.textContent = "Reading selected source…";
      const result = config.mode === "website" ? await scanWebsite(config.value) : config.mode === "repository" ? await scanGithubRepository(config.value) : await scanLocalFiles(config.files);
      setStage(2);
      if (scanStatus) scanStatus.textContent = "Safe checks completed against the source.";
      setStage(3);
      if (scanStatus) scanStatus.textContent = "Redacting sensitive evidence…";
      setStage(4);
      if (scanStatus) scanStatus.textContent = "Building source-derived results…";
      renderScanResults(result);
      setStage(stages.length, "done");
      if (scanStatus) scanStatus.textContent = `Complete · ${result.label}`;
      if (scanPercent) scanPercent.textContent = "100%";
      if (progress) progress.style.width = "100%";
      showToast(`${result.error ? "No readable target data" : `${result.findings.length.toLocaleString()} source-derived observation${result.findings.length === 1 ? "" : "s"}`} returned.`);
    } catch (error) {
      setStage(activeStageIndex < 0 ? 0 : activeStageIndex, "error");
      if (scanStatus) scanStatus.textContent = "Scan stopped · no result was created";
      if (scanResults) scanResults.innerHTML = `<div class="issue-empty"><strong>Scan could not start.</strong><p>${escapeHtml(error.message || "Check the source and try again.")}</p></div>`;
      if (demoScore) demoScore.textContent = "—";
      showToast(error.message || "Scan could not start.");
    } finally {
      scanRunning = false;
      if (demoScanButton) { demoScanButton.disabled = false; demoScanButton.innerHTML = "Run selected scan <span aria-hidden=\"true\">→</span>"; }
    }
  };

  heroForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    $("#hero-url-error").textContent = "";
    $("#hero-auth-error").textContent = "";
    let config;
    try { config = scanConfig(); } catch (error) {
      if (error.message.includes("authorization")) $("#hero-auth-error").textContent = error.message;
      else $("#hero-url-error").textContent = error.message;
      return;
    }
    $("#scan-demo")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => startScan(config), 350);
  });
  demoScanButton?.addEventListener("click", () => {
    try { startScan(scanConfig()); } catch (error) { showToast(error.message); }
  });

  // Auth modal: forms validate locally and explicitly tell users no account is created here.
  const modal = $("#auth-modal");
  let lastFocusedElement;
  const setAuthTab = (tab) => {
    $$(".auth-tab").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
    $$(".auth-panel").forEach((panel) => panel.classList.toggle("active", panel.id === `${tab}-panel`));
  };
  const openAuth = (tab = "signin") => {
    if (!modal) return;
    lastFocusedElement = document.activeElement;
    setAuthTab(tab);
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    window.setTimeout(() => $("input", $(`#${tab}-panel`))?.focus(), 60);
  };
  const closeAuth = () => {
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    lastFocusedElement?.focus?.();
  };
  $$(".auth-trigger").forEach((trigger) => trigger.addEventListener("click", () => openAuth(trigger.dataset.auth || "signin")));
  $$(".auth-tab").forEach((tab) => tab.addEventListener("click", () => setAuthTab(tab.dataset.tab)));
  $(".modal-close")?.addEventListener("click", closeAuth);
  modal?.addEventListener("click", (event) => { if (event.target === modal) closeAuth(); });
  $$(".auth-form").filter((form) => form.id !== "project-form").forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const feedback = $(".form-feedback", form);
    const inputs = $$('input:not([type="checkbox"])', form);
    const invalid = inputs.find((input) => !input.checkValidity());
    if (invalid) {
      feedback.textContent = invalid.type === "email" ? "Use a valid email address to continue." : "Please complete the required fields.";
      invalid.focus();
      return;
    }
    if (form.dataset.form === "signup" && $("#signup-password").value !== $("#signup-confirm").value) {
      feedback.textContent = "Passwords do not match.";
      $("#signup-confirm").focus();
      return;
    }
    if (form.dataset.form === "signup" && !$("#signup-terms").checked) {
      feedback.textContent = "Please confirm authorized use before creating an account.";
      return;
    }
    feedback.textContent = "Contacting the local API…";
    try {
      const endpoint = form.dataset.form === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const body = form.dataset.form === "signup"
        ? { name: $("#signup-name").value.trim(), email: $("#signup-email").value.trim(), password: $("#signup-password").value }
        : { email: $("#signin-email").value.trim(), password: $("#signin-password").value };
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "The API rejected the request.");
      if (payload.token) localStorage.setItem("breachai_session", payload.token);
      feedback.textContent = form.dataset.form === "signup" ? "Account created. You can now run authorized scans." : "Signed in. Your scan requests will be associated with this session.";
      showToast(feedback.textContent);
      window.setTimeout(closeAuth, 1100);
    } catch (error) {
      feedback.textContent = error.message || "The API is unavailable. No account was created.";
    }
  }));
  $(".forgot-link")?.addEventListener("click", (event) => { event.preventDefault(); showToast("No password reset is wired to this static demo."); });

  // Project form is frontend-only persistence, but it can start the real safe scan.
  const projectModal = $("#project-modal");
  let lastProjectTrigger;
  const openProject = () => {
    if (!projectModal) return;
    lastProjectTrigger = document.activeElement;
    projectModal.classList.add("open");
    projectModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    window.setTimeout(() => $("#project-name")?.focus(), 60);
  };
  const closeProject = () => {
    if (!projectModal) return;
    projectModal.classList.remove("open");
    projectModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    lastProjectTrigger?.focus?.();
  };
  $$(".project-trigger").forEach((trigger) => trigger.addEventListener("click", openProject));
  $(".project-close")?.addEventListener("click", closeProject);
  projectModal?.addEventListener("click", (event) => { if (event.target === projectModal) closeProject(); });
  $("#project-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const feedback = $(".form-feedback", form);
    const name = $("#project-name");
    const url = $("#project-url");
    const environment = $("#project-environment");
    const authorized = $("#project-authorized");
    feedback.textContent = "";
    if (!name.checkValidity() || !url.checkValidity() || !environment.value) {
      feedback.textContent = "Complete the project name, valid URL and environment.";
      (!name.checkValidity() ? name : !url.checkValidity() ? url : environment).focus();
      return;
    }
    try {
      const parsed = new URL(url.value.trim());
      if (!/^https?:$/.test(parsed.protocol)) throw new Error("invalid");
    } catch {
      feedback.textContent = "Use a valid http or https website URL.";
      url.focus();
      return;
    }
    if (!authorized.checked) {
      feedback.textContent = "Authorization confirmation is required before an assessment.";
      authorized.focus();
      return;
    }
    feedback.textContent = "Project form complete — no project was stored; starting a safe scan.";
    showToast("No project was stored. Starting the authorized passive scan.");
    window.setTimeout(() => {
      closeProject();
      setSource("website");
      $("#hero-url").value = url.value.trim();
      $("#hero-authorized").checked = true;
      $("#scan-demo")?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => startScan({ mode: "website", value: url.value.trim() }), 500);
    }, 900);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (modal?.classList.contains("open")) closeAuth();
    if (projectModal?.classList.contains("open")) closeProject();
  });
})();
