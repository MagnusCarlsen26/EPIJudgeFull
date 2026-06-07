const API_BASE_URL = (window.EPI_CONFIG?.API_BASE_URL || "").replace(/\/$/, "");

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

const api = {
  async get(path) {
    const response = await fetch(apiUrl(path));
    if (!response.ok) throw new Error(await messageFrom(response));
    return response.json();
  },
  async put(path, body) {
    const response = await fetch(apiUrl(path), jsonRequest("PUT", body));
    if (!response.ok) throw new Error(await messageFrom(response));
    return response.json();
  },
  async post(path, body) {
    const response = await fetch(apiUrl(path), jsonRequest("POST", body));
    if (!response.ok) throw new Error(await messageFrom(response));
    return response.json();
  },
};

const cdn = {
  async get(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(await messageFrom(response));
    return response.json();
  },
  async text(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(await messageFrom(response));
    return response.text();
  },
};

function jsonRequest(method, body) {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function messageFrom(response) {
  try {
    const payload = await response.json();
    return payload.error?.message || payload.detail || response.statusText;
  } catch {
    return response.statusText;
  }
}

const rightPanelLayout = {
  defaultWidth: 360,
  minWidth: 240,
  maxWidth: 720,
  resizeBreakpoint: 1120,
};

const SUPPORTED_LANGUAGES = ["python", "cpp", "java"];
const MONACO_LANGUAGES = { python: "python", cpp: "cpp", java: "java" };
const LANGUAGE_LABELS = { python: "Python", cpp: "C++", java: "Java" };

const state = {
  catalogChapters: [],
  chapters: [],
  manifest: null,
  problemState: {},
  problemCards: [],
  problemCardByJudgeId: {},
  language: "python",
  session: {
    lastProblemId: null,
    language: "python",
    filters: { chapter: null, status: "all", query: "" },
    sort: "book_order",
    theme: "system",
    sidebarCollapsed: false,
    rightPanelCollapsed: false,
    rightPanelWidth: rightPanelLayout.defaultWidth,
    problemPanelCollapsed: false,
    expandedChapterIds: [],
  },
  current: null,
  savedCode: "",
  running: false,
  editor: null,
  editorKind: "textarea",
  lastRun: null,
  selectedAttemptId: null,
  autosaveTimer: null,
  autosaveDelayMs: 900,
  saveInFlight: false,
  pendingAutosave: false,
  suppressAutosave: false,
  resetVersion: 0,
};

const storageKeys = {
  session: "epi.session.v2",
  problemState: "epi.problemState.v2",
  codePrefixV2: "epi.code.v2.",
  codePrefixV3: "epi.code.v3.",
};

const el = {};
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

const icons = {
  all: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>`,
  star: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.7 5.47 6.03.88-4.36 4.25 1.03 6-5.4-2.84-5.4 2.84 1.03-6-4.36-4.25 6.03-.88L12 3.5z"/></svg>`,
  starFilled: `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="fill" d="M12 3.5l2.7 5.47 6.03.88-4.36 4.25 1.03 6-5.4-2.84-5.4 2.84 1.03-6-4.36-4.25 6.03-.88L12 3.5z"/></svg>`,
  progress: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v6l4 2"/><path d="M21 12a9 9 0 1 1-3.4-7.04"/></svg>`,
  solved: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 12l2 2 4-5"/><circle cx="12" cy="12" r="9"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.93 4.93l1.41 1.41"/><path d="M17.66 17.66l1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M4.93 19.07l1.41-1.41"/><path d="M17.66 6.34l1.41-1.41"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 9 9 0 1 0 20.5 14.5z"/></svg>`,
  monitor: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8"/><path d="M12 16v4"/></svg>`,
  chevron: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>`,
  run: `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="fill" d="M8 5v14l11-7z"/></svg>`,
  running: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7"/></svg>`,
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindElements();
  renderStaticIcons();
  applyTheme(state.session.theme);
  bindEvents();
  setupRightPanelResize();
  await setupEditor();
  await loadInitialData();
}

function bindElements() {
  for (const id of [
    "appShell", "progressSummary", "searchInput", "statusTabs", "problemList",
    "problemChapter", "problemTitle", "starButton", "dirtyState", "progressBadge",
    "resetViewButton", "runSampleButton", "runButton", "editor", "fallbackEditor", "rightTabs", "runSummary",
    "stdoutBlock", "stderrBlock", "stderrTitle", "notesArea", "saveNotesButton", "historyList",
    "historyCode", "historyCodeHeader", "historyCodeBlock", "toast", "sidebar", "mobileProblems", "themeButton", "sidebarToggle", "sidebarReopen",
    "rightPanel", "rightPanelToggle", "rightPanelReopen", "rightPanelResizeHandle",
    "problemPanel", "problemPanelToggle", "problemPanelBody", "problemSpoilers",
    "languageTabs",
  ]) {
    el[id] = document.getElementById(id);
  }
}

function bindEvents() {
  el.searchInput.addEventListener("input", () => updateFilters({ query: el.searchInput.value }));
  el.statusTabs.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-status]");
    if (!button) return;
    updateFilters({ status: button.dataset.status });
  });
  el.languageTabs.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-language]");
    if (!button) return;
    switchLanguage(button.dataset.language);
  });
  el.rightTabs.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-tab]");
    if (button) setTab(button.dataset.tab);
  });
  el.runSampleButton.addEventListener("click", () => runTests("sample"));
  el.runButton.addEventListener("click", () => runTests("all"));
  el.resetViewButton.addEventListener("click", resetEditorView);
  el.starButton.addEventListener("click", toggleStar);
  el.saveNotesButton.addEventListener("click", saveNotes);
  el.mobileProblems.addEventListener("click", () => {
    el.sidebar.classList.add("open");
    setSidebarCollapsed(false, { persist: false });
  });
  el.sidebarToggle.addEventListener("click", () => setSidebarCollapsed(!state.session.sidebarCollapsed));
  el.sidebarReopen.addEventListener("click", () => setSidebarCollapsed(false));
  el.rightPanelToggle.addEventListener("click", () => setRightPanelCollapsed(!state.session.rightPanelCollapsed));
  el.rightPanelReopen.addEventListener("click", () => setRightPanelCollapsed(false));
  el.problemPanelToggle.addEventListener("click", () => setProblemPanelCollapsed(!state.session.problemPanelCollapsed));
  el.themeButton.addEventListener("click", cycleTheme);
  systemTheme.addEventListener("change", () => {
    if (state.session.theme === "system") applyTheme("system");
  });
  document.addEventListener("keydown", (event) => {
    const mod = event.ctrlKey || event.metaKey;
    if (!mod || !state.current) return;
    if (event.key.toLowerCase() === "s") {
      event.preventDefault();
      runAutosave();
    }
    if (event.key === "Enter") {
      event.preventDefault();
      runTests("all");
    }
  });
  window.addEventListener("beforeunload", (event) => {
    if (isDirty()) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
}

async function loadInitialData() {
  try {
    const manifest = await cdn.get("/data/manifest.json");
    const problems = await cdn.get(manifest.problems);
    state.manifest = manifest;
    state.problemState = migrateProblemState(readJson(storageKeys.problemState, {}));
    state.session = normalizeSession(readJson(storageKeys.session, state.session));
    state.language = SUPPORTED_LANGUAGES.includes(state.session.language) ? state.session.language : "python";
    state.session.language = state.language;
    state.catalogChapters = problems.chapters;
    refreshChapters();
    await loadProblemCards(manifest);
    setMonacoLanguage(state.language);
    syncLanguageControls();
    applyTheme(state.session.theme);
    applySidebarState();
    applyRightPanelState();
    applyRightPanelWidth();
    applyProblemPanelState();
    migrateChapterFilter();
    initializeExpandedChapters();
    syncFilterControls();
    renderProblemList();
    const first = findProblem(state.session.lastProblemId) || firstProblem();
    if (first) await openProblem(first.id, { force: true });
    persistSession();
  } catch (error) {
    showToast(error.message);
  }
}

async function setupEditor() {
  el.fallbackEditor.addEventListener("input", updateDirtyState);
  try {
    await loadMonaco();
    state.editor = monaco.editor.create(el.editor, {
      value: "",
      language: "python",
      theme: document.documentElement.dataset.theme === "dark" ? "vs-dark" : "vs",
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      lineHeight: 21,
      scrollBeyondLastLine: false,
      tabSize: 4,
      insertSpaces: true,
    });
    state.editor.onDidChangeModelContent(updateDirtyState);
    state.editorKind = "monaco";
  } catch {
    el.editor.style.display = "none";
    el.fallbackEditor.style.display = "block";
    state.editor = {
      getValue: () => el.fallbackEditor.value,
      setValue: (value) => { el.fallbackEditor.value = value; },
      focus: () => el.fallbackEditor.focus(),
      setPosition: () => {},
    };
    state.editorKind = "textarea";
  }
}

function loadMonaco() {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/monaco-editor@0.49.0/min/vs/loader.js";
    script.onload = () => {
      window.require.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.49.0/min/vs" } });
      window.require(["vs/editor/editor.main"], resolve, reject);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function renderProblemList() {
  const filtered = filteredChapters();
  const all = state.chapters.flatMap((chapter) => chapter.problems);
  const solved = all.filter((problem) => problem.status === "solved").length;
  el.progressSummary.textContent = `${solved} / ${all.length} solved`;
  el.problemList.innerHTML = filtered.map(renderChapter).join("") || `<div class="muted">No problems match.</div>`;
  el.problemList.querySelectorAll("[data-chapter-id]").forEach((button) => {
    button.addEventListener("click", () => toggleChapter(button.dataset.chapterId));
  });
  el.problemList.querySelectorAll("[data-problem-id]").forEach((button) => {
    button.addEventListener("click", () => openProblem(button.dataset.problemId));
  });
}

function filteredChapters() {
  const filters = state.session.filters;
  const query = (filters.query || "").trim().toLowerCase();
  return state.chapters
    .map((chapter) => {
      const problems = chapter.problems.filter((problem) => {
        const statusOk = filters.status === "all" ||
          (filters.status === "starred" ? problem.bookmarked : problem.status === filters.status);
        const queryOk = !query || `${problem.title} ${problem.filename}`.toLowerCase().includes(query);
        return statusOk && queryOk;
      });
      return { ...chapter, problems };
    })
    .filter((chapter) => chapter.problems.length);
}

function renderChapter(chapter) {
  const solved = chapter.problems.filter((problem) => problem.status === "solved").length;
  const expanded = isChapterExpanded(chapter.id);
  return `
    <div class="chapter-group">
      <button class="chapter-heading${expanded ? " expanded" : ""}" data-chapter-id="${escapeHtml(chapter.id)}" aria-expanded="${expanded}" title="${escapeHtml(chapter.title)}">
        <span class="chevron">${icons.chevron}</span>
        <span class="chapter-title">${escapeHtml(chapter.title)}</span>
        <span>${solved}/${chapter.problems.length}</span>
      </button>
      <div class="chapter-progress" aria-hidden="true">
        <span style="width: ${chapterProgress(chapter)}%"></span>
      </div>
      <div class="chapter-problems${expanded ? " expanded" : ""}">
        ${expanded ? chapter.problems.map(renderProblemButton).join("") : ""}
      </div>
    </div>
  `;
}

function renderProblemButton(problem) {
  const active = state.current && state.current.id === problem.id ? " active" : "";
  const star = problem.bookmarked ? `<span class="problem-star">${icons.starFilled}</span>` : "";
  return `
    <button class="problem-item${active}" data-problem-id="${escapeHtml(problem.id)}">
      <span class="marker ${problem.status}"></span>
      <span>
        <span class="problem-name">${escapeHtml(problem.title)}${star}</span>
        <span class="problem-meta">${escapeHtml(problem.filename)} · ${problem.passed} / ${problem.total}</span>
      </span>
    </button>
  `;
}

async function openProblem(problemId, options = {}) {
  if (!options.force && !options.skipConfirm && isDirty() && !confirm("Discard unsaved editor changes and switch problems?")) return;
  try {
    const boilerplate = await loadBoilerplate(problemId, state.language);
    const staticProblem = findProblem(problemId);
    const localState = problemLocalState(problemId);
    const code = readCode(problemId, state.language) ?? boilerplate;
    state.current = { ...staticProblem, ...localState, code, boilerplate };
    state.savedCode = code;
    state.lastRun = null;
    state.selectedAttemptId = null;
    setEditorValue(code);
    setMonacoLanguage(state.language);
    state.session.lastProblemId = problemId;
    ensureProblemChapterExpanded(problemId);
    renderCurrentProblem();
    renderProblemList();
    el.sidebar.classList.remove("open");
    persistSession();
  } catch (error) {
    showToast(error.message);
  }
}

function renderCurrentProblem() {
  const problem = state.current;
  el.problemChapter.textContent = problem.chapter;
  el.problemTitle.textContent = problem.title;
  el.progressBadge.textContent = `${problem.passed} / ${problem.total}`;
  renderStarButton(problem.bookmarked);
  el.notesArea.value = problem.notes || "";
  renderProblemCard(problem.id);
  renderHistory(problem.attempts || []);
  clearOutput();
  updateDirtyState();
}

function renderHistory(attempts) {
  const rows = attempts.slice().reverse();
  el.historyList.innerHTML = rows.map((attempt, index) => {
    const id = attempt.id || "";
    const result = formatResult(attempt.result);
    const failed = isFailedAttempt(attempt);
    const selected = id && id === state.selectedAttemptId ? " active" : "";
    const langLabel = LANGUAGE_LABELS[attempt.language] || attempt.language || "";
    const langBadge = langLabel ? `<span class="history-lang">${escapeHtml(langLabel)}</span> · ` : "";
    return `
      <button class="history-row ${escapeHtml(attempt.result || "run")}${failed ? " failed-state" : ""}${selected}" data-attempt-id="${escapeHtml(id)}" data-attempt-index="${index}">
        <strong>${langBadge}${escapeHtml(result)} · ${attempt.passed} / ${attempt.total}</strong>
        <span>${escapeHtml(formatAttemptTime(attempt.ranAt))} · exit ${attempt.exitCode} · ${attempt.durationMs}ms</span>
      </button>
    `;
  }).join("") || `<div class="muted">No attempts yet.</div>`;
  el.historyCode.hidden = true;
  el.historyCodeHeader.textContent = "";
  el.historyCodeBlock.textContent = "";
  el.historyList.querySelectorAll(".history-row[data-attempt-id]").forEach((button) => {
    button.addEventListener("click", () => showAttemptCode(rows[Number(button.dataset.attemptIndex)]));
  });
}

async function showAttemptCode(attempt) {
  if (!state.current || !attempt) return;
  state.selectedAttemptId = attempt.id;
  renderHistory(state.current.attempts || []);
  el.historyCode.hidden = false;
  el.historyCodeHeader.textContent = `${formatResult(attempt.result)} · ${attempt.passed} / ${attempt.total} · ${formatAttemptTime(attempt.ranAt)}`;
  if (!attempt.id) {
    el.historyCodeBlock.textContent = "Code snapshot is not available for this older attempt.";
    return;
  }
  el.historyCodeBlock.textContent = attempt.code || "Code snapshot is not available.";
}

async function runTests(scope = "all") {
  if (!state.current || state.running) return;
  state.running = true;
  el.runButton.disabled = true;
  el.runSampleButton.disabled = true;
  el.runButton.innerHTML = icons.running;
  setTab("output");
  try {
    const code = getEditorValue();
    await persistCode(code);
    const created = await api.post("/api/runs", { problemId: state.current.id, language: state.language, code, scope });
    renderRunPending(scope, created.status);
    const result = await pollRun(created.runId);
    state.savedCode = code;
    state.lastRun = { ...result.result, scope };
    renderRunOutput(state.lastRun);
    refreshAfterRun(state.current.id, state.lastRun, code);
  } catch (error) {
    showToast(error.message);
  } finally {
    state.running = false;
    el.runButton.disabled = false;
    el.runSampleButton.disabled = false;
    el.runButton.innerHTML = icons.run;
    updateDirtyState();
  }
}

function refreshAfterRun(problemId, result, code) {
  const local = problemLocalState(problemId);
  const attempt = {
    id: `local-${Date.now()}`,
    ranAt: new Date().toISOString(),
    scope: result.scope,
    passed: result.passed,
    total: result.total,
    exitCode: result.exitCode,
    durationMs: result.durationMs,
    result: result.verdict,
    language: state.language,
    code,
  };
  const attempts = [...(local.attempts || []), attempt].slice(-25);
  updateProblemLocalState(problemId, {
    attempts,
    status: result.verdict === "passed" ? "solved" : "in_progress",
    passed: result.passed,
    total: result.total,
    lastRunAt: attempt.ranAt,
  });
  const staticProblem = findProblem(problemId);
  state.current = { ...staticProblem, ...problemLocalState(problemId), code: state.savedCode, boilerplate: state.current.boilerplate };
  renderProblemList();
  renderCurrentProblem();
  if (state.lastRun) renderRunOutput(state.lastRun);
}

async function saveNotes() {
  if (!state.current) return;
  updateProblemLocalState(state.current.id, { notes: el.notesArea.value });
  state.current.notes = el.notesArea.value;
  showToast("Notes saved.");
  renderProblemList();
}

async function toggleStar() {
  if (!state.current) return;
  const bookmarked = !state.current.bookmarked;
  updateProblemLocalState(state.current.id, { bookmarked });
  state.current.bookmarked = bookmarked;
  renderStarButton(bookmarked);
  renderProblemList();
}

function renderRunOutput(result) {
  const verdict = result.verdict || result.result;
  el.runSummary.className = `run-summary ${verdict}`;
  el.runSummary.textContent = `${result.scope || "all"} · ${verdict} · ${result.passed} / ${result.total} · exit ${result.exitCode} · ${result.durationMs}ms`;
  el.stdoutBlock.textContent = result.stdout || "";
  const stderr = [result.stderr, result.compileOutput, result.message].filter(Boolean).join("\n");
  el.stderrBlock.textContent = stderr;
  el.stderrTitle.style.display = stderr ? "block" : "none";
  el.stderrBlock.style.display = stderr ? "block" : "none";
}

function renderRunPending(scope, status) {
  el.runSummary.className = "run-summary muted";
  el.runSummary.textContent = `${scope} · ${status}`;
  el.stdoutBlock.textContent = "";
  el.stderrBlock.textContent = "";
  el.stderrTitle.style.display = "none";
  el.stderrBlock.style.display = "none";
}

async function pollRun(runId) {
  for (;;) {
    await delay(900);
    const payload = await api.get(`/api/runs/${encodeURIComponent(runId)}`);
    if (payload.status === "completed") return payload;
    if (payload.status === "error") throw new Error(payload.error?.message || "Run failed.");
    renderRunPending(payload.scope || "all", payload.status);
  }
}

function clearOutput() {
  el.runSummary.className = "run-summary muted";
  el.runSummary.textContent = "No run yet.";
  el.stdoutBlock.textContent = "";
  el.stderrBlock.textContent = "";
  el.stderrTitle.style.display = "none";
  el.stderrBlock.style.display = "none";
}

function updateFilters(values) {
  state.session.filters = { ...state.session.filters, ...values };
  syncFilterControls();
  persistSession();
  renderProblemList();
}

function syncFilterControls() {
  el.searchInput.value = state.session.filters.query || "";
  el.statusTabs.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.status === state.session.filters.status);
  });
  syncLanguageControls();
  updateThemeButtons();
}

