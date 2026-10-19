import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { decryptSecret } from '../src/game/secret-node.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:4173/';
const SHOTS = process.env.SHOTS || 'e2e/screenshots';
mkdirSync(SHOTS, { recursive: true });
const index = JSON.parse(readFileSync('public/content/index.json', 'utf8'));
const levelData = (c) => JSON.parse(readFileSync(`public/content/${c}.json`, 'utf8'));
const LEVELS = index.levels.filter((l) => l.available).map((l) => l.code);

let server = null;
async function ensureServer() {
  try { await fetch(BASE); return; } catch {}
  server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { await new Promise((r) => setTimeout(r, 200)); try { await fetch(BASE); return; } catch {} }
  throw new Error('preview server did not start');
}

const results = [];
const ok = (name, cond, detail = '') => { results.push({ name, pass: Boolean(cond), detail }); console.log(`${cond ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };

async function newPage(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, ...opts });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  return { ctx, page };
}

async function goto(page, path) {
  await page.goto(BASE + '#/' + path);
  await page.waitForTimeout(80);
}

async function setCode(page, code) {
  await page.waitForSelector('.task-work .editor .cm-content');
  await page.evaluate((c) => {
    const v = document.querySelector('.task-work .editor').__pqView;
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: c } });
  }, code);
}

async function readLesson(page) {
  const n = await page.locator('.lesson-body .sentinel').count();
  for (let i = 0; i < n; i++) {
    await page.locator('.lesson-body .sentinel').nth(i).scrollIntoViewIfNeeded();
    await page.waitForTimeout(40);
  }
  await page.waitForSelector('#quiz .quiz-list');
}

async function answerQuiz(page, scope, questions, wrongIdx = new Set()) {
  const qs = page.locator(`${scope} .quiz-q`);
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const el = qs.nth(i);
    const wrong = wrongIdx.has(i);
    if (q.type === 'choice') await el.locator('label.choice').nth(wrong ? (q.answer + 1) % q.options.length : q.answer).click();
    else if (q.type === 'predict') await el.locator('textarea').fill(wrong ? 'неверно' : String(q.answer));
    else await el.locator('input.mono').fill(wrong ? 'неверно' : q.answer[0]);
  }
}

async function main() {
  await ensureServer();
  const browser = await chromium.launch();
  const { page } = await newPage(browser);
  const passwords = {};
  const timings = [];
  const firstLoad = {};
  const solved = [];

  await goto(page, '');
  await page.waitForSelector('.wordmark');
  ok('стартовый экран загружается', true);

  await goto(page, 'task/C0-01-sum');
  ok('задачи закрыты до урока', await page.locator('text=Сначала урок').isVisible());
  await goto(page, 'level/C1');
  ok('уровень C1 закрыт до босса C0', await page.locator('h1:has-text("закрыт")').isVisible());

  for (const code of LEVELS) {
    const data = levelData(code);
    await goto(page, 'lesson/' + code);
    await page.waitForSelector('.lesson-body');
    if (code === 'C1') {
      await page.click('button:has-text("Я знаю тему")');
      await answerQuiz(page, '.modal', data.express, new Set([2]));
      await page.click('.modal button:has-text("Сдать тест")');
      ok('экспресс-тест 5 из 6 не открывает задачи', await page.locator('.modal .bad-text').isVisible());
      await page.click('.modal button:has-text("Пройти ещё раз")');
      await answerQuiz(page, '.modal', data.express);
      await page.click('.modal button:has-text("Сдать тест")');
      ok('экспресс-тест 6 из 6 открывает задачи', await page.locator('.modal .ok-text').isVisible());
      await page.keyboard.press('Escape');
    } else {
      ok(`${code}: самопроверка закрыта до чтения разделов`, await page.locator('#quiz .locked-note').isVisible());
      if (code === 'P1') {
        const t0 = Date.now();
        await page.locator('.example .btn.run').first().click();
        await page.waitForSelector('.example .out-wrap', { timeout: 180000 });
        ok('пример pandas загружает пакеты', (await page.textContent('.example .out-wrap')).includes('кофе'), `${Date.now() - t0} мс`);
      }
      if (code === 'C0') {
        const t0 = Date.now();
        await page.locator('.example .btn.run').first().click();
        await page.waitForSelector('.example .out-wrap', { timeout: 60000 });
        ok('живой пример урока выполняется', (await page.textContent('.example .out-wrap')).includes('750'), `${Date.now() - t0} мс с загрузкой Python`);
      }
      await readLesson(page);
      if (code === 'C0') {
        await answerQuiz(page, '#quiz', data.quiz, new Set([0, 1, 2]));
        await page.click('#quiz button:has-text("Проверить ответы")');
        ok('самопроверка ниже 80% не открывает задачи', await page.locator('#quiz .bad-text').isVisible());
        await page.click('#quiz button:has-text("Пройти ещё раз")');
      }
      await answerQuiz(page, '#quiz', data.quiz);
      await page.click('#quiz button:has-text("Проверить ответы")');
      ok(`${code}: самопроверка открывает задачи`, await page.waitForSelector('#quiz .passed-note, #quiz .ok-text', { timeout: 5000 }).then(() => true).catch(() => false));
    }

    for (const t of data.tasks) {
      await goto(page, 'task/' + t.id);
      await page.waitForSelector('.task-work');
      const secret = JSON.parse(decryptSecret(t.id, t.secret));
      if (t.type === 'predict') await page.fill('.predict-field textarea', secret.answer);
      else await setCode(page, secret.reference);
      const t0 = Date.now();
      await page.click('.toolbar button:has-text("Проверить")');
      const wait = code.startsWith('C') ? 30000 : 240000;
      const res = await Promise.race([
        page.waitForSelector('.success', { timeout: wait }).then(() => 'ok'),
        page.waitForSelector('.check.bad', { timeout: wait }).then(() => 'bad'),
      ]).catch(() => 'timeout');
      const ms = Date.now() - t0;
      solved.push(t.id);
      if (!firstLoad[code]) { firstLoad[code] = ms; } else timings.push([t.id, ms]);
      if (res !== 'ok') { ok(`${t.id} решается эталоном`, false, res + ' ' + (await page.textContent('.console-body').catch(() => ''))); continue; }
      const stars = await page.locator('.success .stars .on').count();
      const hasNext = index.levels.some((l) => l.track === index.levels.find((x) => x.code === code).track && l.deps.includes(code));
      if (t.boss && hasNext) {
        const pw = await page.locator('.unlock code').textContent().catch(() => null);
        if (pw) passwords[code] = pw;
        ok(`${code}: босс выдаёт пароль следующего уровня`, Boolean(pw), pw || '');
      }
      if (stars < 2) ok(`${t.id} звёзды`, false, String(stars));
      await page.keyboard.press('Escape');
    }
    const solvedCount = data.tasks.length;
    ok(`${code}: все ${solvedCount} задач решены эталоном`, solved.filter((id) => id.startsWith(code + '-')).length === solvedCount && !results.some((r) => !r.pass && r.name.startsWith(code + '-')));
  }

  const core = timings.filter(([id]) => id.startsWith('C'));
  const isMl = (id) => /^[MD]\d/.test(id);
  const lib = timings.filter(([id]) => !id.startsWith('C') && !isMl(id));
  const ml = timings.filter(([id]) => isMl(id));
  const slowest = (list) => list.slice().sort((a, b) => b[1] - a[1]).slice(0, 3);
  const med = (list) => list.map((t) => t[1]).sort((a, b) => a - b)[Math.floor(list.length / 2)];
  ok('самая долгая проверка ядра укладывается в лимит 5 с', slowest(core)[0][1] < 5000, slowest(core).map(([id, ms]) => `${id} ${ms} мс`).join(', '));
  ok('медианная проверка задачи ядра не дольше 1 с', med(core) <= 1000, `${med(core)} мс`);
  ok('самая долгая проверка задач библиотек укладывается в лимит 15 с', slowest(lib)[0][1] < 15000, slowest(lib).map(([id, ms]) => `${id} ${ms} мс`).join(', '));
  ok('медианная проверка задачи библиотек не дольше 3 с', med(lib) <= 3000, `${med(lib)} мс`);
  ok('самая долгая проверка ML-задачи укладывается в 60 с', slowest(ml)[0][1] < 60000, slowest(ml).map(([id, ms]) => `${id} ${ms} мс`).join(', '));
  console.log('  первая проверка уровня (с загрузкой пакетов и данных):', JSON.stringify(firstLoad));

  await goto(page, 'data');
  await page.waitForSelector('.data-table');
  ok('экран «Данные» показывает таблицы ShopData всех наборов', (await page.locator('.data-table').count()) >= 12);
  await page.screenshot({ path: `${SHOTS}/data.png`, fullPage: false });

  await goto(page, 'map');
  await page.waitForSelector('.station');
  ok('все уровни отмечены пройденными', await page.locator('.station.st-done').count() === LEVELS.length);
  await page.screenshot({ path: `${SHOTS}/map-done.png`, fullPage: true });
  await goto(page, 'progress');
  await page.waitForSelector('.savecode');
  await page.waitForFunction(() => document.querySelector('.savecode').textContent.startsWith('PQ1-'));
  const grade = await page.textContent('.progress-head h1');
  ok('грейд после всех этапов — DS-ready', grade === 'DS-ready', grade);
  const xp = await page.textContent('.big-stats div:first-child dd');
  const saveCode = await page.textContent('.savecode');
  ok('код сохранения выдан', saveCode.startsWith('PQ1-'), `${saveCode.length} символов, ${xp} XP`);
  await page.screenshot({ path: `${SHOTS}/progress.png`, fullPage: true });

  await goto(page, 'task/C2-09-fix-loop');
  await page.waitForSelector('.task-work');
  await setCode(page, 'n = int(input())\ntotal = 0\ni = 1\nwhile i <= n:\n    total += i\nprint(total)');
  let t0 = Date.now();
  await page.click('.toolbar button:has-text("Проверить")');
  await page.waitForSelector('.check.bad', { timeout: 30000 });
  const loopText = await page.textContent('.check.bad');
  ok('бесконечный цикл останавливается', /не остановилась|5 секунд/.test(loopText), `${Date.now() - t0} мс`);
  await setCode(page, 'n = int(input())\ntotal = 0\ni = 1\nwhile i <= n:\n    total += i\n    i += 1\nprint(total)');
  t0 = Date.now();
  await page.click('.toolbar button:has-text("Проверить")');
  ok('после остановки игра работает без перезагрузки', await page.waitForSelector('.success', { timeout: 30000 }).then(() => true).catch(() => false), `${Date.now() - t0} мс`);
  await page.keyboard.press('Escape');

  await goto(page, 'task/C0-01-sum');
  await page.waitForSelector('.task-work');
  await setCode(page, 'print(sum(range(10 ** 15)))');
  t0 = Date.now();
  await page.click('.toolbar button:has-text("Проверить")');
  await page.waitForSelector('.check.bad', { timeout: 30000 });
  ok('зависание во встроенной функции останавливается по лимиту 5 с', (await page.textContent('.check.bad')).includes('5 секунд'), `${Date.now() - t0} мс`);
  await setCode(page, 'a = int(input())\nb = int(input())\nprint(a + b)');
  t0 = Date.now();
  await page.click('.toolbar button:has-text("Проверить")');
  ok('после перезапуска Python проверка снова работает', await page.waitForSelector('.success', { timeout: 30000 }).then(() => true).catch(() => false), `${Date.now() - t0} мс`);
  await page.keyboard.press('Escape');

  await goto(page, 'task/C0-02-five-ops');
  await page.waitForSelector('.task-work');
  await setCode(page, 'answers = {"7 3": "10 4 21 2 1", "20 5": "25 15 100 4 0"}\nprint(answers.get(input(), "0"))');
  await page.click('.toolbar button:has-text("Проверить")');
  await page.waitForSelector('.check.bad');
  ok('захардкоженный ответ отклоняется на скрытых тестах', (await page.textContent('.check.bad')).includes('скрыт'));
  await page.screenshot({ path: `${SHOTS}/task-hidden-fail.png` });

  await goto(page, 'task/V1-01-line');
  await page.waitForSelector('.task-work');
  ok('у задачи на график показан ожидаемый график', (await page.locator('.examples .pv-image').count()) === 1);
  await setCode(page, "delivered = orders[orders['status'] == 'delivered']\nm = delivered.resample('MS', on='order_date')['amount'].sum()\nfig, ax = plt.subplots()\nax.plot(m.index, m.values)");
  await page.click('.toolbar button:has-text("Проверить")');
  await page.waitForSelector('.check.bad', { timeout: 60000 });
  ok('график без подписей отклоняется с подсказкой и картинкой', (await page.textContent('.check.bad')).includes('подпис') && (await page.locator('.check.bad .pv-image').count()) >= 1);
  await page.screenshot({ path: `${SHOTS}/task-plot.png` });
  await page.click('.toolbar button:has-text("Запустить")');
  ok('«Запустить» показывает график картинкой', await page.waitForSelector('.out-wrap .pv-image', { timeout: 60000 }).then(() => true).catch(() => false));

  await goto(page, 'task/S3-09-fix-decision');
  await page.waitForSelector('.task-work');
  await setCode(page, levelData('S3').tasks.find((t) => t.id === 'S3-09-fix-decision').starter);
  await page.click('.toolbar button:has-text("Проверить")');
  await page.waitForSelector('.check.bad', { timeout: 60000 });
  ok('неверный вывод об H0 получает подсказку', (await page.textContent('.check.bad')).includes('H0'));

  await goto(page, 'task/C0-11-reverse-number');
  await page.waitForSelector('.hints');
  for (let n = 1; n <= 4; n++) await page.click('.hint-btn:not(.disabled)');
  await page.click('.hint-btn:not(.disabled)');
  ok('пятая подсказка просит подтверждение', await page.locator('.hint-confirm').isVisible());
  await page.click('.hint-confirm button:has-text("Открыть")');
  await page.waitForSelector('.hint-body pre >> nth=1');
  ok('пятая подсказка показывает эталон', (await page.locator('.hints .hint-body').last().textContent()).includes('n // 1000'));
  await page.click('button:has-text("Урок C0")');
  ok('урок открывается в боковой панели', await page.locator('.drawer #sec-C0-arithmetic').isVisible());
  await page.screenshot({ path: `${SHOTS}/task-drawer.png` });

  const b = await newPage(browser);
  await goto(b.page, '');
  await b.page.click('text=Ввести код сохранения');
  await b.page.fill('.modal textarea', saveCode);
  await b.page.click('.modal button:has-text("Загрузить прогресс")');
  await b.page.waitForSelector('.station');
  await goto(b.page, 'progress');
  await b.page.waitForSelector('.big-stats');
  const xp2 = await b.page.textContent('.big-stats div:first-child dd');
  ok('код сохранения восстанавливает прогресс в чистом браузере', xp2 === xp, `${xp2} XP`);
  const broken = saveCode.slice(0, 12) + (saveCode[12] === 'A' ? 'B' : 'A') + saveCode.slice(13);
  await b.page.click('.save button:has-text("Ввести код")');
  await b.page.fill('.modal textarea', broken);
  await b.page.click('.modal button:has-text("Загрузить прогресс")');
  ok('испорченный код отклоняется', await b.page.locator('.modal .form-error').isVisible(), await b.page.textContent('.modal .form-error'));
  await b.page.keyboard.press('Escape');
  ok('после испорченного кода прогресс не потерян', (await b.page.textContent('.big-stats div:first-child dd')) === xp);

  const c = await newPage(browser);
  await goto(c.page, '');
  await c.page.evaluate(() => localStorage.setItem('pyquest.progress.v1', JSON.stringify({ v: 1, tasks: { 'C0-01-sum': { solved: true, stars: 3, hints: 0, attempts: 0, firstTry: true } }, lessons: { C0: { status: 2, best: 100, read: [] } }, pw: {}, updated: null })));
  await c.page.reload();
  await c.page.click('text=Ввести код сохранения');
  await c.page.fill('.modal textarea', saveCode);
  await c.page.click('.modal button:has-text("Загрузить прогресс")');
  ok('при существующем прогрессе показывается сравнение', await c.page.waitForSelector('.compare', { timeout: 5000 }).then(() => true).catch(() => false));
  await c.page.click('.modal button:has-text("Объединить")');
  await goto(c.page, 'progress');
  await c.page.waitForSelector('.big-stats');
  ok('объединение прогресса', (await c.page.textContent('.big-stats div:first-child dd')) === xp);

  const d = await newPage(browser);
  await goto(d.page, '');
  await d.page.click('text=Ввести пароль уровня');
  await d.page.fill('.modal input', 'not-a-password');
  await d.page.click('.modal button:has-text("Открыть уровень")');
  ok('неверный пароль отклоняется', await d.page.locator('.modal .form-error').isVisible());
  await d.page.fill('.modal input', (passwords.C2 || '').toLowerCase());
  await d.page.click('.modal button:has-text("Открыть уровень")');
  await d.page.waitForSelector('.task-list');
  ok('пароль открывает уровень C3 и его задачи в чистом браузере', (await d.page.locator('.gate').count()) === 0 && d.page.url().endsWith('level/C3'), passwords.C2);
  await goto(d.page, 'level/C2');
  ok('пароль не открывает другие уровни', await d.page.locator('h1:has-text("закрыт")').isVisible());

  const m = await newPage(browser, { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  await goto(m.page, '');
  await m.page.evaluate((code) => localStorage.setItem('pyquest.progress.v1', code), JSON.stringify({ v: 1, tasks: {}, lessons: { C0: { status: 2, best: 100, read: [] } }, pw: {}, updated: null }));
  for (const [path, name] of [['', 'start'], ['map', 'map'], ['lesson/C0', 'lesson'], ['task/C0-05-time', 'task'], ['progress', 'progress'], ['level/C0', 'level']]) {
    await goto(m.page, path);
    await m.page.reload();
    await m.page.waitForTimeout(500);
    const w = await m.page.evaluate(() => document.documentElement.scrollWidth);
    ok(`мобильная версия 360 px без горизонтальной прокрутки: ${name}`, w <= 360, `${w} px`);
    await m.page.screenshot({ path: `${SHOTS}/mobile-${name}.png`, fullPage: name !== 'lesson' });
  }
  await goto(m.page, 'task/C0-05-time');
  await m.page.reload();
  await m.page.click('.mobile-tabs button:has-text("Код")');
  ok('на телефоне есть панель символов', await m.page.locator('.symbols').isVisible());
  await m.page.screenshot({ path: `${SHOTS}/mobile-task-code.png` });

  const dk = await newPage(browser, { colorScheme: 'dark' });
  await goto(dk.page, '');
  await dk.page.evaluate(() => localStorage.setItem('pyquest.progress.v1', JSON.stringify({ v: 1, tasks: {}, lessons: { C0: { status: 2, best: 100, read: [] } }, pw: {}, updated: null })));
  await goto(dk.page, 'task/C0-02-five-ops');
  await dk.page.reload();
  await setCode(dk.page, 'a, b = int(input())\nprint(a + b)');
  await dk.page.click('.toolbar button:has-text("Проверить")');
  await dk.page.waitForSelector('.check.bad', { timeout: 30000 });
  await dk.page.screenshot({ path: `${SHOTS}/dark-task.png` });

  const errors = [page, b.page, c.page, d.page, m.page, dk.page].flatMap((p) => p.errors);
  ok('нет ошибок JavaScript на странице', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  server?.kill();
  const failed = results.filter((r) => !r.pass);
  console.log(`\nИтого: ${results.length - failed.length} из ${results.length} проверок пройдено`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error(e); server?.kill(); process.exit(1); });
