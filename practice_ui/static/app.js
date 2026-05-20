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
    theme: "light",
  },
  current: null,
  savedCode: "",
  running: false,
  editor: null,
  editorKind: "textarea",
  lastRun: null,
};

const el = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindElements();
  bindEvents();
  await setupEditor();
  await loadInitialData();
}

function bindElements() {
  for (const id of [
    "progressSummary", "searchInput", "chapterFilter", "statusTabs", "sortSelect", "problemList",
    "problemChapter", "problemTitle", "problemPath", "bookmarkButton", "dirtyState", "progressBadge",
    "resetViewButton", "saveButton", "runButton", "editor", "fallbackEditor", "rightTabs", "runSummary",
    "stdoutBlock", "stderrBlock", "stderrTitle", "notesArea", "saveNotesButton", "historyList",
    "infoList", "toast", "sidebar", "mobileProblems",
  ]) {
    el[id] = document.getElementById(id);
  }
}

function bindEvents() {
  el.searchInput.addEventListener("input", () => updateFilters({ query: el.searchInput.value }));
  el.chapterFilter.addEventListener("change", () => updateFilters({ chapter: el.chapterFilter.value || null }));
  el.sortSelect.addEventListener("change", () => {
    state.session.sort = el.sortSelect.value;
    persistSession();
    renderProblemList();
  });
  el.statusTabs.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-status]");
    if (!button) return;
    updateFilters({ status: button.dataset.status });
  });
  el.rightTabs.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-tab]");
    if (button) setTab(button.dataset.tab);
  });
  el.saveButton.addEventListener("click", saveCode);
  el.runButton.addEventListener("click", runTests);
  el.resetViewButton.addEventListener("click", resetEditorView);
  el.bookmarkButton.addEventListener("click", toggleBookmark);
  el.saveNotesButton.addEventListener("click", saveNotes);
  el.mobileProblems.addEventListener("click", () => el.sidebar.classList.add("open"));
  document.addEventListener("keydown", (event) => {
    const mod = event.ctrlKey || event.metaKey;
    if (!mod || !state.current) return;
    if (event.key.toLowerCase() === "s") {
      event.preventDefault();
      saveCode();
    }
    if (event.key === "Enter") {
      event.preventDefault();
      runTests();
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
    state.session = session.session;
    state.chapters = problems.chapters;
    syncFilterControls();
    renderChapterOptions();
    renderProblemList();
    const first = findProblem(state.session.lastProblemId) || firstProblem();
    if (first) await openProblem(first.id, { force: true });
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
      theme: "vs",
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

function renderChapterOptions() {
  el.chapterFilter.innerHTML = `<option value="">All chapters</option>` + state.chapters
    .map((chapter) => `<option value="${escapeHtml(chapter.id)}">${escapeHtml(chapter.title)}</option>`)
    .join("");
  el.chapterFilter.value = state.session.filters.chapter || "";
}

function renderProblemList() {
  const filtered = filteredChapters();
  const all = state.chapters.flatMap((chapter) => chapter.problems);
  const solved = all.filter((problem) => problem.status === "solved").length;
  el.progressSummary.textContent = `${solved} / ${all.length} solved`;
  el.problemList.innerHTML = filtered.map(renderChapter).join("") || `<div class="muted">No problems match.</div>`;
  el.problemList.querySelectorAll("[data-problem-id]").forEach((button) => {
    button.addEventListener("click", () => openProblem(button.dataset.problemId));
  });
}

function filteredChapters() {
  const filters = state.session.filters;
  const query = (filters.query || "").trim().toLowerCase();
  return state.chapters
    .filter((chapter) => !filters.chapter || chapter.id === filters.chapter)
    .map((chapter) => {
      let problems = chapter.problems.filter((problem) => {
        const statusOk = filters.status === "all" ||
          (filters.status === "bookmarked" ? problem.bookmarked : problem.status === filters.status);
        const queryOk = !query || `${problem.title} ${problem.filename}`.toLowerCase().includes(query);
        return statusOk && queryOk;
      });
      if (state.session.sort === "unsolved_first") {
        problems = problems.slice().sort((a, b) => Number(a.status === "solved") - Number(b.status === "solved"));
      }
      return { ...chapter, problems };
    })
    .filter((chapter) => chapter.problems.length);
}

function renderChapter(chapter) {
  const solved = chapter.problems.filter((problem) => problem.status === "solved").length;
  return `
    <div class="chapter-group">
      <div class="chapter-heading"><span>${escapeHtml(chapter.title)}</span><span>${solved}/${chapter.problems.length}</span></div>
      ${chapter.problems.map(renderProblemButton).join("")}
    </div>
  `;
}

function renderProblemButton(problem) {
  const active = state.current && state.current.id === problem.id ? " active" : "";
  const bookmark = problem.bookmarked ? " ★" : "";
  return `
    <button class="problem-item${active}" data-problem-id="${escapeHtml(problem.id)}">
      <span class="marker ${problem.status}"></span>
      <span>
        <span class="problem-name">${escapeHtml(problem.title)}${bookmark}</span>
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
    setEditorValue(detail.code);
    renderCurrentProblem();
    renderProblemList();
    el.sidebar.classList.remove("open");
    state.session.lastProblemId = problemId;
    persistSession();
  } catch (error) {
    showToast(error.message);
  }
}

function renderCurrentProblem() {
  const problem = state.current;
  el.problemChapter.textContent = problem.chapter;
  el.problemTitle.textContent = problem.title;
  el.problemPath.textContent = problem.path;
  el.progressBadge.textContent = `${problem.passed} / ${problem.total}`;
  el.bookmarkButton.textContent = problem.bookmarked ? "★" : "☆";
  el.bookmarkButton.classList.toggle("active", problem.bookmarked);
  el.notesArea.value = problem.notes || "";
  renderHistory(problem.attempts || []);
  renderInfo(problem);
  clearOutput();
  updateDirtyState();
}

function renderHistory(attempts) {
  el.historyList.innerHTML = attempts.slice().reverse().map((attempt) => `
    <div class="history-row">
      <strong>${escapeHtml(attempt.result || "run")} · ${attempt.passed} / ${attempt.total}</strong>
      <span>${escapeHtml(attempt.ranAt)} · exit ${attempt.exitCode} · ${attempt.durationMs}ms</span>
    </div>
  `).join("") || `<div class="muted">No attempts yet.</div>`;
}

function renderInfo(problem) {
  const command = problem.command || {};
  const metadata = problem.metadata || {};
  const rows = [
    ["Command", command.command || ""],
    ["Working dir", command.workingDirectory || ""],
    ["File", problem.path],
    ["Size", metadata.sizeBytes == null ? "" : `${metadata.sizeBytes} bytes`],
    ["Modified", metadata.modifiedAt || ""],
  ];
  el.infoList.innerHTML = rows.map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`).join("");
}

async function saveCode() {
  if (!state.current) return;
  try {
    const code = getEditorValue();
    await api.put(`/api/problems/${encodeURIComponent(state.current.id)}/code`, { code });
    state.savedCode = code;
    updateDirtyState();
    showToast("Saved.");
  } catch (error) {
    showToast(error.message);
  }
}

async function runTests() {
  if (!state.current || state.running) return;
  state.running = true;
  el.runButton.disabled = true;
  el.runButton.textContent = "Running...";
  setTab("output");
  try {
    const code = getEditorValue();
    const result = await api.post(`/api/problems/${encodeURIComponent(state.current.id)}/run`, { code });
    state.savedCode = code;
    state.lastRun = result;
    renderRunOutput(result);
    await refreshAfterRun(state.current.id);
  } catch (error) {
    showToast(error.message);
  } finally {
    state.running = false;
    el.runButton.disabled = false;
    el.runButton.textContent = "Run Tests";
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

async function toggleBookmark() {
  if (!state.current) return;
  const bookmarked = !state.current.bookmarked;
  try {
    await api.put(`/api/problems/${encodeURIComponent(state.current.id)}/bookmark`, { bookmarked });
    state.current.bookmarked = bookmarked;
    el.bookmarkButton.textContent = bookmarked ? "★" : "☆";
    const problems = await api.get("/api/problems");
    state.chapters = problems.chapters;
    renderProblemList();
  } catch (error) {
    showToast(error.message);
  }
}

function renderRunOutput(result) {
  el.runSummary.className = `run-summary ${result.result}`;
  el.runSummary.textContent = `${result.result} · ${result.passed} / ${result.total} · exit ${result.exitCode} · ${result.durationMs}ms`;
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
  el.chapterFilter.value = state.session.filters.chapter || "";
  el.sortSelect.value = state.session.sort || "book_order";
  el.statusTabs.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.status === state.session.filters.status);
  });
}

function persistSession() {
  api.put("/api/session", { session: state.session }).catch((error) => showToast(error.message));
}

function setTab(tab) {
  el.rightTabs.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"));
  document.getElementById(`tab-${tab}`).classList.add("active");
}

function resetEditorView() {
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
  if (state.editor) state.editor.setValue(value);
}

function isDirty() {
  return state.current && getEditorValue() !== state.savedCode;
}

function updateDirtyState() {
  el.dirtyState.textContent = isDirty() ? "Unsaved" : "";
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