function syncLanguageControls() {
  if (!el.languageTabs) return;
  el.languageTabs.querySelectorAll("button[data-language]").forEach((button) => {
    button.classList.toggle("active", button.dataset.language === state.language);
  });
}

async function switchLanguage(nextLang) {
  if (!SUPPORTED_LANGUAGES.includes(nextLang) || nextLang === state.language) return;
  if (isDirty()) await runAutosave();
  state.language = nextLang;
  state.session.language = nextLang;
  persistSession();
  syncLanguageControls();
  refreshChapters();
  if (state.current) {
    await openProblem(state.current.id, { force: true, skipConfirm: true });
  } else {
    setMonacoLanguage(nextLang);
    renderProblemList();
  }
}

function setMonacoLanguage(language) {
  if (state.editorKind !== "monaco" || !window.monaco || !state.editor) return;
  const model = state.editor.getModel();
  if (!model) return;
  monaco.editor.setModelLanguage(model, MONACO_LANGUAGES[language] || "python");
}

function renderStaticIcons() {
  const statusIcons = {
    all: icons.all,
    starred: icons.star,
    in_progress: icons.progress,
    solved: icons.solved,
  };
  el.statusTabs.querySelectorAll("button[data-status]").forEach((button) => {
    button.innerHTML = statusIcons[button.dataset.status] || "";
  });
  el.runButton.innerHTML = icons.run;
  renderStarButton(false);
}

