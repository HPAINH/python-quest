import { dataSets } from '../src/data/shopdata.js';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import * as yaml from 'js-yaml';
import { marked } from 'marked';
import { createPy } from './py-node.mjs';
import { encryptSecret, hashPassword } from '../src/game/secret-node.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = join(root, 'content');
const outDir = join(root, 'public', 'content');
const strict = process.env.CI === 'true' || process.argv.includes('--strict');
const only = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
const errors = [];
const warn = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);

const readYaml = (p) => yaml.load(readFileSync(p, 'utf8'));
const map = readYaml(join(contentDir, 'map.yaml'));
const detectorsDoc = readYaml(join(contentDir, 'detectors.yaml'));
const passwords = readYaml(join(contentDir, 'passwords.yaml')) || {};
const slotsPath = join(contentDir, 'slots.json');
const slots = existsSync(slotsPath) ? JSON.parse(readFileSync(slotsPath, 'utf8')) : { tasks: [], levels: [] };

const harnessSrc = readFileSync(join(root, 'src/py/harness.py'), 'utf8');
const emitted = new Set([...harnessSrc.matchAll(/add\("([a-z_A-Z]+)"/g), ...harnessSrc.matchAll(/[[(]\("([a-z_]+)", \{/g)].map((m) => m[1]));
emitted.add('timeout');
for (const id of emitted) if (!detectorsDoc.detectors[id]) err('detectors.yaml', `нет текста для детектора ${id}`);

const levelCodes = map.levels.map((l) => l.code);
for (const code of levelCodes) if (!slots.levels.includes(code)) {
  if (strict) err('slots.json', `нет слота уровня ${code}`); else slots.levels.push(code);
}

const wordCount = (s) => (s.replace(/`[^`]*`/g, 'x').match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) || []).length;

function parseFenceInfo(info) {
  const lang = info.split(/\s+/)[0];
  const flags = info.slice(lang.length).trim();
  const res = { lang, run: /(^|\s)run(\s|$)/.test(flags), error: /(^|\s)error(\s|$)/.test(flags), wrong: /(^|\s)wrong(\s|$)/.test(flags), right: /(^|\s)right(\s|$)/.test(flags), stdin: '' };
  const m = flags.match(/stdin=("(?:[^"\\]|\\.)*")/);
  if (m) res.stdin = JSON.parse(m[1]);
  return res;
}

function parseLesson(md, where) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let title = '';
  const sections = [];
  let cur = null;
  let buf = [];
  let fence = null;
  let fenceBuf = [];
  const flushText = () => {
    const text = buf.join('\n').trim();
    if (text && cur) cur.blocks.push({ t: 'md', html: marked.parse(text), words: wordCount(text) });
    buf = [];
  };
  for (const line of lines) {
    if (fence) {
      if (line.trim() === '```') {
        const code = fenceBuf.join('\n');
        const b = { t: fence.run ? 'run' : 'code', code, lang: fence.lang };
        if (fence.run) { b.stdin = fence.stdin; b.expectError = fence.error; }
        if (fence.wrong) b.variant = 'wrong';
        if (fence.right) b.variant = 'right';
        if (!cur) err(where, 'код вне раздела'); else cur.blocks.push(b);
        fence = null; fenceBuf = [];
      } else fenceBuf.push(line);
      continue;
    }
    const f = line.match(/^```(.*)$/);
    if (f) { flushText(); fence = parseFenceInfo(f[1].trim() || 'text'); continue; }
    const h1 = line.match(/^# (.+)$/);
    if (h1 && !cur) { title = h1[1].trim(); continue; }
    const h2 = line.match(/^## (.+?)\s*\{#([a-z0-9-]+)\}\s*$/);
    if (h2) {
      flushText();
      cur = { id: h2[2], title: h2[1].trim(), blocks: [] };
      sections.push(cur);
      continue;
    }
    if (line.startsWith('## ')) err(where, `заголовок без {#id}: ${line}`);
    buf.push(line);
  }
  flushText();
  if (fence) err(where, 'незакрытый блок кода');
  return { title, sections };
}

function validateLesson(lesson, where) {
  const ids = lesson.sections.map((s) => s.id);
  if (ids[0] !== 'why') err(where, 'первый раздел должен быть {#why}');
  if (!ids.includes('mistakes')) err(where, 'нет раздела {#mistakes}');
  if (ids.at(-1) !== 'cheatsheet') err(where, 'последний раздел должен быть {#cheatsheet}');
  const theory = lesson.sections.filter((s) => !['why', 'mistakes', 'cheatsheet'].includes(s.id));
  if (theory.length < 3 || theory.length > 7) err(where, `разделов теории ${theory.length}, нужно 3–7`);
  let total = 0;
  for (const s of lesson.sections) {
    s.kind = ['why', 'mistakes', 'cheatsheet'].includes(s.id) ? s.id : 'theory';
    const words = s.blocks.filter((b) => b.t === 'md').reduce((a, b) => a + b.words, 0);
    if (s.kind === 'theory') {
      total += words;
      if (words > 150) err(where, `раздел ${s.id}: ${words} слов, максимум 150`);
      if (!s.blocks.some((b) => b.t === 'run')) err(where, `раздел ${s.id}: нет живого примера`);
    }
    if (s.kind === 'mistakes') {
      const pairs = s.blocks.filter((b) => b.variant === 'wrong').length;
      if (pairs < 3 || pairs > 5) err(where, `в частых ошибках ${pairs} пар, нужно 3–5`);
    }
    for (const b of s.blocks) delete b.words;
  }
  if (total > 1500) err(where, `теория ${total} слов, максимум 1500`);
  return total;
}

function runLessonCode(py, lesson, where, ctx = {}) {
  let n = 0;
  for (const s of lesson.sections) for (const b of s.blocks) {
    if (b.t === 'run') {
      n++;
      const t0 = Date.now();
      const r = py.call('run', { code: b.code, stdin: b.stdin || '', task: ctx });
      const ms = Date.now() - t0;
      const failed = r.error || r.limit || (r.detectors || []).some((d) => d.id.startsWith('forbidden'));
      if (b.expectError && !failed) err(where, `пример в ${s.id} должен падать, но не падает`);
      if (!b.expectError && failed) err(where, `пример в ${s.id} падает: ${JSON.stringify(r.error || r.limit)}\n${b.code}`);
      if (ms > 3000) err(where, `пример в ${s.id} выполняется ${ms} мс`);
    } else if (b.t === 'code' && b.lang === 'python' && b.variant === 'right') {
      const r = py.call('run', { code: b.code, stdin: '1\n2\n3\n4\n5', task: ctx });
      if (r.error && r.error.type === 'SyntaxError') err(where, `правильный вариант в ${s.id} не компилируется`);
    }
  }
  return n;
}

function validateQuiz(py, q, list, where, sectionIds, ctx = {}) {
  q.forEach((item, i) => {
    const w = `${where} #${i + 1}`;
    if (!item.q) err(w, 'нет вопроса');
    if (!item.explain) err(w, 'нет объяснения');
    if (item.section && !sectionIds.includes(item.section)) err(w, `нет раздела ${item.section}`);
    if (!item.section) err(w, 'нет ссылки на раздел');
    if (item.type === 'choice') {
      if (!Array.isArray(item.options) || item.options.length < 2) err(w, 'мало вариантов');
      if (typeof item.answer !== 'number' || !item.options?.[item.answer]) err(w, 'answer должен быть индексом варианта');
    } else if (item.type === 'predict') {
      const r = py.call('run', { code: item.code, stdin: item.stdin || '', task: ctx });
      const out = (r.stdout || '').split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '');
      if (r.error) err(w, 'код падает');
      if (String(item.answer) !== out) err(w, `ответ ${JSON.stringify(item.answer)}, а код выводит ${JSON.stringify(out)}`);
    } else if (item.type === 'fill') {
      const answers = Array.isArray(item.answer) ? item.answer : [item.answer];
      if (!item.code?.includes('___')) err(w, 'нет ___ в коде');
      for (const a of answers) {
        const r = py.call('run', { code: item.code.replace('___', a), stdin: item.stdin || '', task: ctx });
        const out = (r.stdout || '').trim();
        if (r.error) err(w, `с ответом ${a} код падает`);
        if (item.expect !== undefined && out !== String(item.expect).trim()) err(w, `с ответом ${a} вывод ${out}, ожидалось ${item.expect}`);
      }
      item.answer = answers.map(String);
    } else err(w, `неизвестный тип ${item.type}`);
  });
  return q;
}

function checkRules(task, where) {
  for (const r of [...(task.requires || []), ...(task.star3 || [])]) {
    if (!detectorsDoc.rules[r]) err(where, `нет текста правила ${r} в detectors.yaml`);
  }
}

const py = await createPy();
console.log(`Pyodide ${py.version}`);
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const index = {
  version: 1,
  builtAt: new Date().toISOString().slice(0, 10),
  tracks: map.tracks,
  grades: map.grades,
  xp: map.xp,
  sqlQuestUrl: map.sql_quest_url,
  detectors: detectorsDoc.detectors,
  rules: detectorsDoc.rules,
  slots: null,
  levels: [],
};

const levelDirs = {};
for (const track of readdirSync(contentDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  for (const d of readdirSync(join(contentDir, track.name), { withFileTypes: true }).filter((x) => x.isDirectory())) {
    const code = d.name.split('-')[0];
    levelDirs[code] = join(contentDir, track.name, d.name);
  }
}

const allSections = {};
let totalTasks = 0;
let totalExamples = 0;
const builtLevels = {};

for (const meta of map.levels) {
  const dir = only && !only.has(meta.code) ? null : levelDirs[meta.code];
  const entry = { ...meta, available: Boolean(dir), tasks: [] };
  index.levels.push(entry);
  if (!dir) continue;
  const where = meta.code;
  const lvl = readYaml(join(dir, 'level.yaml'));
  if (lvl.code !== meta.code) err(where, 'code в level.yaml не совпадает с папкой');
  const packages = lvl.packages || [];
  const sets = dataSets(lvl.data);
  const withData = sets.length ? sets : false;
  await py.ensure({ packages, data: sets });
  const ctx = withData ? { data_dir: 'public' } : {};
  const lesson = parseLesson(readFileSync(join(dir, 'lesson.md'), 'utf8'), `${where}/lesson.md`);
  const words = validateLesson(lesson, `${where}/lesson.md`);
  totalExamples += runLessonCode(py, lesson, `${where}/lesson.md`, ctx);
  const sectionIds = lesson.sections.map((s) => s.id);
  allSections[meta.code] = sectionIds;
  const quizDoc = readYaml(join(dir, 'quiz.yaml'));
  const quiz = validateQuiz(py, quizDoc.quiz || [], 'quiz', `${where}/quiz`, sectionIds, ctx);
  const express = validateQuiz(py, quizDoc.express || [], 'express', `${where}/express`, sectionIds, ctx);
  if (quiz.length < 4 || quiz.length > 6) err(`${where}/quiz`, `вопросов ${quiz.length}, нужно 4–6`);
  if (express.length !== 6) err(`${where}/express`, `вопросов ${express.length}, нужно 6`);

  const taskFiles = readdirSync(join(dir, 'tasks')).filter((f) => f.endsWith('.yaml')).sort();
  const tasks = [];
  for (const f of taskFiles) {
    const tw = `${where}/${f}`;
    const task = readYaml(join(dir, 'tasks', f));
    if (task.id !== f.replace(/\.yaml$/, '')) err(tw, 'id не совпадает с именем файла');
    if (!Array.isArray(task.hints) || task.hints.length !== 5) err(tw, `подсказок ${task.hints?.length ?? 0}, нужно ровно 5`);
    if (!task.lesson_section) err(tw, 'нет lesson_section');
    else if (!sectionIds.includes(task.lesson_section)) err(tw, `нет раздела урока ${task.lesson_section}`);
    if (!task.statement) err(tw, 'нет условия');
    if (!['stdio', 'function', 'fix_bug', 'predict', 'fill_gaps', 'array', 'dataframe', 'vectorize', 'value', 'plot', 'stat', 'model'].includes(task.type)) err(tw, `тип ${task.type} не поддерживается`);
    if (['fix_bug', 'fill_gaps'].includes(task.type) && !['stdio', 'function', 'value', 'model'].includes(task.base)) { err(tw, 'нужен base: stdio, function или value'); continue; }
    if (task.type === 'function' && !task.function && !task.steps) err(tw, 'function без имени функции');
    if (withData && task.data !== false) task.data = true;
    if (withData && task.type === 'predict') task.data_dir = 'public';
    if (task.type === 'vectorize') {
      task.requires = [...new Set([...(task.requires || []), 'no_loops'])];
      task.max_ms = task.max_ms || 1500;
    }
    if (task.type === 'fix_bug' && !task.starter) err(tw, 'fix_bug без starter');
    if (task.type === 'fill_gaps' && !task.template?.includes('___')) err(tw, 'fill_gaps без ___ в template');
    if (task.type === 'predict' && !task.code) err(tw, 'predict без code');
    checkRules(task, tw);
    const t0 = Date.now();
    const res = py.call('prepare', { task });
    if (res.errors.length) { res.errors.forEach((e) => err(tw, e)); continue; }
    const built = res.task;
    const ms = Date.now() - t0;
    if (ms > 4000) warn.push(`${tw}: подготовка ${ms} мс`);
    const secret = task.type === 'predict'
      ? { answer: built._answer, explain: task.hints[4] }
      : { reference: task.reference, explain: task.hints[4] };
    delete built._answer;
    built.hints = task.hints.slice(0, 4);
    built.secret = encryptSecret(task.id, JSON.stringify(secret));
    built.level = meta.code;
    if (!slots.tasks.includes(task.id)) {
      if (strict) err(tw, 'нет слота в slots.json'); else slots.tasks.push(task.id);
    }
    tasks.push(built);
    entry.tasks.push({ id: task.id, title: task.title, type: task.type, difficulty: task.difficulty || 1, boss: Boolean(task.boss), section: task.lesson_section, sql: task.sql_quest_ref || null });
    if (task.data !== true) delete built.data;
  }
  const bosses = tasks.filter((t) => t.boss);
  if (bosses.length !== 1) err(where, `боссов ${bosses.length}, нужен 1`);
  else if (tasks.at(-1) !== bosses[0]) err(where, 'босс должен быть последней задачей');
  if (lvl.expected_tasks && lvl.expected_tasks !== tasks.length) err(where, `задач ${tasks.length}, по ТЗ ${lvl.expected_tasks}`);
  totalTasks += tasks.length;
  entry.intro = lvl.intro || '';
  entry.sections = lesson.sections.map((s) => ({ id: s.id, title: s.title }));
  entry.quizCount = quiz.length;
  entry.minutes = lvl.minutes || 20;
  entry.packages = packages;
  entry.data = withData;
  const next = map.levels.find((l) => l.deps.includes(meta.code) && l.track === meta.track);
  if (passwords[meta.code]) entry.passHash = hashPassword(passwords[meta.code]);
  if (next && passwords[next.code] && bosses[0]) {
    bosses[0].unlockSecret = encryptSecret(`${bosses[0].id}:pass`, JSON.stringify({ level: next.code, password: passwords[next.code] }));
  }
  builtLevels[meta.code] = { code: meta.code, title: meta.title, intro: lvl.intro || '', packages, data: withData, lesson, quiz, express, tasks, words };
}

for (const lvl of Object.values(builtLevels)) {
  for (const t of lvl.tasks) for (const d of t.detectors || []) if (!d.message) err(t.id, `детектор ${d.id} без message`);
}
for (const [id, d] of Object.entries(detectorsDoc.detectors)) {
  if (d.lesson === 'task') continue;
  const [lv, sec] = d.lesson.split('#');
  if (allSections[lv] && !allSections[lv].includes(sec)) err('detectors.yaml', `${id}: нет раздела ${d.lesson}`);
}
for (const code of Object.keys(passwords)) if (!levelCodes.includes(code)) err('passwords.yaml', `неизвестный уровень ${code}`);

index.slots = slots;
if (errors.length) {
  console.error(`\n✗ Ошибок: ${errors.length}`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
if (only) { console.log(`✓ Проверены уровни ${[...only].join(', ')}: задач ${totalTasks}, примеров ${totalExamples} (файлы не записаны)`); process.exit(0); }
for (const [code, lvl] of Object.entries(builtLevels)) writeFileSync(join(outDir, `${code}.json`), JSON.stringify(lvl));
writeFileSync(join(outDir, 'index.json'), JSON.stringify(index));
if (!strict) writeFileSync(slotsPath, JSON.stringify(slots, null, 2) + '\n');
const hash = createHash('sha256').update(JSON.stringify(index)).digest('hex').slice(0, 8);
for (const w of warn) console.warn('  ! ' + w);
console.log(`✓ Уровней с контентом: ${Object.keys(builtLevels).length}, задач: ${totalTasks}, живых примеров: ${totalExamples}, индекс ${hash}`);
