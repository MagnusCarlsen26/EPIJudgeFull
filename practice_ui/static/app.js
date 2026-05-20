const api = {
  async get(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(await messageFrom(response));
    return response.json();
  },
  async put(path, body) {
    const response = await fetch(path, jsonRequest("PUT", body));
    if (!response.ok) throw new Error(await messageFrom(response));
    return response.json();
  },
  async post(path, body) {
    const response = await fetch(path, jsonRequest("POST", body));
    if (!response.ok) throw new Error(await messageFrom(response));
    return response.json();
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
    return payload.detail || response.statusText;
  } catch {
    return response.statusText;
  }
}

const state = {
  chapters: [],
  session: {
    lastProblemId: null,
    filters: { chapter: null, status: "all", query: "" },
    sort: "book_order",
    theme: "system",
    sidebarCollapsed: false,
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
    const [session, problems] = await Promise.all([api.get("/api/session"), api.get("/api/problems")]);
    state.session = normalizeSession(session.session);
    state.chapters = problems.chapters;
    applyTheme(state.session.theme);
    applySidebarState();
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
  if (!options.force && isDirty() && !confirm("Discard unsaved editor changes and switch problems?")) return;
  try {
    const detail = await api.get(`/api/problems/${encodeURIComponent(problemId)}`);
    state.current = detail;
    state.savedCode = detail.code;
    state.lastRun = null;
    state.selectedAttemptId = null;
    setEditorValue(detail.code);
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
    return `
      <button class="history-row ${escapeHtml(attempt.result || "run")}${failed ? " failed-state" : ""}${selected}" data-attempt-id="${escapeHtml(id)}" data-attempt-index="${index}">
        <strong>${escapeHtml(result)} · ${attempt.passed} / ${attempt.total}</strong>
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
  el.historyCodeBlock.textContent = "Loading...";
  try {
    const payload = await api.get(`/api/problems/${encodeURIComponent(state.current.id)}/attempts/${encodeURIComponent(attempt.id)}/code`);
    el.historyCodeBlock.textContent = payload.available ? payload.code : (payload.detail || "Code snapshot is not available for this older attempt.");
  } catch (error) {
    el.historyCodeBlock.textContent = error.message;
  }
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
    const result = await api.post(`/api/problems/${encodeURIComponent(state.current.id)}/run`, { code, scope });
    state.savedCode = code;
    state.lastRun = result;
    renderRunOutput(result);
    await refreshAfterRun(state.current.id);
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

async function refreshAfterRun(problemId) {
  const [problems, detail] = await Promise.all([
    api.get("/api/problems"),
    api.get(`/api/problems/${encodeURIComponent(problemId)}`),
  ]);
  state.chapters = problems.chapters;
  state.current = { ...detail, code: state.savedCode };
  renderProblemList();
  renderCurrentProblem();
  if (state.lastRun) renderRunOutput(state.lastRun);
}

async function saveNotes() {
  if (!state.current) return;
  try {
    await api.put(`/api/problems/${encodeURIComponent(state.current.id)}/notes`, { notes: el.notesArea.value });
    state.current.notes = el.notesArea.value;
    showToast("Notes saved.");
    const problems = await api.get("/api/problems");
    state.chapters = problems.chapters;
    renderProblemList();
  } catch (error) {
    showToast(error.message);
  }
}

async function toggleStar() {
  if (!state.current) return;
  const bookmarked = !state.current.bookmarked;
  try {
    await api.put(`/api/problems/${encodeURIComponent(state.current.id)}/bookmark`, { bookmarked });
    state.current.bookmarked = bookmarked;
    renderStarButton(bookmarked);
    const problems = await api.get("/api/problems");
    state.chapters = problems.chapters;
    renderProblemList();
  } catch (error) {
    showToast(error.message);
  }
}

function renderRunOutput(result) {
  el.runSummary.className = `run-summary ${result.result}`;
  el.runSummary.textContent = `${result.scope || "all"} · ${result.result} · ${result.passed} / ${result.total} · exit ${result.exitCode} · ${result.durationMs}ms`;
  el.stdoutBlock.textContent = result.stdout || "";
  el.stderrBlock.textContent = result.stderr || "";
  el.stderrTitle.style.display = result.stderr ? "block" : "none";
  el.stderrBlock.style.display = result.stderr ? "block" : "none";
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
  updateThemeButtons();
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
    expandedChapterIds: [],
    ...session,
  };
  next.filters = { chapter: null, status: "all", query: "", ...(session && session.filters) };
  if (!["light", "dark", "system"].includes(next.theme)) next.theme = "system";
  if (next.filters.status === "bookmarked") next.filters.status = "starred";
  if (!["all", "starred", "in_progress", "solved"].includes(next.filters.status)) next.filters.status = "all";
  if (!Array.isArray(next.expandedChapterIds)) next.expandedChapterIds = [];
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
  api.put("/api/session", { session: state.session }).catch((error) => showToast(error.message));
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
    const result = await api.post(`/api/problems/${encodeURIComponent(state.current.id)}/reset`, {});
    if (resetVersion !== state.resetVersion) return;
    state.savedCode = result.code;
    setEditorValue(result.code);
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
    await api.put(`/api/problems/${encodeURIComponent(state.current.id)}/code`, { code });
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
    runtime_error: "Runtime error",
    timeout: "Timeout",
  };
  return labels[result] || "Run";
}

function isFailedAttempt(attempt) {
  return ["failed", "runtime_error", "timeout"].includes(attempt.result) || Number(attempt.exitCode) !== 0;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
