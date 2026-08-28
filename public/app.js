const state = {
  board: { team: "", tasks: [] },
  filter: "ALL",
  editingId: null,
  user: null
};

const els = {
  authOverlay: document.querySelector("#authOverlay"),
  loginForm: document.querySelector("#loginForm"),
  registerForm: document.querySelector("#registerForm"),
  showRegister: document.querySelector("#showRegister"),
  showLogin: document.querySelector("#showLogin"),
  authError: document.querySelector("#authError"),
  authError2: document.querySelector("#authError2"),
  appShell: document.querySelector("#appShell"),
  userName: document.querySelector("#userName"),
  logoutButton: document.querySelector("#logoutButton"),
  teamName: document.querySelector("#teamName"),
  summary: document.querySelector("#summary"),
  filters: document.querySelector("#filters"),
  taskRows: document.querySelector("#taskRows"),
  blockers: document.querySelector("#blockers"),
  unowned: document.querySelector("#unowned"),
  pulse: document.querySelector("#pulse"),
  quickAdd: document.querySelector("#quickAdd"),
  addButton: document.querySelector("#addButton"),
  dialog: document.querySelector("#taskDialog"),
  form: document.querySelector("#taskForm"),
  dialogId: document.querySelector("#dialogId"),
  dialogTitle: document.querySelector("#dialogTitle"),
  closeDialog: document.querySelector("#closeDialog"),
  cancelTask: document.querySelector("#cancelTask"),
  deleteTask: document.querySelector("#deleteTask"),
  blockedByWrap: document.querySelector("#blockedByWrap")
};

const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 };
const STATUS_ORDER = { DOING: 0, BLOCKED: 1, REVIEW: 2, READY: 3, DONE: 4 };

els.showRegister.addEventListener("click", () => {
  els.loginForm.hidden = true;
  els.registerForm.hidden = false;
  els.authError.textContent = "";
  els.authError2.textContent = "";
});

els.showLogin.addEventListener("click", () => {
  els.registerForm.hidden = true;
  els.loginForm.hidden = false;
  els.authError.textContent = "";
  els.authError2.textContent = "";
});

