import { state, ACTION_DEFS, esc } from "./state.js";
import { els } from "./components.js";
import { runAction, loadEvents } from "./services.js";

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