function normalizeSession(session) {
  const next = {
    lastProblemId: null,
    filters: { chapter: null, status: "all", query: "" },
    sort: "book_order",
    theme: "system",
    sidebarCollapsed: false,
    rightPanelCollapsed: false,
    rightPanelWidth: rightPanelLayout.defaultWidth,
    problemPanelCollapsed: false,
    expandedChapterIds: [],
    ...session,
  };
  next.filters = { chapter: null, status: "all", query: "", ...(session && session.filters) };
  if (session && typeof session.problemPanelCollapsed === "boolean") {
    next.problemPanelCollapsed = session.problemPanelCollapsed;
  }
  next.rightPanelWidth = clampRightPanelWidth(next.rightPanelWidth);
  if (!["light", "dark", "system"].includes(next.theme)) next.theme = "system";
  if (next.filters.status === "bookmarked") next.filters.status = "starred";
  if (!["all", "starred", "in_progress", "solved"].includes(next.filters.status)) next.filters.status = "all";
  if (!Array.isArray(next.expandedChapterIds)) next.expandedChapterIds = [];
  if (!SUPPORTED_LANGUAGES.includes(next.language)) next.language = "python";
  return next;
}

function applyTheme(theme) {
  const preference = ["light", "dark", "system"].includes(theme) ? theme : "system";
  const resolved = preference === "system" && systemTheme.matches ? "dark" : preference === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
  if (state.editorKind === "monaco" && window.monaco) {
    monaco.editor.setTheme(resolved === "dark" ? "vs-dark" : "vs");
  }
  updateThemeButtons();
}