async function api(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    credentials: "include"
  });
  if (!res.ok) {
    let body = {};
    try { body = await res.json(); } catch {}
    throw new Error(body.error || `${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function loadAuth() {
  try {
    const data = await api("/api/auth/me");
    if (data && data.user) {
      state.user = data.user;
      return true;
    }
  } catch {}
  return false;
}

async function handleLogin(event) {
  event.preventDefault();
  const form = els.loginForm;
  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: form.elements.email.value,
        password: form.elements.password.value
      })
    });
    state.user = data;
    showApp();
  } catch (err) {
    els.authError.textContent = err.message;
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const form = els.registerForm;
  try {
    const data = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: form.elements.email.value,
        password: form.elements.password.value,
        name: form.elements.name.value
      })
    });
    state.user = data;
    showApp();
  } catch (err) {
    els.authError2.textContent = err.message;
  }
}

els.loginForm.addEventListener("submit", handleLogin);
els.registerForm.addEventListener("submit", handleRegister);

els.logoutButton.addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" });
  state.user = null;
  showAuth();
});

function showAuth() {
  els.authOverlay.hidden = false;
  els.appShell.hidden = true;
  els.loginForm.hidden = false;
  els.registerForm.hidden = true;
  els.authError.textContent = "";
  els.authError2.textContent = "";
}

function showApp() {
  els.authOverlay.hidden = true;
  els.appShell.hidden = false;
  els.userName.textContent = state.user.display_name || state.user.email;
  loadBoard();
}

function esc(value) {
  if (value == null) return "";
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function age(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(ms / 60000));
  if (mins < 60) return mins + "m";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + "h";
  return Math.floor(hours / 24) + "d";
}

function owners(tasks) {
  return [...new Set(tasks.map(t => t.owner).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function sortedTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const doneDelta = Number(a.status === "DONE") - Number(b.status === "DONE");
    if (doneDelta) return doneDelta;
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (p) return p;
    const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (s) return s;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });
}

function visibleTasks() {
  const tasks = state.board.tasks;
  if (state.filter === "ALL") return tasks;
  if (state.filter === "UNOWNED") return tasks.filter(t => !t.owner && t.status !== "DONE");
  if (state.filter === "BLOCKED") return tasks.filter(t => t.status === "BLOCKED");
  if (state.filter === "DONE") return tasks.filter(t => t.status === "DONE");
  return tasks.filter(t => t.owner === state.filter);
}

function renderFilters() {
  const options = ["ALL", ...owners(state.board.tasks), "UNOWNED", "BLOCKED", "DONE"];
  els.filters.innerHTML = options.map(name =>
    '<button class="filter ' + (state.filter === name ? "active" : "") + '" data-filter="' + esc(name) + '">' + esc(name) + '</button>'
  ).join("");
  els.filters.querySelectorAll(".filter").forEach(btn => {
    btn.addEventListener("click", () => {
      state.filter = btn.dataset.filter;
      render();
    });
  });
}

function renderRows() {
  const tasks = sortedTasks(visibleTasks());
  if (!tasks.length) {
    els.taskRows.innerHTML = '<div class="empty-state">nothing here. suspiciously peaceful.</div>';
    return;
  }
  els.taskRows.innerHTML = tasks.map(task =>
    '<div class="row task-row ' + (task.status === "DONE" ? "done" : "") + '" data-id="' + esc(task.id) + '">' +
      '<div class="priority ' + task.priority.toLowerCase() + '">' + esc(task.priority) + '</div>' +
      '<div>' +
        '<div class="task-title">' + esc(task.title) + '</div>' +
        '<div class="task-meta">' + (task.status === "BLOCKED" && task.blockedBy ? "blocked: " + esc(task.blockedBy) : esc(task.description || task.doneWhen || "")) + '</div>' +
      '</div>' +
      '<div class="owner ' + (task.owner ? "" : "empty") + '">' + esc(task.owner || "UNOWNED") + '</div>' +
      '<div><span class="status ' + task.status.toLowerCase() + '">' + esc(task.status) + '</span></div>' +
      '<div class="age">' + age(task.createdAt) + '</div>' +
    '</div>'
  ).join("");
  els.taskRows.querySelectorAll(".task-row").forEach(row => {
    row.addEventListener("click", () => openTask(row.dataset.id));
  });
}

function renderSide() {
  const blockers = sortedTasks(state.board.tasks.filter(t => t.status === "BLOCKED"));
  els.blockers.innerHTML = blockers.length
    ? blockers.map(t =>
        '<div class="item blocked">' +
          '<div class="name">' + esc(t.owner || "UNOWNED") + ' -> ' + esc(t.title) + '</div>' +
          '<div class="detail">' + esc(t.blockedBy || "blocked, apparently") + '</div>' +
        '</div>'
      ).join("")
    : '<div>none</div>';

  const unowned = sortedTasks(state.board.tasks.filter(t => !t.owner && t.status !== "DONE"));
  els.unowned.innerHTML = unowned.length
    ? unowned.map(t =>
        '<div class="item unowned">' +
          '<div class="name">' + esc(t.priority) + ' -> ' + esc(t.title) + '</div>' +
          '<div class="detail">needs an owner</div>' +
        '</div>'
      ).join("")
    : '<div>none</div>';

  const open = state.board.tasks.filter(t => t.status !== "DONE");
  const critical = open.filter(t => t.priority === "P0").length;
  const done7d = state.board.tasks.filter(t => {
    return t.status === "DONE" && Date.now() - new Date(t.updatedAt).getTime() <= 7 * 86400000;
  }).length;

  els.pulse.innerHTML =
    '<div class="metric"><strong>' + critical + '</strong><span>critical</span></div>' +
    '<div class="metric"><strong>' + blockers.length + '</strong><span>blocked</span></div>' +
    '<div class="metric"><strong>' + unowned.length + '</strong><span>unowned</span></div>' +
    '<div class="metric"><strong>' + done7d + '</strong><span>done / 7d</span></div>';

  els.summary.innerHTML =
    '<strong>' + open.length + '</strong> open &nbsp;' +
    '<strong>' + blockers.length + '</strong> blocked &nbsp;' +
    '<strong>' + state.board.tasks.filter(t => t.status === "DONE").length + '</strong> done';
}

function render() {
  els.teamName.textContent = state.board.team || "TEAM";
  renderFilters();
  renderRows();
  renderSide();
}

async function loadBoard() {
  try {
    state.board = await api("/api/board");
    render();
  } catch (err) {
    if (err.message.includes("authentication") || err.message.includes("401")) {
      state.user = null;
      showAuth();
    } else {
      console.error(err);
      els.taskRows.innerHTML = '<div class="empty-state">could not load the board: ' + esc(err.message) + '</div>';
    }
  }
}

function setForm(task) {
  task = task || {};
  els.form.elements.title.value = task.title || "";
  els.form.elements.priority.value = task.priority || "P2";
  els.form.elements.status.value = task.status || "READY";
  els.form.elements.owner.value = task.owner || "";
  els.form.elements.description.value = task.description || "";
  els.form.elements.doneWhen.value = task.doneWhen || "";
  els.form.elements.blockedBy.value = task.blockedBy || "";
  toggleBlockedField();
}

function toggleBlockedField() {
  const blocked = els.form.elements.status.value === "BLOCKED";
  els.blockedByWrap.hidden = !blocked;
}

function openCreate(title) {
  state.editingId = null;
  els.dialogId.textContent = "NEW";
  els.dialogTitle.textContent = "Add work";
  els.deleteTask.hidden = true;
  setForm({ title: title || "" });
  els.dialog.showModal();
  queueMicrotask(() => {
    const target = title ? els.form.elements.priority : els.form.elements.title;
    target.focus();
  });
}

function openTask(id) {
  const task = state.board.tasks.find(t => t.id === id);
  if (!task) return;
  state.editingId = id;
  els.dialogId.textContent = "#" + id;
  els.dialogTitle.textContent = task.title;
  els.deleteTask.hidden = false;
  setForm(task);
  els.dialog.showModal();
}

function closeDialog() {
  els.dialog.close();
  state.editingId = null;
}

async function submitTask(event) {
  event.preventDefault();
  const payload = {
    title: els.form.elements.title.value,
    priority: els.form.elements.priority.value,
    status: els.form.elements.status.value,
    owner: els.form.elements.owner.value,
    description: els.form.elements.description.value,
    doneWhen: els.form.elements.doneWhen.value,
    blockedBy: els.form.elements.blockedBy.value
  };
  if (state.editingId) {
    await api("/api/tasks/" + state.editingId, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  } else {
    await api("/api/tasks", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
  closeDialog();
  await loadBoard();
}

async function deleteTask() {
  if (!state.editingId) return;
  const task = state.board.tasks.find(t => t.id === state.editingId);
  if (!task) return;
  if (!confirm('Delete #' + task.id + ' "' + task.title + '"?')) return;
  await api("/api/tasks/" + task.id, { method: "DELETE" });
  closeDialog();
  await loadBoard();
}

async function renameTeam() {
  const next = prompt("Team name", state.board.team || "");
  if (!next || next.trim() === state.board.team) return;
  await api("/api/team", {
    method: "PUT",
    body: JSON.stringify({ team: next.trim() })
  });
  await loadBoard();
}

els.form.addEventListener("submit", submitTask);
els.form.elements.status.addEventListener("change", toggleBlockedField);
els.closeDialog.addEventListener("click", closeDialog);
els.cancelTask.addEventListener("click", closeDialog);
els.deleteTask.addEventListener("click", deleteTask);
els.teamName.addEventListener("click", renameTeam);

els.quickAdd.addEventListener("keydown", event => {
  if (event.key === "Enter" && els.quickAdd.value.trim()) {
    openCreate(els.quickAdd.value.trim());
    els.quickAdd.value = "";
  }
});

els.addButton.addEventListener("click", () => {
  const title = els.quickAdd.value.trim();
  openCreate(title);
  els.quickAdd.value = "";
});

document.addEventListener("keydown", event => {
  if (event.key === "/" && !els.dialog.open && document.activeElement !== els.quickAdd) {
    event.preventDefault();
    els.quickAdd.focus();
  }
  if ((event.key || "").toLowerCase() === "n" && !els.dialog.open && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
    event.preventDefault();
    openCreate();
  }
});

async function init() {
  const loggedIn = await loadAuth();
  if (loggedIn) {
    showApp();
  } else {
    showAuth();
  }
}

init().catch(err => {
  console.error(err);
  if (els.taskRows) {
    els.taskRows.innerHTML = '<div class="empty-state">could not start: ' + esc(err.message) + '</div>';
  }
});
