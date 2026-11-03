import { esc } from "./state.js";

export function renderEmpty(message) {
  return `<div class="empty-state">${esc(message)}</div>`;
}