function setTheme(theme) {
  if (!["light", "dark", "system"].includes(theme)) return;
  state.session.theme = theme;
  applyTheme(theme);
  persistSession();
}

function cycleTheme() {
  const order = ["system", "light", "dark"];
  const current = order.includes(state.session.theme) ? state.session.theme : "system";
  setTheme(order[(order.indexOf(current) + 1) % order.length]);
}

function updateThemeButtons() {
  if (!el.themeButton) return;
  const themeIcons = { light: icons.sun, dark: icons.moon, system: icons.monitor };
  const themeLabels = { light: "Light theme", dark: "Dark theme", system: "System theme" };
  el.themeButton.innerHTML = themeIcons[state.session.theme] || icons.monitor;
  el.themeButton.title = themeLabels[state.session.theme] || themeLabels.system;
  el.themeButton.setAttribute("aria-label", el.themeButton.title);
}

function applySidebarState() {
  el.appShell.classList.toggle("sidebar-collapsed", Boolean(state.session.sidebarCollapsed));
  el.sidebarToggle.title = state.session.sidebarCollapsed ? "Open problems" : "Collapse problems";
  el.sidebarToggle.setAttribute("aria-label", el.sidebarToggle.title);
}

function setSidebarCollapsed(collapsed, options = {}) {
  state.session.sidebarCollapsed = Boolean(collapsed);
  if (state.session.sidebarCollapsed) el.sidebar.classList.remove("open");
  applySidebarState();
  if (options.persist !== false) persistSession();
}

