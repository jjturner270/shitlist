/** @typedef {import("./state.js").Task} Task */
import { esc, age } from "./state.js";
import { renderStatusBadge } from "./statusBadge.js";

/** @param {Task} task @param {string|null} selectedId */
export function renderTaskCard(task, selectedId) {
  return '<div class="row task-row ' + (task.status === "DONE" ? "done" : "") + (task.id === selectedId ? " selected" : "") + '" data-id="' + esc(task.id) + '">' +
    '<div class="priority ' + esc(task.priority.toLowerCase()) + '">' + esc(task.priority) + '</div>' +
    '<div>' +
      '<div class="task-title">' + esc(task.title) + '</div>' +
      '<div class="task-meta">' + (task.status === "BLOCKED" && task.blockedBy ? "blocked: " + esc(task.blockedBy) : esc(task.description || task.doneWhen || "")) + '</div>' +
    '</div>' +
    '<div class="owner ' + (task.owner ? "" : "empty") + '">' + esc(task.owner || "UNOWNED") + '</div>' +
    '<div>' + renderStatusBadge(task.status) + '</div>' +
    '<div class="age">' + age(task.createdAt) + '</div>' +
  '</div>';
}
