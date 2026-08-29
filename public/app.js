const state = {
  board: { team: "", tasks: [] },
  filter: "ALL",
  editingId: null,
  user: null,
  selectedId: null
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
  blockedByWrap: document.querySelector("#blockedByWrap"),
  taskActions: document.querySelector("#taskActions"),
  taskHistory: document.querySelector("#taskHistory"),
  historyList: document.querySelector("#historyList")
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
  if (state.filter === "P0") return tasks.filter(t => t.priority === "P0");
  return tasks.filter(t => t.owner === state.filter);
}

function renderFilters() {
  const hasP0 = state.board.tasks.some(t => t.priority === "P0");
  const options = ["ALL", ...(hasP0 ? ["P0"] : []), ...owners(state.board.tasks), "UNOWNED", "BLOCKED", "DONE"];
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
    '<div class="row task-row ' + (task.status === "DONE" ? "done" : "") + (task.id === state.selectedId ? " selected" : "") + '" data-id="' + esc(task.id) + '">' +
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
    row.addEventListener("click", () => {
      state.selectedId = row.dataset.id;
      openTask(row.dataset.id);
    });
  });
}

function renderSide() {
  const blockers = sortedTasks(state.board.tasks.filter(t => t.status === "BLOCKED"));
  els.blockers.innerHTML = blockers.length
    ? blockers.map(t =>
        '<div class="item blocked" data-id="' + esc(t.id) + '" role="button" tabindex="0">' +
          '<div class="name">' + esc(t.owner || "UNOWNED") + ' -> ' + esc(t.title) + '</div>' +
          '<div class="detail">' + esc(t.blockedBy || "blocked, apparently") + '</div>' +
        '</div>'
      ).join("")
    : '<div>none</div>';
  els.blockers.querySelectorAll(".item[data-id]").forEach(item => {
    item.addEventListener("click", () => openTask(item.dataset.id));
    item.addEventListener("keydown", e => {
      if (e.key === "Enter") openTask(item.dataset.id);
    });
  });

  const unowned = sortedTasks(state.board.tasks.filter(t => !t.owner && t.status !== "DONE"));
  els.unowned.innerHTML = unowned.length
    ? unowned.map(t =>
        '<div class="item unowned" data-id="' + esc(t.id) + '" role="button" tabindex="0">' +
          '<div class="name">' + esc(t.priority) + ' -> ' + esc(t.title) + '</div>' +
          '<div class="detail">needs an owner</div>' +
        '</div>'
      ).join("")
    : '<div>none</div>';
  els.unowned.querySelectorAll(".item[data-id]").forEach(item => {
    item.addEventListener("click", () => openTask(item.dataset.id));
    item.addEventListener("keydown", e => {
      if (e.key === "Enter") openTask(item.dataset.id);
    });
  });

  const open = state.board.tasks.filter(t => t.status !== "DONE");
  const critical = open.filter(t => t.priority === "P0").length;
  const done7d = state.board.tasks.filter(t => {
    return t.status === "DONE" && Date.now() - new Date(t.updatedAt).getTime() <= 7 * 86400000;
  }).length;

  const pulseItems = [
    { label: "critical", value: critical, filter: "P0" },
    { label: "blocked", value: blockers.length, filter: "BLOCKED" },
    { label: "unowned", value: unowned.length, filter: "UNOWNED" },
    { label: "done / 7d", value: done7d, filter: "DONE" }
  ];
  els.pulse.innerHTML = pulseItems.map(p =>
    '<div class="metric' + (state.filter === p.filter ? " active" : "") + '" data-filter="' + p.filter + '" role="button" tabindex="0">' +
      '<strong>' + p.value + '</strong><span>' + p.label + '</span>' +
    '</div>'
  ).join("");
  els.pulse.querySelectorAll(".metric").forEach(m => {
    const act = () => {
      state.filter = m.dataset.filter;
      render();
    };
    m.addEventListener("click", act);
    m.addEventListener("keydown", e => {
      if (e.key === "Enter") act();
    });
  });

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
  els.blockedByWrap.hidden = false;
}

