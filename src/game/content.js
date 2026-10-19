const base = new URL('./content/', document.baseURI).href;
let indexPromise = null;
const levels = new Map();

export function loadIndex() {
  if (!indexPromise) {
    indexPromise = fetch(base + 'index.json').then((r) => {
      if (!r.ok) throw new Error('index ' + r.status);
      return r.json();
    }).catch((e) => { indexPromise = null; throw e; });
  }
  return indexPromise;
}

export function loadLevel(code) {
  if (!levels.has(code)) {
    levels.set(code, fetch(base + code + '.json').then((r) => {
      if (!r.ok) throw new Error(code + ' ' + r.status);
      return r.json();
    }).catch((e) => { levels.delete(code); throw e; }));
  }
  return levels.get(code);
}

export function levelOfTask(taskId) {
  return taskId.split('-')[0];
}

export function trackColor(track) {
  return `var(--line-${track})`;
}
