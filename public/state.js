/**
 * @typedef {{id:string,title:string,description?:string,priority:string,status:string,owner?:string|null,blockedBy?:string,doneWhen?:string,createdAt:string,updatedAt:string}} Task
 * @typedef {{id:string|number,name:string,invite_key?:string}} Team
 */

/** @type {{board:{team:string,tasks:Task[]},filter:string,editingId:string|null,user:any,selectedId:string|null,teams:Team[],currentTeamId:string|number|null}} */
export const state = {
  board: { team: "", tasks: [] },
  filter: "ALL",
  editingId: null,
  user: null,
  selectedId: null,
  teams: [],
  currentTeamId: null
};

export const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 };
export const STATUS_ORDER = { DOING: 0, BLOCKED: 1, REVIEW: 2, READY: 3, DONE: 4 };

export const ACTION_DEFS = [
  { act: "take", label: "TAKE", show: t => !t.owner && t.status !== "DONE" },
  { act: "start", label: "START", show: t => t.owner && t.status === "READY" },
  { act: "block", label: "BLOCK", show: t => t.status !== "BLOCKED" && t.status !== "DONE" },
  { act: "review", label: "REVIEW", show: t => t.status === "DOING" },
  { act: "done", label: "DONE", show: t => t.status !== "DONE" }
];

export const EVENT_LABELS = {
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

export function esc(value) {
  if (value == null) return "";
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function age(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(ms / 60000));
  if (mins < 60) return mins + "m";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + "h";
  return Math.floor(hours / 24) + "d";
}

export function ago(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(ms / 60000));
  if (mins < 60) return mins + "m";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + "h";
  return Math.floor(hours / 24) + "d";
}

/** @param {Task[]} tasks */
export function owners(tasks) {
  return [...new Set(tasks.map(t => t.owner).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/** @param {Task[]} tasks */
export function sortedTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const doneDelta = Number(a.status === "DONE") - Number(b.status === "DONE");
    if (doneDelta) return doneDelta;
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (p) return p;
    const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (s) return s;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export function visibleTasks() {
  const tasks = state.board.tasks;
  if (state.filter === "ALL") return tasks;
  if (state.filter === "UNOWNED") return tasks.filter(t => !t.owner && t.status !== "DONE");
  if (state.filter === "BLOCKED") return tasks.filter(t => t.status === "BLOCKED");
  if (state.filter === "DONE") return tasks.filter(t => t.status === "DONE");
  if (state.filter === "P0") return tasks.filter(t => t.priority === "P0");
  return tasks.filter(t => t.owner === state.filter);
}

export function orderedTaskIds() {
  return sortedTasks(visibleTasks()).map(t => t.id);
}