function clampRightPanelWidth(width) {
  const numeric = Number(width);
  if (!Number.isFinite(numeric)) return rightPanelLayout.defaultWidth;
  return Math.min(rightPanelLayout.maxWidth, Math.max(rightPanelLayout.minWidth, Math.round(numeric)));
}

function rightPanelResizeEnabled() {
  return window.innerWidth > rightPanelLayout.resizeBreakpoint && !state.session.rightPanelCollapsed;
}

function applyRightPanelWidth(width = state.session.rightPanelWidth) {
  const nextWidth = clampRightPanelWidth(width);
  state.session.rightPanelWidth = nextWidth;
  if (!el.appShell) return;
  if (rightPanelResizeEnabled()) {
    el.appShell.style.setProperty("--right-panel-width", `${nextWidth}px`);
  } else {
    el.appShell.style.removeProperty("--right-panel-width");
  }
}

function setRightPanelWidth(width, options = {}) {
  applyRightPanelWidth(width);
  if (options.persist !== false) persistSession();
}

function applyRightPanelState() {
  el.appShell.classList.toggle("right-panel-collapsed", Boolean(state.session.rightPanelCollapsed));
  el.rightPanelToggle.title = state.session.rightPanelCollapsed ? "Open panel" : "Collapse panel";
  el.rightPanelToggle.setAttribute("aria-label", el.rightPanelToggle.title);
  applyRightPanelWidth();
}

function setRightPanelCollapsed(collapsed, options = {}) {
  state.session.rightPanelCollapsed = Boolean(collapsed);
  applyRightPanelState();
  if (options.persist !== false) persistSession();
}

function setupRightPanelResize() {
  if (!el.rightPanelResizeHandle) return;

  let dragging = false;
  let activePointerId = null;

  const finishResize = (persist) => {
    if (!dragging) return;
    dragging = false;
    activePointerId = null;
    document.body.classList.remove("right-panel-resizing");
    if (persist) persistSession();
  };

  const resizeFromClientX = (clientX) => {
    const shellRect = el.appShell.getBoundingClientRect();
    setRightPanelWidth(shellRect.right - clientX, { persist: false });
  };

  el.rightPanelResizeHandle.addEventListener("pointerdown", (event) => {
    if (!rightPanelResizeEnabled() || event.button !== 0) return;
    event.preventDefault();
    dragging = true;
    activePointerId = event.pointerId;
    document.body.classList.add("right-panel-resizing");
    el.rightPanelResizeHandle.setPointerCapture(event.pointerId);
    resizeFromClientX(event.clientX);
  });

  el.rightPanelResizeHandle.addEventListener("pointermove", (event) => {
    if (!dragging || event.pointerId !== activePointerId) return;
    event.preventDefault();
    resizeFromClientX(event.clientX);
  });

  el.rightPanelResizeHandle.addEventListener("pointerup", (event) => {
    if (event.pointerId !== activePointerId) return;
    finishResize(true);
  });

  el.rightPanelResizeHandle.addEventListener("pointercancel", (event) => {
    if (event.pointerId !== activePointerId) return;
    finishResize(false);
  });

  el.rightPanelResizeHandle.addEventListener("keydown", (event) => {
    if (!rightPanelResizeEnabled()) return;
    const step = event.shiftKey ? 40 : 16;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setRightPanelWidth(state.session.rightPanelWidth + step);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setRightPanelWidth(state.session.rightPanelWidth - step);
    }
  });

  window.addEventListener("resize", () => applyRightPanelWidth());
}

