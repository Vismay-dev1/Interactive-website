(() => {
  "use strict";

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  // Keep the experience keyboard-friendly and add a compact mobile navigation.
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

  // Reveal content as it enters the viewport. Reduced motion is handled in CSS.
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

  // Count platform metrics when they first become visible.
  const countMetric = (element) => {
    if (element.dataset.counted === "true") return;
    element.dataset.counted = "true";
    const target = Number(element.dataset.count);
    const suffix = element.querySelector("span")?.outerHTML || "";
    const duration = 900;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.floor(target * eased);
      element.innerHTML = `${value.toLocaleString()}${suffix}`;
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const metricObserver = "IntersectionObserver" in window ? new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        countMetric(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.75 }) : null;
  $$('[data-count]').forEach((metric) => metricObserver ? metricObserver.observe(metric) : countMetric(metric));

  // Lightweight toast notifications for demo-only actions.
  const toast = $("#toast");
  let toastTimeout;
  const showToast = (message) => {
    if (!toast) return;
    $("p", toast).textContent = message;
    toast.classList.add("visible");
    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => toast.classList.remove("visible"), 3800);
  };
  $$(".toast-trigger").forEach((trigger) => trigger.addEventListener("click", () => showToast(trigger.dataset.toast || "Action completed in the demo workspace.")));

  // Scan simulation shared by the hero form and the demo panel.
  const stages = $$(".scan-stage");
  const progress = $("#scan-progress");
  const scanPercent = $("#scan-percent");
  const scanStatus = $("#scan-status");
  const demoTarget = $("#demo-target");
  const demoScore = $("#demo-score");
  const demoScanButton = $("#demo-scan-button");
  let scanRunning = false;
  let scanTimer;

  const resetScan = () => {
    window.clearInterval(scanTimer);
    stages.forEach((stage) => {
      stage.classList.remove("done", "warning", "running");
      $(".stage-status", stage).textContent = "○";
      $("time", stage).textContent = "--";
    });
    if (progress) progress.style.width = "0%";
    if (scanPercent) scanPercent.textContent = "0%";
    if (scanStatus) scanStatus.textContent = "Ready to scan";
    if (demoScore) demoScore.textContent = "—";
    scanRunning = false;
    if (demoScanButton) {
      demoScanButton.disabled = false;
      demoScanButton.innerHTML = "Run demo scan <span aria-hidden=\"true\">→</span>";
    }
  };

  const startScan = (url = "https://example.com") => {
    if (scanRunning) return;
    scanRunning = true;
    const cleanUrl = url.replace(/^https?:\/\//i, "").replace(/\/$/, "") || "example.com";
    if (demoTarget) demoTarget.textContent = cleanUrl;
    if (demoScanButton) {
      demoScanButton.disabled = true;
      demoScanButton.textContent = "Scanning…";
    }
    stages.forEach((stage) => {
      stage.classList.remove("done", "warning", "running");
      $(".stage-status", stage).textContent = "○";
      $("time", stage).textContent = "--";
    });
    let current = -1;
    const total = stages.length;
    const advance = () => {
      if (current >= 0 && stages[current]) {
        const prior = stages[current];
        prior.classList.remove("running");
        const warning = current === 3 || current === 4;
        prior.classList.add(warning ? "warning" : "done");
        $(".stage-status", prior).textContent = warning ? "⚠" : "✓";
        $("time", prior).textContent = `${current + 1}.${current + 2}s`;
      }
      current += 1;
      if (current >= total) {
        window.clearInterval(scanTimer);
        if (progress) progress.style.width = "100%";
        if (scanPercent) scanPercent.textContent = "100%";
        if (scanStatus) scanStatus.textContent = "Assessment complete · demo results ready";
        if (demoScore) demoScore.textContent = "73";
        scanRunning = false;
        if (demoScanButton) {
          demoScanButton.disabled = false;
          demoScanButton.innerHTML = "Run again <span aria-hidden=\"true\">↻</span>";
        }
        showToast("Demo scan complete. Results are illustrative, not a live assessment.");
        return;
      }
      const stage = stages[current];
      stage.classList.add("running");
      $(".stage-status", stage).textContent = "◌";
      const percent = Math.round((current / total) * 100);
      if (progress) progress.style.width = `${percent}%`;
      if (scanPercent) scanPercent.textContent = `${percent}%`;
      if (scanStatus) scanStatus.textContent = stage.querySelector("strong")?.textContent || "Analyzing…";
    };
    advance();
    scanTimer = window.setInterval(advance, 820);
  };

  demoScanButton?.addEventListener("click", () => startScan($("#demo-target")?.textContent ? `https://${$("#demo-target").textContent}` : undefined));

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

  // Expandable vulnerability cards and safe demo action feedback.
  $$(".finding-toggle").forEach((toggle) => toggle.addEventListener("click", () => {
    const card = toggle.closest(".finding-card");
    const expanded = card.classList.toggle("expanded");
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.querySelector("span:not(.sr-only)").textContent = expanded ? "⌃" : "⌄";
  }));
  $$(".review-button").forEach((button) => button.addEventListener("click", () => {
    button.classList.toggle("reviewed");
    button.textContent = button.classList.contains("reviewed") ? "✓ Reviewed" : "Mark as reviewed";
    showToast(button.classList.contains("reviewed") ? "Finding marked as reviewed in the demo." : "Review status reset in the demo.");
  }));
  $$(".evidence-trigger").forEach((button) => button.addEventListener("click", () => showToast("Safe evidence preview opened. Sensitive values are always redacted.")));
  $$(".recommendation-trigger").forEach((button) => button.addEventListener("click", () => showToast("Developer recommendation ready in the demo report.")));

  // Auth modal: both forms are intentionally front-end demo flows.
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
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal?.classList.contains("open")) closeAuth();
  });
  $$(".auth-form").forEach((form) => form.addEventListener("submit", (event) => {
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
    feedback.textContent = form.dataset.form === "signup" ? "Workspace created — welcome to the demo." : "Signed in to the demo workspace.";
    showToast(feedback.textContent);
    window.setTimeout(closeAuth, 1100);
  }));
  $(".forgot-link")?.addEventListener("click", (event) => { event.preventDefault(); showToast("Password reset is available in the full product."); });

  // Project creation is a scoped front-end demo flow. Active testing still requires confirmation.
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
    feedback.textContent = "Project created. Preparing the assessment demo…";
    showToast("Project created. Assessment setup is ready in the demo.");
    window.setTimeout(() => {
      closeProject();
      $("#hero-url").value = url.value.trim();
      $("#hero-authorized").checked = true;
      $("#scan-demo")?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => startScan(url.value.trim()), 500);
    }, 900);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && projectModal?.classList.contains("open")) closeProject();
  });

  // Close or reset compact nav when resizing back to desktop.
  window.addEventListener("resize", () => { if (window.innerWidth > 850) closeMobileNav(); });
})();
