export const PROGRESS_KEY = 'pyquest.progress.v1';
export const DRAFTS_KEY = 'pyquest.drafts.v1';
export const SETTINGS_KEY = 'pyquest.settings.v1';

export const LESSON = { NONE: 0, READ: 1, PASSED: 2, EXPRESS: 3 };

export function emptyProgress() {
  return { v: 1, tasks: {}, lessons: {}, pw: {}, updated: null };
}

function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeSet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

export function loadJson(key, fallback) {
  const raw = safeGet(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

export function normalizeProgress(p) {
  const base = emptyProgress();
  if (!p || typeof p !== 'object') return base;
  return {
    v: 1,
    tasks: p.tasks && typeof p.tasks === 'object' ? p.tasks : {},
    lessons: p.lessons && typeof p.lessons === 'object' ? p.lessons : {},
    pw: p.pw && typeof p.pw === 'object' ? p.pw : {},
    updated: p.updated || null,
  };
}

function createStore(key, initial, normalize = (x) => x) {
  let state = normalize(loadJson(key, initial));
  const subs = new Set();
  return {
    get: () => state,
    set(next) {
      state = typeof next === 'function' ? next(state) : next;
      safeSet(key, JSON.stringify(state));
      subs.forEach((f) => f());
    },
    subscribe(f) { subs.add(f); return () => subs.delete(f); },
    reload() { state = normalize(loadJson(key, initial)); subs.forEach((f) => f()); },
  };
}

export const progressStore = createStore(PROGRESS_KEY, emptyProgress(), normalizeProgress);
export const draftsStore = createStore(DRAFTS_KEY, {});
export const settingsStore = createStore(SETTINGS_KEY, { theme: 'auto', fontSize: 14 });

const touch = (p) => ({ ...p, updated: new Date().toISOString() });

export function taskRecord(p, id) {
  return p.tasks[id] || { solved: false, stars: 0, hints: 0, attempts: 0, firstTry: false };
}

export function lessonRecord(p, code) {
  return p.lessons[code] || { status: 0, best: 0, read: [] };
}

export function markSectionRead(code, sectionId, allIds) {
  progressStore.set((p) => {
    const rec = lessonRecord(p, code);
    if (rec.read.includes(sectionId)) return p;
    const read = [...rec.read, sectionId];
    const allRead = allIds.every((s) => read.includes(s));
    const status = Math.max(rec.status, allRead ? LESSON.READ : LESSON.NONE);
    return touch({ ...p, lessons: { ...p.lessons, [code]: { ...rec, read, status } } });
  });
}

export function recordQuiz(code, scorePct, passed, express = false) {
  progressStore.set((p) => {
    const rec = lessonRecord(p, code);
    const status = passed ? Math.max(rec.status, express ? LESSON.EXPRESS : LESSON.PASSED) : rec.status;
    return touch({ ...p, lessons: { ...p.lessons, [code]: { ...rec, status, best: Math.max(rec.best || 0, express ? rec.best || 0 : scorePct) } } });
  });
}

export function openHint(id, n) {
  progressStore.set((p) => {
    const rec = taskRecord(p, id);
    if (rec.hints >= n) return p;
    return touch({ ...p, tasks: { ...p.tasks, [id]: { ...rec, hints: n } } });
  });
}

export function recordFail(id) {
  progressStore.set((p) => {
    const rec = taskRecord(p, id);
    if (rec.solved) return p;
    return touch({ ...p, tasks: { ...p.tasks, [id]: { ...rec, attempts: Math.min(255, rec.attempts + 1) } } });
  });
}

export function computeStars(rec, star3Python, star3Rules) {
  if (rec.hints >= 5) return 1;
  if (rec.hints > 2) return 1;
  if (rec.hints > 0) return 2;
  const needFirst = (star3Rules || []).includes('first_try');
  const first = rec.attempts === 0;
  return star3Python && (!needFirst || first) ? 3 : 2;
}

export function recordSolve(id, star3Python, star3Rules) {
  let result = null;
  progressStore.set((p) => {
    const rec = taskRecord(p, id);
    const stars = computeStars(rec, star3Python, star3Rules);
    const firstTry = rec.solved ? rec.firstTry : rec.attempts === 0;
    const next = { ...rec, solved: true, stars: Math.max(rec.stars || 0, stars), firstTry };
    result = { stars, best: next.stars, wasSolved: rec.solved };
    return touch({ ...p, tasks: { ...p.tasks, [id]: next } });
  });
  return result;
}

export function grantPassword(code) {
  progressStore.set((p) => touch({ ...p, pw: { ...p.pw, [code]: true } }));
}

export function resetProgress() {
  progressStore.set(emptyProgress());
  draftsStore.set({});
}

export function taskBaseXp(meta, xp) {
  if (meta.boss) return xp.boss;
  if (meta.difficulty >= 3) return xp.star;
  return xp.normal;
}

export function taskXp(meta, rec, xp) {
  if (!rec || !rec.solved) return 0;
  const f = xp.hint_factor[Math.min(rec.hints || 0, 5)];
  return Math.round(taskBaseXp(meta, xp) * f);
}

export function levelMeta(index, code) {
  return index.levels.find((l) => l.code === code);
}

export function bossSolved(index, p, code) {
  const lvl = levelMeta(index, code);
  if (!lvl || !lvl.available) return false;
  const boss = lvl.tasks.find((t) => t.boss);
  return Boolean(boss && p.tasks[boss.id]?.solved);
}

export function isLevelOpen(index, p, code) {
  const lvl = levelMeta(index, code);
  if (!lvl || !lvl.available) return false;
  if (p.pw[code]) return true;
  return lvl.deps.every((d) => bossSolved(index, p, d));
}

export function areTasksOpen(p, code) {
  return Boolean(p.pw[code]) || lessonRecord(p, code).status >= LESSON.PASSED;
}

export function levelStats(index, p, code) {
  const lvl = levelMeta(index, code);
  const tasks = lvl?.tasks || [];
  let solved = 0, stars = 0, xp = 0;
  for (const t of tasks) {
    const rec = p.tasks[t.id];
    if (rec?.solved) solved++;
    stars += rec?.stars || 0;
    xp += taskXp(t, rec, index.xp);
  }
  return { solved, total: tasks.length, stars, maxStars: tasks.length * 3, xp, boss: bossSolved(index, p, code) };
}

export function totalXp(index, p) {
  return index.levels.reduce((s, l) => s + (l.available ? levelStats(index, p, l.code).xp : 0), 0);
}

export function currentGrade(index, p) {
  let title = index.grades[0].title;
  for (const g of index.grades) {
    if (g.bosses.every((c) => bossSolved(index, p, c))) title = g.title;
    else break;
  }
  return title;
}

export function levelStatus(index, p, code) {
  const lvl = levelMeta(index, code);
  if (!lvl.available) return 'soon';
  if (!isLevelOpen(index, p, code)) return 'locked';
  if (bossSolved(index, p, code)) return 'done';
  if (areTasksOpen(p, code)) return 'tasks';
  return 'lesson';
}

export function mergeProgress(a, b) {
  const out = emptyProgress();
  const ids = new Set([...Object.keys(a.tasks), ...Object.keys(b.tasks)]);
  for (const id of ids) {
    const x = a.tasks[id], y = b.tasks[id];
    if (!x) { out.tasks[id] = y; continue; }
    if (!y) { out.tasks[id] = x; continue; }
    const rank = (r) => (r.solved ? 100 : 0) + (r.stars || 0) * 10 - (r.hints || 0);
    out.tasks[id] = rank(x) >= rank(y) ? x : y;
  }
  const codes = new Set([...Object.keys(a.lessons), ...Object.keys(b.lessons)]);
  for (const c of codes) {
    const x = a.lessons[c] || { status: 0, best: 0, read: [] };
    const y = b.lessons[c] || { status: 0, best: 0, read: [] };
    out.lessons[c] = { status: Math.max(x.status, y.status), best: Math.max(x.best || 0, y.best || 0), read: [...new Set([...(x.read || []), ...(y.read || [])])] };
  }
  out.pw = { ...a.pw, ...b.pw };
  out.updated = new Date().toISOString();
  return out;
}

export function summarize(index, p) {
  let solved = 0, stars = 0;
  for (const rec of Object.values(p.tasks)) { if (rec.solved) solved++; stars += rec.stars || 0; }
  return { solved, stars, xp: totalXp(index, p), grade: currentGrade(index, p) };
}