function applyProblemPanelState() {
  if (!el.problemPanel) return;
  const collapsed = Boolean(state.session.problemPanelCollapsed);
  el.problemPanel.classList.toggle("collapsed", collapsed);
  el.problemPanelToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  el.problemPanelToggle.title = collapsed ? "Expand question" : "Collapse question";
}

function setProblemPanelCollapsed(collapsed, options = {}) {
  state.session.problemPanelCollapsed = Boolean(collapsed);
  applyProblemPanelState();
  if (options.persist !== false) persistSession();
}

function migrateChapterFilter() {
  const chapterId = state.session.filters.chapter;
  if (!chapterId) return;
  expandChapter(chapterId, { persist: false });
  state.session.filters.chapter = null;
}

function initializeExpandedChapters() {
  if (state.session.expandedChapterIds.length) return;
  const lastChapter = chapterForProblem(state.session.lastProblemId);
  const firstChapter = state.chapters[0];
  const chapter = lastChapter || firstChapter;
  if (chapter) state.session.expandedChapterIds = [chapter.id];
}

function isChapterExpanded(chapterId) {
  return state.session.expandedChapterIds.includes(chapterId);
}

function toggleChapter(chapterId) {
  if (isChapterExpanded(chapterId)) {
    state.session.expandedChapterIds = state.session.expandedChapterIds.filter((id) => id !== chapterId);
  } else {
    state.session.expandedChapterIds = [...state.session.expandedChapterIds, chapterId];
  }
  persistSession();
  renderProblemList();
}

function expandChapter(chapterId, options = {}) {
  if (!chapterId || isChapterExpanded(chapterId)) return;
  state.session.expandedChapterIds = [...state.session.expandedChapterIds, chapterId];
  if (options.persist !== false) persistSession();
}

function ensureProblemChapterExpanded(problemId) {
  const chapter = chapterForProblem(problemId);
  if (chapter) expandChapter(chapter.id, { persist: false });
}

function chapterForProblem(problemId) {
  if (!problemId) return null;
  return state.chapters.find((chapter) => chapter.problems.some((problem) => problem.id === problemId)) || null;
}

function renderStarButton(bookmarked) {
  el.starButton.innerHTML = bookmarked ? icons.starFilled : icons.star;
  el.starButton.classList.toggle("active", bookmarked);
  el.starButton.title = bookmarked ? "Unstar problem" : "Star problem";
  el.starButton.setAttribute("aria-label", el.starButton.title);
}

function chapterProgress(chapter) {
  if (!chapter.problems.length) return 0;
  const solved = chapter.problems.filter((problem) => problem.status === "solved").length;
  return Math.round((solved / chapter.problems.length) * 100);
}

function persistSession() {
  writeJson(storageKeys.session, state.session);
}

function setTab(tab) {
  el.rightTabs.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"));
  document.getElementById(`tab-${tab}`).classList.add("active");
}

async function resetEditorView() {
  if (!state.current) return;
  if (!confirm("Restore the original starter code for this problem?")) return;
  clearPendingAutosave();
  state.pendingAutosave = false;
  state.resetVersion += 1;
  const resetVersion = state.resetVersion;
  try {
    const code = state.current.boilerplate ?? await loadBoilerplate(state.current.id, state.language);
    writeCode(state.current.id, code, state.language);
    if (resetVersion !== state.resetVersion) return;
    state.savedCode = code;
    state.current.code = code;
    state.current.boilerplate = code;
    setEditorValue(code);
    updateDirtyState("Restored");
    resetEditorPosition();
  } catch (error) {
    showToast(error.message);
  }
}

function resetEditorPosition() {
  if (state.editorKind === "monaco") {
    state.editor.setPosition({ lineNumber: 1, column: 1 });
    state.editor.revealLine(1);
    state.editor.focus();
  } else {
    el.fallbackEditor.scrollTop = 0;
    el.fallbackEditor.focus();
  }
}

function getEditorValue() {
  return state.editor ? state.editor.getValue() : "";
}

function setEditorValue(value) {
  if (!state.editor) return;
  state.suppressAutosave = true;
  state.editor.setValue(value);
  window.setTimeout(() => { state.suppressAutosave = false; }, 0);
}

function isDirty() {
  return state.current && getEditorValue() !== state.savedCode;
}

function updateDirtyState(message) {
  if (typeof message === "string" && message) {
    el.dirtyState.textContent = message;
    el.dirtyState.dataset.state = message.toLowerCase().replaceAll(" ", "-");
    return;
  }
  el.dirtyState.textContent = isDirty() ? "Saving..." : "";
  el.dirtyState.dataset.state = isDirty() ? "saving" : "saved";
  if (!state.suppressAutosave) scheduleAutosave();
}

function scheduleAutosave() {
  if (!state.current || !isDirty()) return;
  clearTimeout(state.autosaveTimer);
  state.autosaveTimer = setTimeout(runAutosave, state.autosaveDelayMs);
}

function clearPendingAutosave() {
  clearTimeout(state.autosaveTimer);
  state.autosaveTimer = null;
}

async function runAutosave() {
  if (!state.current || !isDirty()) {
    updateDirtyState();
    return;
  }
  if (state.saveInFlight) {
    state.pendingAutosave = true;
    return;
  }
  const resetVersion = state.resetVersion;
  try {
    await persistCode(getEditorValue(), resetVersion);
  } catch (error) {
    if (resetVersion !== state.resetVersion) return;
    el.dirtyState.textContent = "Autosave failed";
    el.dirtyState.dataset.state = "failed";
  }
  if (resetVersion !== state.resetVersion) return;
  if (state.pendingAutosave) {
    state.pendingAutosave = false;
    scheduleAutosave();
  }
}