function openCreate(title) {
  state.editingId = null;
  els.dialogId.textContent = "NEW";
  els.dialogTitle.textContent = "Add work";
  els.deleteTask.hidden = true;
  els.taskActions.hidden = true;
  els.taskHistory.hidden = true;
  setForm({ title: title || "" });
  els.dialog.showModal();
  queueMicrotask(() => {
    const target = title ? els.form.elements.priority : els.form.elements.title;
    target.focus();
  });
}

const ACTION_DEFS = [
  { act: "take", label: "TAKE", show: t => !t.owner && t.status !== "DONE" },
  { act: "start", label: "START", show: t => t.owner && t.status === "READY" },
  { act: "block", label: "BLOCK", show: t => t.status !== "BLOCKED" && t.status !== "DONE" },
  { act: "review", label: "REVIEW", show: t => t.status === "DOING" },
  { act: "done", label: "DONE", show: t => t.status !== "DONE" }
];

function renderActions(task) {
  const visible = ACTION_DEFS.filter(d => d.show(task));
  if (!visible.length) {
    els.taskActions.hidden = true;
    return;
  }
  els.taskActions.hidden = false;
  els.taskActions.innerHTML = visible
    .map(d => '<button type="button" class="act ' + d.act + '" data-act="' + d.act + '">' + d.label + '</button>')
    .join("");
  els.taskActions.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => runAction(btn.dataset.act, task));
  });
}

async function runAction(act, task) {
  const id = task.id;
  let options = { method: "POST" };
  try {
    if (act === "take") {
      options.body = JSON.stringify({ owner: state.user.display_name || state.user.email.split("@")[0] });
    } else if (act === "block") {
      const reason = prompt("Why is this blocked?", task.blockedBy || "");
      if (reason === null) return;
      if (!reason.trim()) { alert("A blocker needs a reason."); return; }
      options.body = JSON.stringify({ reason: reason.trim() });
    }
    await api("/api/tasks/" + id + "/" + act, options);
    await loadBoard();
    const fresh = state.board.tasks.find(t => t.id === id);
    if (fresh && els.dialog.open) {
      setForm(fresh);
      renderActions(fresh);
      loadEvents(id);
    }
  } catch (err) {
    alert(err.message);
  }
}

const EVENT_LABELS = {
  created: "created",
  claimed: "took the task",
  started: "started",
  blocked: "blocked",
  unblocked: "unblocked",
  sent_to_review: "sent to review",
  completed: "marked done",
  edited: "edited",
  priority_changed: "changed priority"
};

async function loadEvents(id) {
  try {
    const events = await api("/api/tasks/" + id + "/events");
    if (!events || !events.length) {
      els.taskHistory.hidden = true;
      els.historyList.innerHTML = "";
      return;
    }
    els.taskHistory.hidden = false;
    els.historyList.innerHTML = events.map(e =>
      '<div class="history-item">' +
        '<span class="h-time">' + ago(e.created_at) + '</span>' +
        '<span class="h-who">' + esc(e.actor_name || "someone") + '</span>' +
        '<span class="h-what">' + esc(EVENT_LABELS[e.event_type] || e.event_type) + '</span>' +
      '</div>'
    ).join("");
  } catch (err) {
    els.taskHistory.hidden = true;
  }
}

function ago(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(ms / 60000));
  if (mins < 60) return mins + "m";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + "h";
  return Math.floor(hours / 24) + "d";
}

