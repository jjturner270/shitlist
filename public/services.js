import { state, esc, ago, EVENT_LABELS } from "./state.js";
import { renderEmpty } from "./emptyState.js";
import { els, render, setForm, renderActions, closeDialog, showApp, showAuth, renderTeamSwitcher, renderInviteKey } from "./components.js";

export async function api(url, options = {}) {
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

export async function loadAuth() {
  try {
    const data = await api("/api/auth/me");
    if (data && data.user) {
      state.user = data.user;
      return true;
    }
  } catch {}
  return false;
}

export async function handleLogin(event) {
  console.log('[#loginForm] submitted -> handleLogin()');
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

export async function handleRegister(event) {
  console.log('[#registerForm] submitted -> handleRegister()');
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

export async function logout() {
  console.log('[#logoutButton] clicked -> logout()');
  await api("/api/auth/logout", { method: "POST" });
  state.user = null;
  showAuth();
}

export async function loadTeams() {
  try {
    const data = await api("/api/teams");
    state.teams = data.teams || [];
    state.currentTeamId = data.current || null;
    renderTeamSwitcher();
    renderInviteKey();
  } catch (err) {
    console.error(err);
  }
}

export async function switchTeam(teamId) {
  try {
    await api("/api/teams/switch", {
      method: "POST",
      body: JSON.stringify({ team_id: teamId })
    });
    state.currentTeamId = teamId;
    state.filter = "ALL";
    await loadTeams();
    await loadBoard();
  } catch (err) {
    alert(err.message);
  }
}

export async function joinTeam() {
  console.log('[#joinButton] clicked -> joinTeam()');
  const key = prompt("Enter team invite key");
  if (!key || !key.trim()) return;
  try {
    const data = await api("/api/teams/join", {
      method: "POST",
      body: JSON.stringify({ key: key.trim() })
    });
    state.currentTeamId = data.team.id;
    state.filter = "ALL";
    await loadTeams();
    await loadBoard();
  } catch (err) {
    alert(err.message);
  }
}

export async function copyInviteKey() {
  console.log('[#inviteKey] clicked -> copyInviteKey()');
  const current = state.teams.find(t => t.id === state.currentTeamId);
  if (!current) return;
  try {
    await navigator.clipboard.writeText(current.invite_key);
    els.inviteKey.textContent = "COPIED";
    setTimeout(() => renderInviteKey(), 1200);
  } catch (err) {
    alert("Invite key: " + current.invite_key);
  }
}

let importInput = null;

export function importCsv() {
  console.log('[#importButton] clicked -> importCsv()');
  if (!importInput) {
    importInput = document.createElement("input");
    importInput.type = "file";
    importInput.accept = ".csv,text/csv";
    importInput.addEventListener("change", async () => {
      const file = importInput.files && importInput.files[0];
      importInput.value = "";
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        alert("File too large (max 5MB)");
        return;
      }
      try {
        const text = await file.text();
        const result = await api("/api/import/csv", {
          method: "POST",
          body: JSON.stringify({ csv: text })
        });
        state.filter = "ALL";
        await loadBoard();
        const msg = "imported " + result.imported + " task" + (result.imported === 1 ? "" : "s") +
          (result.skipped ? ", skipped " + result.skipped + " rows without a title" : "");
        alert(msg);
      } catch (err) {
        alert("import failed: " + err.message);
      }
    });
  }
  importInput.click();
}

export async function loadBoard() {
  try {
    state.board = await api("/api/board");
    render();
  } catch (err) {
    if (err.message.includes("authentication") || err.message.includes("401")) {
      state.user = null;
      showAuth();
    } else {
      console.error(err);
      els.taskRows.innerHTML = renderEmpty("could not load the board: " + err.message);
    }
  }
}

export async function runAction(act, task) {
  console.log('[#taskDialog] clicked -> runAction()');
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

export async function loadEvents(id) {
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

export async function submitTask(event) {
  console.log('[#taskForm] submitted -> submitTask()');
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

export async function deleteTask() {
  console.log('[#deleteTask] clicked -> deleteTask()');
  if (!state.editingId) return;
  const task = state.board.tasks.find(t => t.id === state.editingId);
  if (!task) return;
  if (!confirm('Delete #' + task.id + ' "' + task.title + '"?')) return;
  await api("/api/tasks/" + task.id, { method: "DELETE" });
  closeDialog();
  await loadBoard();
}

export async function renameTeam() {
  console.log('[#teamName] clicked -> renameTeam()');
  const next = prompt("Team name", state.board.team || "");
  if (!next || next.trim() === state.board.team) return;
  await api("/api/team", {
    method: "PUT",
    body: JSON.stringify({ team: next.trim() })
  });
  await loadBoard();
}

export async function persistBlock(reason, task) {
  console.log('[#taskForm] input -> persistBlock()');
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