async function persistCode(code, resetVersion = state.resetVersion) {
  state.saveInFlight = true;
  el.dirtyState.textContent = "Saving...";
  el.dirtyState.dataset.state = "saving";
  try {
    writeCode(state.current.id, code, state.language);
    if (resetVersion !== state.resetVersion) return;
    state.savedCode = code;
    updateDirtyState("Saved");
  } finally {
    state.saveInFlight = false;
  }
}

function findProblem(problemId) {
  if (!problemId) return null;
  return state.chapters.flatMap((chapter) => chapter.problems).find((problem) => problem.id === problemId) || null;
}

async function refreshProblemState() {
  state.problemState = migrateProblemState(readJson(storageKeys.problemState, {}));
  refreshChapters();
}

function refreshChapters() {
  state.chapters = mergeProblemState(state.catalogChapters, state.problemState);
}

function migrateProblemState(problemState) {
  const next = {};
  for (const [problemId, entry] of Object.entries(problemState || {})) {
    if (entry.languages) {
      next[problemId] = entry;
      continue;
    }
    const { bookmarked, notes, status, passed, total, attempts, lastRunAt } = entry;
    next[problemId] = {
      bookmarked: Boolean(bookmarked),
      notes: notes || "",
      languages: {
        python: {
          status: status || "not_started",
          passed: passed || 0,
          total: total || 0,
          attempts: attempts || [],
          lastRunAt: lastRunAt || null,
        },
      },
    };
  }
  return next;
}

function mergeProblemState(chapters, problemState) {
  const lang = state.language;
  return chapters.map((chapter) => ({
    ...chapter,
    problems: chapter.problems.map((problem) => {
      const dynamic = problemState[problem.id] || {};
      const langDynamic = dynamic.languages?.[lang] || {};
      const staticLang = problem.languages?.[lang];
      const passed = langDynamic.passed ?? staticLang?.passed ?? problem.passed ?? 0;
      const total = langDynamic.total ?? staticLang?.total ?? problem.total ?? 0;
      return {
        ...problem,
        filename: staticLang?.filename || problem.filename,
        bookmarked: Boolean(dynamic.bookmarked),
        notes: dynamic.notes || "",
        passed,
        total,
        status: langDynamic.status || statusForStaticProblem({ passed, total }),
        attempts: langDynamic.attempts || [],
        lastRunAt: langDynamic.lastRunAt || null,
      };
    }),
  }));
}

function statusForStaticProblem(problem) {
  if (problem.total && problem.passed >= problem.total) return "solved";
  if (problem.passed) return "in_progress";
  return "not_started";
}

async function loadBoilerplate(problemId, language = state.language) {
  const problem = state.catalogChapters
    .flatMap((chapter) => chapter.problems)
    .find((item) => item.id === problemId);
  const path =
    problem?.languages?.[language]?.boilerplatePath ||
    state.manifest?.boilerplate?.[language]?.[problemId];
  if (!path) throw new Error(`No starter code for ${LANGUAGE_LABELS[language] || language}.`);
  return cdn.text(path);
}

function firstProblem() {
  return state.chapters.flatMap((chapter) => chapter.problems)[0] || null;
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => el.toast.classList.remove("show"), 3200);
}

function formatAttemptTime(isoString) {
  if (!isoString) return "Unknown time";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const attemptDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today - attemptDay) / 86400000);
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
  if (diffDays === 0) return `Today, ${time}`;
  if (diffDays === 1) return `Yesterday, ${time}`;
  const day = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
  return `${day}, ${time}`;
}

function formatResult(result) {
  const labels = {
    passed: "Passed",
    failed: "Failed",
    compile_error: "Compile error",
    runtime_error: "Runtime error",
    timeout: "Timeout",
  };
  return labels[result] || "Run";
}

function isFailedAttempt(attempt) {
  return ["failed", "compile_error", "runtime_error", "timeout"].includes(attempt.result) || Number(attempt.exitCode) !== 0;
}

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function codeStorageKey(problemId, language = state.language) {
  return `${storageKeys.codePrefixV3}${problemId}.${language}`;
}

function readCode(problemId, language = state.language) {
  const v3Key = codeStorageKey(problemId, language);
  const value = localStorage.getItem(v3Key);
  if (value !== null) return value;
  if (language === "python") {
    const legacy = localStorage.getItem(`${storageKeys.codePrefixV2}${problemId}`);
    if (legacy !== null) {
      localStorage.setItem(v3Key, legacy);
      return legacy;
    }
  }
  return null;
}

function writeCode(problemId, code, language = state.language) {
  localStorage.setItem(codeStorageKey(problemId, language), code);
}

function problemLocalState(problemId) {
  const entry = state.problemState[problemId] || {};
  const langState = entry.languages?.[state.language] || {};
  return {
    bookmarked: Boolean(entry.bookmarked),
    notes: entry.notes || "",
    ...langState,
  };
}

