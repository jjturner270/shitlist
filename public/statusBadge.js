import { esc } from "./state.js";

export function renderStatusBadge(status) {
  return `<span class="status ${esc(String(status).toLowerCase())}">${esc(status)}</span>`;
}