function openTask(id) {
  const task = state.board.tasks.find(t => t.id === id);
  if (!task) return;
  state.editingId = id;
  state.selectedId = id;
  els.dialogId.textContent = "#" + id;
  els.dialogTitle.textContent = task.title;
  els.deleteTask.hidden = false;
  els.taskHistory.hidden = true;
  setForm(task);
  renderActions(task);
  els.dialog.showModal();
  loadEvents(id);
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
els.form.elements.status.addEventListener("change", () => {
  toggleBlockedField();
  if (state.editingId) {
    const t = state.board.tasks.find(x => x.id === state.editingId);
    if (t) {
      const draft = Object.assign({}, t, {
        status: els.form.elements.status.value,
        owner: els.form.elements.owner.value,
        blockedBy: els.form.elements.status.value === "BLOCKED" ? els.form.elements.blockedBy.value : ""
      });
      renderActions(draft);
    }
  }
});

let blockDebounce = null;
els.form.elements.blockedBy.addEventListener("input", event => {
  const value = event.target.value.trim();

  if (!state.editingId) {
    if (value) els.form.elements.status.value = "BLOCKED";
    return;
  }

  const t = state.board.tasks.find(x => x.id === state.editingId);
  if (!t || t.status === "DONE") return;

  if (value) {
    els.form.elements.status.value = "BLOCKED";
    toggleBlockedField();
  }

  clearTimeout(blockDebounce);
  blockDebounce = setTimeout(() => {
    const reason = event.target.value.trim();
    if (!reason) return;
    persistBlock(reason, t);
  }, 400);
});

async function persistBlock(reason, task) {
  try {
    await api("/api/tasks/" + task.id + "/block", {
      method: "POST",
      body: JSON.stringify({ reason })
    });
    await loadBoard();
    const fresh = state.board.tasks.find(x => x.id === task.id);
    if (fresh && els.dialog.open) {
      setForm(fresh);
      renderActions(fresh);
      loadEvents(task.id);
    }
  } catch (err) {
    alert(err.message);
  }
}
els.closeDialog.addEventListener("click", closeDialog);
els.cancelTask.addEventListener("click", closeDialog);
els.deleteTask.addEventListener("click", deleteTask);
els.teamName.addEventListener("click", renameTeam);

els.quickAdd.addEventListener("keydown", event => {
  if (event.key === "Enter" && els.quickAdd.value.trim()) {
    event.preventDefault();
    openCreate(els.quickAdd.value.trim());
    els.quickAdd.value = "";
  }
});

els.addButton.addEventListener("click", () => {
  const title = els.quickAdd.value.trim();
  openCreate(title);
  els.quickAdd.value = "";
});

function orderedTaskIds() {
  return sortedTasks(visibleTasks()).map(t => t.id);
}

function moveSelection(dir) {
  const ids = orderedTaskIds();
  if (!ids.length) return;
  let idx = ids.indexOf(state.selectedId);
  if (idx < 0) idx = dir > 0 ? -1 : ids.length;
  const next = ids[Math.min(ids.length - 1, Math.max(0, idx + dir))];
  state.selectedId = next;
  renderRows();
}

document.addEventListener("keydown", event => {
  const tag = document.activeElement?.tagName;
  const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(tag);

  if (event.key === "/" && !els.dialog.open && document.activeElement !== els.quickAdd) {
    event.preventDefault();
    els.quickAdd.focus();
  }

  if (els.dialog.open) {
    if (typing) return;
    const k = (event.key || "").toLowerCase();
    if (k === "t" && state.editingId) {
      const t = state.board.tasks.find(x => x.id === state.editingId);
      if (t && !t.owner && t.status !== "DONE") { event.preventDefault(); runAction("take", t); }
    } else if (k === "s" && state.editingId) {
      const t = state.board.tasks.find(x => x.id === state.editingId);
      if (t && t.owner && t.status === "READY") { event.preventDefault(); runAction("start", t); }
    } else if (k === "b" && state.editingId) {
      const t = state.board.tasks.find(x => x.id === state.editingId);
      if (t && t.status !== "BLOCKED" && t.status !== "DONE") { event.preventDefault(); runAction("block", t); }
    } else if (k === "r" && state.editingId) {
      const t = state.board.tasks.find(x => x.id === state.editingId);
      if (t && t.status === "DOING") { event.preventDefault(); runAction("review", t); }
    } else if (k === "d" && state.editingId) {
      const t = state.board.tasks.find(x => x.id === state.editingId);
      if (t && t.status !== "DONE") { event.preventDefault(); runAction("done", t); }
    }
    return;
  }

  if (typing) return;

  const key = (event.key || "").toLowerCase();
  if (key === "n") {
    event.preventDefault();
    openCreate();
  } else if (event.key === "j" || event.key === "J") {
    event.preventDefault();
    moveSelection(1);
  } else if (event.key === "k" || event.key === "K") {
    event.preventDefault();
    moveSelection(-1);
  } else if (event.key === "Enter" && state.selectedId) {
    event.preventDefault();
    openTask(state.selectedId);
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