function updateProblemLocalState(problemId, values) {
  const entry = state.problemState[problemId] || { languages: {} };
  const shared = {};
  const langValues = {};
  for (const [key, value] of Object.entries(values)) {
    if (key === "bookmarked" || key === "notes") shared[key] = value;
    else langValues[key] = value;
  }
  const next = {
    bookmarked: entry.bookmarked,
    notes: entry.notes || "",
    languages: { ...(entry.languages || {}) },
    ...shared,
  };
  if (Object.keys(langValues).length) {
    next.languages[state.language] = { ...(entry.languages?.[state.language] || {}), ...langValues };
  }
  state.problemState[problemId] = next;
  writeJson(storageKeys.problemState, state.problemState);
  refreshChapters();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadProblemCards(manifest) {
  const paths = [
    manifest?.problemCards,
    manifest?.problemCardsStable,
    "/data/epi_problem_cards.json",
  ].filter(Boolean);
  const seen = new Set();
  for (const path of paths) {
    if (seen.has(path)) continue;
    seen.add(path);
    try {
      const cards = await cdn.get(path);
      if (Array.isArray(cards) && cards.length) {
        state.problemCards = cards;
        state.problemCardByJudgeId = buildProblemCardIndex(cards);
        return;
      }
    } catch {
      // Try the next known cards path.
    }
  }
  state.problemCards = [];
  state.problemCardByJudgeId = {};
}

function normalizeTitle(title) {
  return String(title ?? "")
    .replace(/^\d+\.\d+\s+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function buildProblemCardIndex(cards) {
  const byNorm = new Map();
  for (const card of cards) {
    byNorm.set(normalizeTitle(card.title), card);
  }
  const byJudgeId = {};
  for (const chapter of state.chapters) {
    for (const problem of chapter.problems) {
      const card = byNorm.get(normalizeTitle(problem.title));
      if (card) byJudgeId[problem.id] = card;
    }
  }
  return byJudgeId;
}

function rewriteFigurePath(assetPath) {
  if (!assetPath) return "";
  if (assetPath.startsWith("/")) return assetPath;
  return assetPath.replace(/^data\//, "/data/");
}

function renderProblemFigures(card) {
  const figures = [...(card.figures || [])]
    .sort((left, right) => {
      const pageDelta = (left.pdf_page || 0) - (right.pdf_page || 0);
      if (pageDelta) return pageDelta;
      return (left.bbox?.y_min || 0) - (right.bbox?.y_min || 0);
    })
    .filter((figure) => figure.asset_path);
  if (!figures.length) return "";
  return figures.map((figure) => {
    const src = rewriteFigurePath(figure.asset_path);
    const caption = `${figure.label || "Figure"}: ${figure.caption || ""}`.trim();
    return `
      <figure class="problem-figure">
        <img src="${escapeHtml(src)}" alt="${escapeHtml(caption)}" loading="lazy">
        ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}
      </figure>
    `;
  }).join("");
}

function renderProblemSolutionParts(card) {
  if (Array.isArray(card.solution_parts) && card.solution_parts.length) {
    return card.solution_parts.map((part) => {
      if (part.type === "code") {
        return `<div class="problem-solution-part problem-code"><pre><code>${escapeHtml(part.code || "")}</code></pre></div>`;
      }
      return `<div class="problem-solution-part"><div class="problem-text">${escapeHtml(part.text || "")}</div></div>`;
    }).join("");
  }
  const fallback = [];
  if (card.solution) {
    fallback.push(`<div class="problem-solution-part"><div class="problem-text">${escapeHtml(card.solution)}</div></div>`);
  }
  if (card.code_blocks?.length) {
    fallback.push(...card.code_blocks.map((block) =>
      `<div class="problem-solution-part problem-code"><pre><code>${escapeHtml(block.code || "")}</code></pre></div>`,
    ));
  }
  return fallback.join("");
}

function renderProblemCard(problemId) {
  if (!el.problemPanelBody) return;
  const card = state.problemCardByJudgeId?.[problemId];
  if (!card) {
    el.problemPanelBody.innerHTML = `<p class="problem-empty">No book description available for this problem.</p>`;
    if (el.problemSpoilers) el.problemSpoilers.innerHTML = "";
    return;
  }

  const tags = (card.tags || []).map((tag) => `<span class="problem-badge">${escapeHtml(tag)}</span>`).join("");
  const complexity = Object.keys(card.complexity || {}).length
    ? Object.entries(card.complexity).map(([key, value]) =>
      `<span class="problem-complexity-item"><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value)}</span>`,
    ).join("")
    : "";
  const meta = [
    card.book_page_start != null ? `Book pp. ${card.book_page_start}–${card.book_page_end}` : "",
    card.pdf_page_start != null ? `PDF pp. ${card.pdf_page_start}–${card.pdf_page_end}` : "",
  ].filter(Boolean).join(" · ");
  const figures = renderProblemFigures(card);
  const hint = card.hint?.trim();
  const solutionParts = renderProblemSolutionParts(card);

  el.problemPanelBody.innerHTML = `
    <div class="problem-card">
      ${meta ? `<div class="problem-meta-line">${escapeHtml(meta)}</div>` : ""}
      ${tags ? `<div class="problem-tags">${tags}</div>` : ""}
      ${complexity ? `<div class="problem-complexity">${complexity}</div>` : ""}
      <div class="problem-statement problem-text">${escapeHtml(card.statement || "")}</div>
      ${figures}
    </div>
  `;

  el.problemPanelBody.querySelectorAll(".problem-figure img").forEach((img) => {
    img.addEventListener("error", () => { img.style.display = "none"; });
  });

  if (!el.problemSpoilers) return;
  el.problemSpoilers.innerHTML = [
    hint ? `
      <details class="problem-section">
        <summary>Hint</summary>
        <div class="problem-text">${escapeHtml(hint)}</div>
      </details>
    ` : "",
    solutionParts ? `
      <details class="problem-section">
        <summary>Solution</summary>
        <div class="problem-solution">${solutionParts}</div>
      </details>
    ` : "",
  ].filter(Boolean).join("");
}
