(function () {
  "use strict";

  /* ============================================================
     CONFIGURATION
     Insert your deployed Google Apps Script Web App URL below.
     Until this is set, authentication and analytics fetching
     will correctly report "not configured" rather than faking
     a signed-in state.
     ============================================================ */
  const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby8WjKxINGFwrURBmbtNkpE6R6W_rMpkoLPQ42rdg61jkZQOTHEE4mKu_Zex-QRbIprDg/exec";

  /* ============================================================
     DATA MODEL — mirrors the "DailyStats" Google Sheet exactly.
     One row per date. All aggregation happens client-side from
     this row set, so no separate weekly/monthly/yearly sheets
     are required.
     ============================================================ */
  const QR_TYPES = [
    { key: "URL", label: "URL" },
    { key: "Text", label: "Text" },
    { key: "WiFi", label: "WiFi" },
    { key: "vCard", label: "vCard" },
    { key: "Email", label: "Email" },
    { key: "Phone", label: "Phone" },
    { key: "SMS", label: "SMS" },
    { key: "WhatsApp", label: "WhatsApp" },
    { key: "Location", label: "Location" },
    { key: "SocialMedia", label: "Social Media" },
    { key: "Event", label: "Event" },
    { key: "YouTube", label: "YouTube" },
    { key: "Instagram", label: "Instagram" },
    { key: "AppLinks", label: "App Links" }
  ];
  const DAILYSTATS_FIELDS = [
    "Date", "Visitors", "PageViews", "QRGenerated",
    ...QR_TYPES.map(t => t.key),
    "PNGDownloads", "SVGDownloads", "PDFDownloads"
  ];

  /* App state (in-memory; auth token kept in sessionStorage only) */
  const state = {
    authenticated: false,
    token: null,
    dailyStats: [],           // raw rows from DailyStats
    period: "all",
    customStart: null,
    customEnd: null,
    charts: {},
    loadingAnalytics: false
  };

  /* ---------------- DOM shortcuts ---------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const loginScreen = $("#login-screen");
  const loginForm = $("#login-form");
  const loginMsgBox = $("#login-message");
  const loginBtn = $("#login-btn");
  const loginBtnLabel = $("#login-btn-label");
  const dashboard = $("#dashboard");
  const dashLoading = $("#dash-loading");
  const dashLoadingText = $("#dash-loading-text");
  const bannerArea = $("#banner-area");
  const sessionModal = $("#session-modal");

  /* ============================================================
     THEME
     ============================================================ */
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const icon = $("#theme-icon");
    icon.innerHTML = theme === "dark"
      ? '<path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36A5.4 5.4 0 0 1 12 3Z"/>'
      : '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
    try { localStorage.setItem("qrmade_theme", theme); } catch (e) { }
  }
  (function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem("qrmade_theme"); } catch (e) { }
    const preferred = saved || (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    applyTheme(preferred);
  })();
  $("#theme-toggle").addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark");
    if (state.dailyStats.length) renderCharts(getFilteredRows()); // re-theme gridlines
  });

  /* ============================================================
     ICONS (inline, single sprite set — no external icon deps)
     ============================================================ */
  const ICONS = {
    visitors: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    pageviews: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>',
    qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM19 14h2v2h-2zM14 19h2v2h-2zM19 19h2v2h-2z"/></svg>',
    downloads: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    png: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"/></svg>',
    pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 3v18h18"/><path d="m18 9-5 5-4-4-4 4"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/></svg>',
    warn: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/></svg>',
    x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>'
  };

  /* ============================================================
     AUTHENTICATION
     Talks to a Google Apps Script Web App which checks the
     Admin sheet (Username / PasswordHash). Credentials never
     touch this file — only the network request does.
     ============================================================ */
  function setLoginMessage(kind, text) {
    if (!kind) { loginMsgBox.innerHTML = ""; return; }
    loginMsgBox.innerHTML = `
    <div class="form-msg ${kind}">
      ${ICONS.warn}
      <span>${text}</span>
    </div>`;
  }
  function setLoginLoading(isLoading) {
    loginBtn.disabled = isLoading;
    loginBtnLabel.innerHTML = isLoading ? '<span class="spinner"></span> Verifying…' : "Log in";
  }

  async function requestLogin(username, password) {
    if (!APPS_SCRIPT_URL) {
      return { ok: false, kind: "warn", message: "Analytics service isn't connected yet. Add your Apps Script URL to APPS_SCRIPT_URL to enable sign-in." };
    }
    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" }, // avoids CORS preflight against Apps Script
        body: JSON.stringify({ action: "login", username, password })
      });
      if (!res.ok) throw new Error("bad_status");
      const data = await res.json();
      if (data && data.success && data.token) {
        return { ok: true, token: data.token };
      }
      return { ok: false, kind: "error", message: "Invalid username or password." };
    } catch (err) {
      console.error("Login request failed:", err);
      return { ok: false, kind: "error", message: "Network error. Check your connection and try again." };
    }
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setLoginMessage(null);
    const username = $("#username").value.trim();
    const password = $("#password").value;
    if (!username || !password) {
      setLoginMessage("error", "Enter both a username and a password.");
      return;
    }
    setLoginLoading(true);
    const result = await requestLogin(username, password);
    setLoginLoading(false);

    if (result.ok) {
      state.authenticated = true;
      state.token = result.token;
      try { sessionStorage.setItem("qrmade_session", result.token); } catch (e) { }
      enterDashboard();
    } else {
      setLoginMessage(result.kind, result.message);
    }
  });

  function enterDashboard() {
    loginScreen.classList.add("hidden");
    dashboard.classList.remove("hidden");
    buildEmptyStatCards();
    fetchAnalytics();
  }

  function logout() {
    state.authenticated = false;
    state.token = null;
    try { sessionStorage.removeItem("qrmade_session"); } catch (e) { }
    Object.values(state.charts).forEach(c => c && c.destroy());
    state.charts = {};
    state.dailyStats = [];
    loginForm.reset();
    setLoginMessage(null);
    dashboard.classList.add("hidden");
    loginScreen.classList.remove("hidden");
  }
  $("#logout-btn").addEventListener("click", logout);
  $("#session-modal-btn").addEventListener("click", () => {
    sessionModal.classList.add("hidden");
    logout();
  });

  function showSessionExpired() {
    sessionModal.classList.remove("hidden");
  }

  /* ============================================================
     ANALYTICS FETCH
     Pulls the DailyStats rows from Apps Script. Until configured,
     the dashboard shows honest zero/empty states — never fake data.
     ============================================================ */
  async function fetchAnalytics() {
    dashLoading.classList.remove("hidden");
    dashLoadingText.textContent = "Loading analytics…";
    bannerArea.innerHTML = "";

    if (!APPS_SCRIPT_URL) {
      dashLoading.classList.add("hidden");
      showBanner("warn", "Analytics unavailable — the Google Apps Script connection hasn't been configured yet.");
      state.dailyStats = [];
      applyPeriod("all");
      return;
    }

    // ---- DEBUG INSTRUMENTATION (safe to delete once the connection is confirmed working) ----
    // Opens DevTools → Console will show the exact request/response at every step,
    // so a mismatch is visible immediately instead of silently turning into "0".
    const debugUrl = `${APPS_SCRIPT_URL}?action=analytics&token=${encodeURIComponent(state.token || "")}`;
    console.log("[QRMade DEBUG] Requesting analytics:", debugUrl);

    try {
      const res = await fetch(debugUrl);
      console.log("[QRMade DEBUG] HTTP status:", res.status, res.statusText);
      if (!res.ok) throw new Error("bad_status_" + res.status);

      const rawText = await res.text();
      console.log("[QRMade DEBUG] Raw response body:", rawText);

      let data;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        console.error("[QRMade DEBUG] Response was not valid JSON. This usually means the Apps Script threw an" +
          " error and returned an HTML error page instead of JSON (check Apps Script → Executions for the stack trace).");
        throw new Error("invalid_json");
      }
      console.log("[QRMade DEBUG] Parsed JSON:", data);

      // Apps Script web apps always answer with HTTP 200 on a successful
      // execution — they cannot send a 401 status. Expired/invalid sessions
      // are signalled in the JSON body instead (success:false, code:401).
      if (data && data.success === false && data.code === 401) {
        console.warn("[QRMade DEBUG] Backend reports session expired/invalid (success:false, code:401).");
        dashLoading.classList.add("hidden");
        showSessionExpired();
        return;
      }
      if (data && data.success === false) {
        console.error("[QRMade DEBUG] Backend returned success:false —", data.message || "(no message field)");
        throw new Error(data.message || "analytics_error");
      }

      // Tolerant extraction: the row array may be returned under different keys
      // depending on which backend is actually deployed. Try the documented key
      // first, then the common alternates, and log clearly if none match so a
      // key-name mismatch is never mistaken for "no data".
      let rawRows = data && (data.rows || data.dailyStats || data.DailyStats || data.data);
      if (!rawRows && Array.isArray(data)) rawRows = data; // backend returned a bare array
      if (!Array.isArray(rawRows)) {
        if (data && typeof data === "object") {
          console.error("[QRMade DEBUG] No row array found under rows/dailyStats/DailyStats/data. " +
            "Actual top-level keys returned by the backend:", Object.keys(data));
        }
        rawRows = [];
      } else {
        console.log(`[QRMade DEBUG] Found ${rawRows.length} row(s) before normalization:`, rawRows);
      }

      const rows = rawRows.map(normalizeRow);
      console.log("[QRMade DEBUG] Rows after normalization:", rows);
      const debugTotals = computeTotals(rows);
      console.log("[QRMade DEBUG] Computed All-Time totals:", debugTotals);

      state.dailyStats = rows;
      if (rows.length === 0) {
        showBanner("warn", "No analytics data is available for this account yet.");
      }
    } catch (err) {
      console.error("[QRMade DEBUG] Analytics request failed with an exception:", err);
      showBanner("error", "Network error while loading analytics. Showing the last known state.");
    } finally {
      dashLoading.classList.add("hidden");
      applyPeriod(state.period);
    }
  }

  function normalizeRow(raw) {
    const row = {};
    DAILYSTATS_FIELDS.forEach(f => { row[f] = f === "Date" ? raw[f] : Number(raw[f]) || 0; });
    return row;
  }

  function showBanner(kind, message) {
    bannerArea.innerHTML = `
    <div class="banner ${kind}">
      ${ICONS.warn}
      <span>${message}</span>
      <button class="dismiss" aria-label="Dismiss">${ICONS.x}</button>
    </div>`;
    $(".banner .dismiss", bannerArea).addEventListener("click", () => bannerArea.innerHTML = "");
  }

  /* ============================================================
     DATE FILTER
     ============================================================ */
  const filterBtn = $("#filter-btn");
  const filterMenu = $("#filter-menu");
  const filterBtnLabel = $("#filter-btn-label");
  const rangeLabel = $("#range-label");
  const customBox = $("#custom-range-box");

  filterBtn.addEventListener("click", () => {
    const open = !filterMenu.classList.contains("hidden");
    filterMenu.classList.toggle("hidden");
    filterBtn.setAttribute("aria-expanded", String(!open));
  });
  document.addEventListener("click", (e) => {
    if (!$("#filter-wrap").contains(e.target)) {
      filterMenu.classList.add("hidden");
      filterBtn.setAttribute("aria-expanded", "false");
    }
  });
  $$("#filter-menu button[data-period]").forEach(btn => {
    btn.addEventListener("click", () => {
      const period = btn.dataset.period;
      if (period === "custom") {
        customBox.classList.toggle("hidden");
        return;
      }
      $$("#filter-menu button[data-period]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      customBox.classList.add("hidden");
      filterMenu.classList.add("hidden");
      applyPeriod(period);
    });
  });
  $("#apply-range").addEventListener("click", () => {
    const start = $("#range-start").value;
    const end = $("#range-end").value;
    if (!start || !end || start > end) {
      showBanner("error", "Choose a valid start and end date for the custom range.");
      return;
    }
    state.customStart = start;
    state.customEnd = end;
    $$("#filter-menu button[data-period]").forEach(b => b.classList.remove("active"));
    filterMenu.classList.add("hidden");
    applyPeriod("custom");
  });

  const PERIOD_LABELS = {
    today: "Today", "7d": "Last 7 Days", "30d": "Last 30 Days",
    month: "This Month", year: "This Year", all: "All Time", custom: "Custom Range"
  };

  function applyPeriod(period) {
    state.period = period;
    const label = period === "custom" && state.customStart
      ? `${state.customStart} → ${state.customEnd}`
      : PERIOD_LABELS[period];
    filterBtnLabel.textContent = label;
    rangeLabel.textContent = label;
    renderAll(getFilteredRows());
  }

  function parseDate(d) { return new Date(d + "T00:00:00"); }

  function getFilteredRows() {
    const rows = state.dailyStats;
    if (rows.length === 0) return [];
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    switch (state.period) {
      case "today":
        return rows.filter(r => r.Date === todayStr);
      case "7d": {
        const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 6);
        return rows.filter(r => parseDate(r.Date) >= cutoff);
      }
      case "30d": {
        const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 29);
        return rows.filter(r => parseDate(r.Date) >= cutoff);
      }
      case "month":
        return rows.filter(r => {
          const d = parseDate(r.Date);
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        });
      case "year":
        return rows.filter(r => parseDate(r.Date).getFullYear() === now.getFullYear());
      case "custom":
        if (!state.customStart || !state.customEnd) return rows;
        return rows.filter(r => r.Date >= state.customStart && r.Date <= state.customEnd);
      case "all":
      default:
        return rows.slice();
    }
  }

  /* ============================================================
     AGGREGATION
     ============================================================ */
  function computeTotals(rows) {
    const totals = { Visitors: 0, PageViews: 0, QRGenerated: 0, PNGDownloads: 0, SVGDownloads: 0, PDFDownloads: 0 };
    QR_TYPES.forEach(t => totals[t.key] = 0);
    rows.forEach(r => {
      totals.Visitors += r.Visitors || 0;
      totals.PageViews += r.PageViews || 0;
      totals.QRGenerated += r.QRGenerated || 0;
      totals.PNGDownloads += r.PNGDownloads || 0;
      totals.SVGDownloads += r.SVGDownloads || 0;
      totals.PDFDownloads += r.PDFDownloads || 0;
      QR_TYPES.forEach(t => totals[t.key] += r[t.key] || 0);
    });
    totals.TotalDownloads = totals.PNGDownloads + totals.SVGDownloads + totals.PDFDownloads;
    return totals;
  }

  /* ============================================================
     RENDER — STAT CARDS
     ============================================================ */
  const STAT_DEFS = [
    { key: "Visitors", label: "Total Visitors", icon: "visitors" },
    { key: "PageViews", label: "Total Page Views", icon: "pageviews" },
    { key: "QRGenerated", label: "Total QR Generated", icon: "qr" },
    { key: "TotalDownloads", label: "Total Downloads", icon: "downloads" }
  ];
  const DL_DEFS = [
    { key: "PNGDownloads", label: "PNG Downloads", icon: "png", cls: "png" },
    { key: "SVGDownloads", label: "SVG Downloads", icon: "svg", cls: "svg" },
    { key: "PDFDownloads", label: "PDF Downloads", icon: "pdf", cls: "pdf" }
  ];

  /* Symbol glyphs for the 14 QR-type mini-cards */
  const QR_TYPE_ICONS = {
    URL: '↗', Text: 'T', WiFi: '⌁', vCard: '♙', Email: '@',
    Phone: '☎', SMS: '✉', WhatsApp: '◉', Location: '⌖',
    SocialMedia: '◎', Event: '◷', YouTube: '▶', Instagram: '◌', AppLinks: '▣'
  };

  function buildEmptyStatCards() {
    const grid = $("#stat-grid");
    grid.innerHTML = STAT_DEFS.map(d => `
    <div class="card metric-box stat-card">
      <div class="stat-top">
        <div class="stat-icon">${ICONS[d.icon]}</div>
        <span class="trend flat">—</span>
      </div>
      <div class="stat-value skel" style="width:60px; height:18px;">&nbsp;</div>
      <div class="stat-label">${d.label}</div>
    </div>`).join("");
    const dlGrid = $("#dl-grid");
    dlGrid.innerHTML = DL_DEFS.map(d => `
    <div class="card metric-box dl-card">
      <div class="dl-top">
        <div class="dl-icon ${d.cls}">${ICONS[d.icon]}</div>
      </div>
      <div class="dl-val skel" style="width:42px; height:15px;">&nbsp;</div>
      <div class="dl-lbl">${d.label}</div>
    </div>`).join("");
    buildEmptyQrTypeCards();
  }

  function buildEmptyQrTypeCards() {
    const grid = $("#qr-type-grid");
    if (!grid) return;
    grid.innerHTML = QR_TYPES.map(t => `
    <div class="card metric-box qr-type-card">
      <div class="qrt-icon">${QR_TYPE_ICONS[t.key] || '▦'}</div>
      <div class="qrt-val skel" style="width:34px; height:15px;">&nbsp;</div>
      <div class="qrt-lbl">${t.label}</div>
    </div>`).join("");
  }

  function renderStats(totals) {
    const grid = $("#stat-grid");
    grid.innerHTML = STAT_DEFS.map(d => `
    <div class="card metric-box stat-card">
      <div class="stat-top">
        <div class="stat-icon">${ICONS[d.icon]}</div>
        <span class="trend flat">${state.period === "all" ? "ALL" : PERIOD_LABELS[state.period].toUpperCase()}</span>
      </div>
      <div class="stat-value">${totals[d.key].toLocaleString()}</div>
      <div class="stat-label">${d.label}</div>
    </div>`).join("");

    const dlGrid = $("#dl-grid");
    dlGrid.innerHTML = DL_DEFS.map(d => `
    <div class="card metric-box dl-card">
      <div class="dl-top">
        <div class="dl-icon ${d.cls}">${ICONS[d.icon]}</div>
      </div>
      <div class="dl-val">${totals[d.key].toLocaleString()}</div>
      <div class="dl-lbl">${d.label}</div>
    </div>`).join("");
    renderQrTypeCards(totals);
  }

  function renderQrTypeCards(totals) {
    const grid = $("#qr-type-grid");
    if (!grid) return;
    grid.innerHTML = QR_TYPES.map(t => `
    <div class="card metric-box qr-type-card">
      <div class="qrt-icon">${QR_TYPE_ICONS[t.key] || '▦'}</div>
      <div class="qrt-val">${totals[t.key].toLocaleString()}</div>
      <div class="qrt-lbl">${t.label}</div>
    </div>`).join("");
  }

  /* ============================================================
     RENDER — QR TYPE RANKING
     ============================================================ */
  function renderRanking(totals) {
    const total = totals.QRGenerated || 0;
    const tag = $("#qr-total-tag");
    if (tag) tag.textContent = `${total.toLocaleString()} total`;
    const card = $("#rank-card");
    if (card) card.innerHTML = "";
  }

  function palette(i) {
    const colors = ["#00E39B", "#5B8CFF", "#FFA53D", "#FF5470", "#B78BFF", "#3FD6E0", "#F2C94C", "#6FCF97", "#F27FA8", "#8AB6FF", "#E0A458", "#61D9C4", "#C77DFF", "#9AE66E"];
    return colors[i % colors.length];
  }

  /* ============================================================
     RENDER — CHARTS
     ============================================================ */
  function chartTheme() {
    const styles = getComputedStyle(document.documentElement);
    return {
      grid: styles.getPropertyValue("--border").trim(),
      text: styles.getPropertyValue("--text-muted").trim(),
      font: "'Inter', sans-serif"
    };
  }
  function baseOptions(extra = {}) {
    const t = chartTheme();
    return Object.assign({
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false }, tooltip: {
          backgroundColor: getComputedStyle(document.documentElement).getPropertyValue("--surface-2").trim(),
          titleColor: t.text, bodyColor: t.text, borderColor: t.grid, borderWidth: 1, padding: 10, cornerRadius: 8, displayColors: false
        }
      },
      scales: {
        x: { grid: { color: "transparent" }, ticks: { color: t.text, font: { size: 8 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 4 } },
        y: { grid: { color: t.grid }, ticks: { color: t.text, font: { size: 8 }, maxTicksLimit: 4 }, beginAtZero: true }
      }
    }, extra);
  }

  function toggleChartEmpty(id, isEmpty) {
    $(`#${id}`).classList.toggle("hidden", !isEmpty);
    $(`#${id}`).previousElementSibling.style.visibility = isEmpty ? "hidden" : "visible";
  }

  function renderCharts(rows) {
    const t = chartTheme();
    const labels = rows.map(r => r.Date);
    const hasData = rows.length > 0;

    destroyChart("visitorsChart");
    $("#visitors-chart-sub").textContent = hasData ? `${rows.length} day${rows.length > 1 ? "s" : ""}` : "—";
    if (hasData) {
      state.charts.visitorsChart = new Chart($("#visitorsChart"), {
        type: "line",
        data: { labels, datasets: [{ data: rows.map(r => r.Visitors), borderColor: "#00E39B", backgroundColor: "rgba(0,227,155,.12)", fill: true, tension: .35, pointRadius: 0, borderWidth: 2 }] },
        options: baseOptions()
      });
      toggleChartEmpty("visitorsChart-empty", false);
    } else { emptyChartBlock("visitorsChart-empty", "No visitor data for this period"); toggleChartEmpty("visitorsChart-empty", true); }

    destroyChart("pageViewsChart");
    $("#pv-chart-sub").textContent = hasData ? "trend" : "—";
    if (hasData) {
      state.charts.pageViewsChart = new Chart($("#pageViewsChart"), {
        type: "line",
        data: { labels, datasets: [{ data: rows.map(r => r.PageViews), borderColor: "#5B8CFF", backgroundColor: "rgba(91,140,255,.12)", fill: true, tension: .35, pointRadius: 0, borderWidth: 2 }] },
        options: baseOptions()
      });
      toggleChartEmpty("pageViewsChart-empty", false);
    } else { emptyChartBlock("pageViewsChart-empty", "No page view data"); toggleChartEmpty("pageViewsChart-empty", true); }

    destroyChart("qrGenChart");
    $("#qrgen-chart-sub").textContent = hasData ? "trend" : "—";
    if (hasData) {
      state.charts.qrGenChart = new Chart($("#qrGenChart"), {
        type: "bar",
        data: { labels, datasets: [{ data: rows.map(r => r.QRGenerated), backgroundColor: "#FFA53D", borderRadius: 3, maxBarThickness: 12 }] },
        options: baseOptions()
      });
      toggleChartEmpty("qrGenChart-empty", false);
    } else { emptyChartBlock("qrGenChart-empty", "No QR generation data"); toggleChartEmpty("qrGenChart-empty", true); }

    const totals = computeTotals(rows);
    destroyChart("typeDistChart");
    const distValues = QR_TYPES.map(qt => totals[qt.key]);
    const distHasData = distValues.some(v => v > 0);
    $("#dist-chart-sub").textContent = distHasData ? `${QR_TYPES.length} types` : "—";
    if (distHasData) {
      state.charts.typeDistChart = new Chart($("#typeDistChart"), {
        type: "doughnut",
        data: { labels: QR_TYPES.map(q => q.label), datasets: [{ data: distValues, backgroundColor: QR_TYPES.map((_, i) => palette(i)), borderWidth: 0 }] },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: "55%",
          plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: getComputedStyle(document.documentElement).getPropertyValue("--surface-2").trim(), titleColor: t.text, bodyColor: t.text, borderColor: t.grid, borderWidth: 1, padding: 10, cornerRadius: 8 }
          }
        }
      });
      toggleChartEmpty("typeDistChart-empty", false);
    } else { emptyChartBlock("typeDistChart-empty", "No QR type data yet"); toggleChartEmpty("typeDistChart-empty", true); }

    destroyChart("downloadsChart");
    const dlValues = [totals.PNGDownloads, totals.SVGDownloads, totals.PDFDownloads];
    const dlHasData = dlValues.some(v => v > 0);
    if (dlHasData) {
      state.charts.downloadsChart = new Chart($("#downloadsChart"), {
        type: "bar",
        data: { labels: ["PNG", "SVG", "PDF"], datasets: [{ data: dlValues, backgroundColor: ["#5B8CFF", "#00E39B", "#FF5470"], borderRadius: 4, maxBarThickness: 18 }] },
        options: baseOptions({ scales: { x: { grid: { color: "transparent" }, ticks: { color: t.text } }, y: { grid: { color: t.grid }, ticks: { color: t.text }, beginAtZero: true } } })
      });
      toggleChartEmpty("downloadsChart-empty", false);
    } else { emptyChartBlock("downloadsChart-empty", "No downloads recorded"); toggleChartEmpty("downloadsChart-empty", true); }
  }

  function emptyChartBlock(id, text) {
    $(`#${id}`).innerHTML = `<span>${text}</span>`;
  }
  function destroyChart(key) {
    if (state.charts[key]) { state.charts[key].destroy(); delete state.charts[key]; }
  }

  /* ============================================================
     RENDER ALL
     ============================================================ */
  function renderAll(rows) {
    const totals = computeTotals(rows);
    renderStats(totals);
    renderRanking(totals);
    renderCharts(rows);
  }

  /* ============================================================
     INIT
     Session persistence: if a token exists from an earlier visit
     in this browser tab, restore the dashboard without requiring
     a fresh login. Any failed/expired token is handled by
     fetchAnalytics() via a 401 → session-expired modal.
     ============================================================ */
  (function init() {
    let existing = null;
    try { existing = sessionStorage.getItem("qrmade_session"); } catch (e) { }
    if (existing && APPS_SCRIPT_URL) {
      state.authenticated = true;
      state.token = existing;
      enterDashboard();
    }
  })();

})();
