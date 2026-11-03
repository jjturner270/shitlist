import { state, esc, age, owners, sortedTasks, visibleTasks, orderedTaskIds, ACTION_DEFS } from "./state.js";
import {
  runAction, loadEvents, loadTeams, loadBoard,
  handleLogin, handleRegister, logout, switchTeam, joinTeam,
  copyInviteKey, importCsv, persistBlock, submitTask, deleteTask, renameTeam
} from "./services.js";

export const els = {
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
  teamSwitcher: document.querySelector("#teamSwitcher"),
  inviteKey: document.querySelector("#inviteKey"),
  joinButton: document.querySelector("#joinButton"),
  importButton: document.querySelector("#importButton"),
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

export function showAuth() {
  els.authOverlay.hidden = false;
  els.appShell.hidden = true;
  els.loginForm.hidden = false;
  els.registerForm.hidden = true;
  els.authError.textContent = "";
  els.authError2.textContent = "";
}

export function showApp() {
  els.authOverlay.hidden = true;
  els.appShell.hidden = false;
  els.userName.textContent = state.user.display_name || state.user.email;
  loadTeams();
  loadBoard();
}

export function renderTeamSwitcher() {
  els.teamSwitcher.innerHTML = state.teams.map(t =>
    '<option value="' + esc(t.id) + '"' + (t.id === state.currentTeamId ? " selected" : "") + '>' + esc(t.name) + '</option>'
  ).join("");
}

export function renderInviteKey() {
  const current = state.teams.find(t => t.id === state.currentTeamId);
  els.inviteKey.textContent = current ? "KEY " + current.invite_key : "KEY";
  els.inviteKey.title = current ? "click to copy " + current.invite_key : "";
}

export function renderFilters() {
  const hasP0 = state.board.tasks.some(t => t.priority === "P0");
  const options = ["ALL", ...(hasP0 ? ["P0"] : []), ...owners(state.board.tasks), "UNOWNED", "BLOCKED", "DONE"];
  els.filters.innerHTML = options.map(name =>
    '<button class="filter ' + (state.filter === name ? "active" : "") + '" data-filter="' + esc(name) + '">' + esc(name) + '</button>'
  ).join("");
  els.filters.querySelectorAll(".filter").forEach(btn => {
    btn.addEventListener("click", () => {
      console.log('[#filters] clicked -> render()');
      state.filter = btn.dataset.filter;
      render();
    });
  });
}

export function renderRows() {
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
      console.log('[#taskRows] clicked -> openTask()');
      state.selectedId = row.dataset.id;
      openTask(row.dataset.id);
    });
  });
}

export function renderSide() {
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
    item.addEventListener("click", () => {
      console.log('[#blockers] clicked -> openTask()');
      openTask(item.dataset.id);
    });
    item.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        console.log('[#blockers] interacted -> openTask()');
        openTask(item.dataset.id);
      }
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
    item.addEventListener("click", () => {
      console.log('[#unowned] clicked -> openTask()');
      openTask(item.dataset.id);
    });
    item.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        console.log('[#unowned] interacted -> openTask()');
        openTask(item.dataset.id);
      }
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
      console.log('[#pulse] clicked -> render()');
      state.filter = m.dataset.filter;
      render();
    };
    m.addEventListener("click", act);
    m.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        console.log('[#pulse] interacted -> render()');
        act();
      }
    });
  });

  els.summary.innerHTML =
    '<strong>' + open.length + '</strong> open &nbsp;' +
    '<strong>' + blockers.length + '</strong> blocked &nbsp;' +
    '<strong>' + state.board.tasks.filter(t => t.status === "DONE").length + '</strong> done';
}

export function render() {
  els.teamName.textContent = state.board.team || "TEAM";
  renderFilters();
  renderRows();
  renderSide();
}

export function setForm(task) {
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

export function toggleBlockedField() {
  els.blockedByWrap.hidden = false;
}

export function openCreate(title) {
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

export function renderActions(task) {
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
    btn.addEventListener("click", () => {
      console.log('[#taskActions] clicked -> runAction()');
      runAction(btn.dataset.act, task);
    });
  });
}

export function openTask(id) {
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

export function closeDialog() {
  els.dialog.close();
  state.editingId = null;
}

export function moveSelection(dir) {
  const ids = orderedTaskIds();
  if (!ids.length) return;
  let idx = ids.indexOf(state.selectedId);
  if (idx < 0) idx = dir > 0 ? -1 : ids.length;
  const next = ids[Math.min(ids.length - 1, Math.max(0, idx + dir))];
  state.selectedId = next;
  renderRows();
}

let blockDebounce = null;

export function setup() {
  els.showRegister.addEventListener("click", () => {
    console.log('[#showRegister] clicked -> showAuth()');
    els.loginForm.hidden = true;
    els.registerForm.hidden = false;
    els.authError.textContent = "";
    els.authError2.textContent = "";
  });

  els.showLogin.addEventListener("click", () => {
    console.log('[#showLogin] clicked -> showAuth()');
    els.registerForm.hidden = true;
    els.loginForm.hidden = false;
    els.authError.textContent = "";
    els.authError2.textContent = "";
  });

  els.loginForm.addEventListener("submit", handleLogin);
  els.registerForm.addEventListener("submit", handleRegister);
  els.logoutButton.addEventListener("click", logout);

  els.teamSwitcher.addEventListener("change", event => {
    console.log('[#teamSwitcher] changed -> switchTeam()');
    if (event.target.value) switchTeam(event.target.value);
  });
  els.inviteKey.addEventListener("click", copyInviteKey);
  els.joinButton.addEventListener("click", joinTeam);
  els.importButton.addEventListener("click", importCsv);

  els.form.addEventListener("submit", submitTask);
  els.form.elements.status.addEventListener("change", () => {
    console.log('[#taskForm] changed -> toggleBlockedField()');
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

  els.form.elements.blockedBy.addEventListener("input", event => {
    console.log('[#taskForm] input -> persistBlock()');
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

  function handleCloseDialog() {
    console.log('[#closeDialog] clicked -> handleCloseDialog()');
    closeDialog();
  }

  function handleCancelTask() {
    console.log('[#cancelTask] clicked -> handleCancelTask()');
    const id = state.editingId;
    if (id) {
      const task = state.board.tasks.find(t => t.id === id);
      setForm(task);
    } else {
      setForm({});
    }
    closeDialog();
  }

  els.closeDialog.addEventListener("click", handleCloseDialog);
  els.cancelTask.addEventListener("click", handleCancelTask);
  els.deleteTask.addEventListener("click", deleteTask);
  els.teamName.addEventListener("click", renameTeam);

  els.quickAdd.addEventListener("keydown", event => {
    if (event.key === "Enter" && els.quickAdd.value.trim()) {
      console.log('[#quickAdd] interacted -> openCreate()');
      event.preventDefault();
      openCreate(els.quickAdd.value.trim());
      els.quickAdd.value = "";
    }
  });

  els.addButton.addEventListener("click", () => {
    console.log('[#addButton] clicked -> openCreate()');
    const title = els.quickAdd.value.trim();
    openCreate(title);
    els.quickAdd.value = "";
  });

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
}

export async function init() {
  try {
    const loggedIn = await loadAuth();
    if (loggedIn) {
      showApp();
    } else {
      showAuth();
    }
  } catch (err) {
    console.error(err);
    if (els.taskRows) {
      els.taskRows.innerHTML = '<div class="empty-state">could not start: ' + esc(err.message) + '</div>';
    }
  }
}
