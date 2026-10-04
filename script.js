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

  // UI-only scan flow. It never contacts the supplied URL and never produces findings.
  const stages = $$(".scan-stage");
  const progress = $("#scan-progress");
  const scanPercent = $("#scan-percent");
  const scanStatus = $("#scan-status");
  const demoTarget = $("#demo-target");
  const demoScanButton = $("#demo-scan-button");
  let scanRunning = false;
  let scanTimer;
  const startScan = (url = "") => {
    if (scanRunning) return;
    scanRunning = true;
    const cleanUrl = url.trim() ? url.replace(/^https?:\/\//i, "").replace(/\/$/, "") : "No target selected";
    if (demoTarget) demoTarget.textContent = cleanUrl;
    if (demoScanButton) {
      demoScanButton.disabled = true;
      demoScanButton.textContent = "Previewing…";
    }
    stages.forEach((stage) => {
      stage.classList.remove("done", "warning", "running");
      $(".stage-status", stage).textContent = "○";
      $("time", stage).textContent = "--";
    });
    let current = -1;
    const advance = () => {
      if (current >= 0 && stages[current]) {
        const prior = stages[current];
        prior.classList.remove("running");
        prior.classList.add("done");
        $(".stage-status", prior).textContent = "✓";
        $("time", prior).textContent = "done";
      }
      current += 1;
      if (current >= stages.length) {
        window.clearInterval(scanTimer);
        if (progress) progress.style.width = "100%";
        if (scanPercent) scanPercent.textContent = "100%";
        if (scanStatus) scanStatus.textContent = "UI flow complete · no live data generated";
        scanRunning = false;
        if (demoScanButton) {
          demoScanButton.disabled = false;
          demoScanButton.innerHTML = "Preview again <span aria-hidden=\"true\">↻</span>";
        }
        showToast("UI flow complete. No URL was contacted and no findings were created.");
        return;
      }
      const stage = stages[current];
      stage.classList.add("running");
      $(".stage-status", stage).textContent = "◌";
      const percent = Math.round((current / stages.length) * 100);
      if (progress) progress.style.width = `${percent}%`;
      if (scanPercent) scanPercent.textContent = `${percent}%`;
      if (scanStatus) scanStatus.textContent = stage.querySelector("strong")?.textContent || "Previewing…";
    };
    advance();
    scanTimer = window.setInterval(advance, 650);
  };
  demoScanButton?.addEventListener("click", () => startScan(demoTarget?.textContent === "No target selected" ? "" : demoTarget?.textContent || ""));

  const heroForm = $("#hero-scan-form");
  heroForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const url = $("#hero-url");
    const authorized = $("#hero-authorized");
    const urlError = $("#hero-url-error");
    const authError = $("#hero-auth-error");
    urlError.textContent = "";
    authError.textContent = "";
    let valid = true;
    try {
      const parsed = new URL(url.value.trim());
      if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname.includes(".")) throw new Error("invalid");
    } catch {
      urlError.textContent = "Enter a valid http or https website URL.";
      valid = false;
    }
    if (!authorized.checked) {
      authError.textContent = "Please confirm you are authorized to test this website.";
      valid = false;
    }
    if (!valid) return;
    $("#scan-demo")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => startScan(url.value.trim()), 500);
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
  $$(".auth-form").filter((form) => form.id !== "project-form").forEach((form) => form.addEventListener("submit", (event) => {
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
    feedback.textContent = "Frontend demo only — no account was created.";
    showToast(feedback.textContent);
    window.setTimeout(closeAuth, 1100);
  }));
  $(".forgot-link")?.addEventListener("click", (event) => { event.preventDefault(); showToast("No password reset is wired to this static demo."); });

  // Project form is also frontend-only; it only starts the non-networked UI flow.
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
    feedback.textContent = "Frontend demo ready — no project was stored.";
    showToast("No project was stored. Preparing the non-networked UI flow.");
    window.setTimeout(() => {
      closeProject();
      $("#hero-url").value = url.value.trim();
      $("#hero-authorized").checked = true;
      $("#scan-demo")?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => startScan(url.value.trim()), 500);
    }, 900);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (modal?.classList.contains("open")) closeAuth();
    if (projectModal?.classList.contains("open")) closeProject();
  });
})();
