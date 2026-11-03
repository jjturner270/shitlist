import { esc } from "./state.js";

export function renderTaskItem(task, type) {
  if (type !== "blocked" && type !== "unowned") throw new Error("Unknown task item type");
  const name = type === "blocked"
    ? `${task.owner || "UNOWNED"} -> ${task.title}`
    : `${task.priority} -> ${task.title}`;
  const detail = type === "blocked" ? (task.blockedBy || "blocked, apparently") : "needs an owner";
  return `<div class="item ${type}" data-id="${esc(task.id)}" role="button" tabindex="0">` +
    `<div class="name">${esc(name)}</div><div class="detail">${esc(detail)}</div></div>`;
}
