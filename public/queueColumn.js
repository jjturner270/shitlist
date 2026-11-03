/** @typedef {import("./state.js").Task} Task */
import { renderTaskCard } from "./taskCard.js";
import { renderEmpty } from "./emptyState.js";

// The table wrapper/column headers are owned by index.html; only its repeatable content lives here.
/** @param {Task[]} tasks @param {string|null} selectedId */
export function renderQueueColumn(tasks, selectedId) {
  return tasks.length
    ? tasks.map(task => renderTaskCard(task, selectedId)).join("")
    : renderEmpty("nothing here. suspiciously peaceful.");
}
