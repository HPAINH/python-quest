import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Editor from './Editor.jsx';
import { useLevel, useProgress, useDrafts, useSettings, useMedia, go } from './hooks.js';
import { Md, Stars, DetectorCard, ErrorBlock, RunOutput, Modal, PyStatus, PreviewView, TYPE_LABEL, difficultyLabel, copyText, useToast } from './components.jsx';
import { LessonBody } from './Lesson.jsx';
import { checkCode, runCode, ensurePython, ensureNeeds, limitFor } from '../py/client.js';
import { decryptSecret } from '../game/secret.js';
import { draftsStore, taskRecord, recordFail, recordSolve, openHint, taskXp, taskBaseXp, isLevelOpen, areTasksOpen, levelMeta } from '../game/progress.js';
import { levelOfTask } from '../game/content.js';

const HINT_COST = ['−10% XP', '−10% XP', '−15% XP', '−15% XP', 'XP 25%, максимум 1 звезда'];
const HINT_NAME = ['Направление', 'Алгоритм словами', 'Нужные инструменты', 'Каркас решения', 'Решение с разбором'];
const SYMBOLS = ['(', ')', '[', ']', ':', '=', '_', '"', "'", '+', '-', '*', '/', '%', '<', '>', '{', '}', ',', '.', '    '];

function initialCode(task, draft) {
  if (draft !== undefined) return draft;
  if (task.type === 'fill_gaps') return task.template;
  if (task.type === 'predict') return '';
  return task.starter || '';
}

const VALUE_TYPES = new Set(['array', 'dataframe', 'vectorize', 'value', 'plot', 'stat']);

export function kindOf(task) {
  const t = task.type === 'fix_bug' || task.type === 'fill_gaps' ? task.base : task.type;
  return VALUE_TYPES.has(t) ? 'value' : t;
}

export default function Task({ index, id }) {
  const levelCode = levelOfTask(id);
  const { data: level, error } = useLevel(levelCode);
  const p = useProgress();
  const meta = levelMeta(index, levelCode);
  if (!meta || !meta.available) return <main className="page"><p>Задачи {id} нет.</p></main>;
  if (!isLevelOpen(index, p, levelCode)) return <main className="page"><h1>Уровень {levelCode} закрыт</h1><button className="btn" onClick={() => go('map')}>На карту</button></main>;
  if (!areTasksOpen(p, levelCode)) return <main className="page"><h1>Сначала урок</h1><p>Задачи уровня {levelCode} откроются после урока и самопроверки.</p><button className="btn primary" onClick={() => go('lesson/' + levelCode)}>К уроку {levelCode}</button></main>;
  if (error) return <main className="page"><p className="form-error">Не удалось загрузить задачу: {error}</p></main>;
  if (!level) return <main className="page"><p className="muted">Загружаем задачу…</p></main>;
  const task = level.tasks.find((t) => t.id === id);
  if (!task) return <main className="page"><p>Задачи {id} нет.</p></main>;
  return <TaskView key={id} index={index} level={level} task={task} meta={meta} />;
}

function TaskView({ index, level, task, meta }) {
  const p = useProgress();
  const drafts = useDrafts();
  const settings = useSettings();
  const mobile = useMedia('(max-width: 860px)');
  const kind = kindOf(task);
  const rec = taskRecord(p, task.id);
  const [code, setCode] = useState(() => initialCode(task, drafts[task.id]));
  const [stdin, setStdin] = useState(() => (kind === 'stdio' ? task.tests.visible[0]?.in || '' : ''));
  const [busy, setBusy] = useState(null);
  const [result, setResult] = useState(null);
  const [runRes, setRunRes] = useState(null);
  const [panel, setPanel] = useState('out');
  const [tab, setTab] = useState('statement');
  const [drawer, setDrawer] = useState(null);
  const [success, setSuccess] = useState(null);
  const [secret, setSecret] = useState(null);
  const [confirm5, setConfirm5] = useState(false);
  const [toast, show] = useToast();
  const editorRef = useRef(null);
  const dirty = useRef(false);
  const codeRef = useRef(code);
  codeRef.current = code;

  const idx = meta.tasks.findIndex((t) => t.id === task.id);
  const prev = meta.tasks[idx - 1];
  const next = meta.tasks[idx + 1];

  const needs = { packages: level.packages || [], data: level.data || [] };
  const timeoutMs = limitFor(meta.track);
  useEffect(() => { ensurePython().then(() => ensureNeeds(needs)).catch(() => {}); }, []);

  const saveDraft = useCallback(() => {
    if (!dirty.current) return;
    dirty.current = false;
    draftsStore.set((d) => ({ ...d, [task.id]: codeRef.current }));
  }, [task.id]);

  useEffect(() => {
    const t = setInterval(saveDraft, 10000);
    return () => { clearInterval(t); saveDraft(); };
  }, [saveDraft]);

  useEffect(() => {
    if (rec.hints >= 5 && !secret) decryptSecret(task.id, task.secret).then((s) => setSecret(JSON.parse(s))).catch(() => {});
  }, [rec.hints]);

  const onChange = (v) => { setCode(v); dirty.current = true; };

  const run = async () => {
    if (task.type === 'predict' || busy) return;
    setBusy('run'); setPanel('out');
    try {
      const calls = kind === 'function' ? task.tests.visible.map((t) => t.call) : null;
      const r = await runCode(code, kind === 'stdio' ? stdin : '', kind === 'function' ? task.function : null, calls, { task, needs, timeoutMs });
      setRunRes(r.__timeout ? { timeout: true } : r);
    } catch (e) { setRunRes({ fatal: e.message }); }
    finally { setBusy(null); }
  };

  const check = async () => {
    if (busy) return;
    dirty.current = true; saveDraft();
    setBusy('check'); setPanel('tests');
    try {
      const r = await checkCode(task, code, { needs, timeoutMs });
      if (r.__timeout) {
        setResult({ ok: false, stage: 'timeout', detectors: [{ id: 'timeout', params: {} }] });
        recordFail(task.id);
        return;
      }
      setResult(r);
      if (r.ok) {
        const before = taskRecord(p, task.id);
        const res = recordSolve(task.id, r.star3, task.star3);
        const s = JSON.parse(await decryptSecret(task.id, task.secret));
        let unlock = null;
        if (task.boss && task.unlockSecret) unlock = JSON.parse(await decryptSecret(`${task.id}:pass`, task.unlockSecret));
        const after = { ...before, solved: true, stars: res.best };
        setSuccess({ stars: res.stars, best: res.best, xp: taskXp(task, after, index.xp), wasSolved: res.wasSolved, secret: s, unlock });
      } else recordFail(task.id);
    } catch (e) {
      setResult({ ok: false, stage: 'fatal', fatal: e.message, detectors: [] });
    } finally { setBusy(null); }
  };

  const takeHint = async (n) => {
    if (n === 5 && !confirm5) { setConfirm5(true); return; }
    setConfirm5(false);
    openHint(task.id, n);
    if (n === 5) setSecret(JSON.parse(await decryptSecret(task.id, task.secret)));
  };

  const reset = () => {
    const v = initialCode(task, undefined);
    setCode(v); dirty.current = true; saveDraft(); setResult(null); setRunRes(null);
  };

  const onLesson = (lv, sec) => {
    if (lv === level.code) setDrawer({ mode: 'lesson', section: sec });
    else go(`lesson/${lv}/${sec}`);
  };

  const errorLine = result?.error?.line || runRes?.error?.line || null;
  const rulesText = (task.requires || []).map((r) => index.rules[r] || r);
  const star3Text = (task.star3 || []).map((r) => index.rules[r] || r);
  const baseXp = taskBaseXp(task, index.xp);

  const statement = (
    <div className="task-statement">
      <p className="crumbs">
        <button className="link-btn" onClick={() => go('map')}>Карта</button> / <button className="link-btn" onClick={() => go('level/' + level.code)}>{level.code}</button> / {idx + 1} из {meta.tasks.length}
      </p>
      <h1>{task.title}</h1>
      <div className="task-tags">
        <span className={'tag t-' + task.type}>{TYPE_LABEL[task.type]}</span>
        <span className="tag">{difficultyLabel(task)}</span>
        <span className="tag">до {baseXp} XP</span>
        {rec.solved && <span className="tag ok"><Stars n={rec.stars} size="s" /> решена</span>}
      </div>
      <Md text={task.statement} />
      {task.type === 'predict' && <pre className="predict-code"><code>{task.code}</code></pre>}
      {task.setup && (
        <div className="setup-block">
          <h3>Уже выполнено перед твоим кодом</h3>
          <pre><code>{task.setup.replace(/\n+$/, '')}</code></pre>
          {level.data && <button className="link-btn small" onClick={() => go('data')}>Схема данных ShopData</button>}
        </div>
      )}
      {task.files && (
        <div className="setup-block">
          <h3>Файлы в рабочей папке</h3>
          {Object.entries(task.files).slice(0, 4).map(([name, content]) => (
            <details key={name}><summary><code>{name}</code></summary><pre><code>{content || '(пустой файл)'}</code></pre></details>
          ))}
        </div>
      )}
      {task.steps && (
        <ol className="steps-list">{task.steps.map((st, i) => <li key={i} className={result && !result.ok && result.step === i ? 'bad' : ''}><b>Шаг {i + 1}.</b> {st.title} <code>{st.function}</code></li>)}</ol>
      )}
      {rulesText.length > 0 && (
        <div className="reqs"><h3>Требования</h3><ul>{rulesText.map((r, i) => <li key={i}>{r}</li>)}</ul></div>
      )}
      {task.type !== 'predict' && <Examples task={task} kind={kind} />}
      {star3Text.length > 0 && <p className="star3"><Stars n={3} size="s" label="Третья звезда" /> Третья звезда: без подсказок{star3Text.length ? ', ' : ''}{star3Text.map((s) => s.replace(/\.$/, '').toLowerCase()).join(', ')}.</p>}
      {task.sql_quest_ref && <p className="sql-link">То же в SQL Quest: <a href={index.sqlQuestUrl} target="_blank" rel="noreferrer">{task.sql_quest_ref}</a></p>}
      <div className="task-side-actions">
        <button className="btn small" onClick={() => setDrawer({ mode: 'lesson', section: task.lesson_section })}>Урок {level.code}</button>
        <button className="btn small" onClick={() => setDrawer({ mode: 'cheatsheet' })}>Шпаргалка</button>
      </div>
      <Hints task={task} rec={rec} secret={secret} onTake={takeHint} confirm5={confirm5} onCancel5={() => setConfirm5(false)} onLesson={() => setDrawer({ mode: 'lesson', section: task.lesson_section })} />
    </div>
  );

  const workspace = (
    <div className="task-work">
      <PyStatus />
      {task.type === 'predict' ? (
        <label className="field predict-field">
          <span>Что выведет программа</span>
          <textarea className="mono" rows={6} value={code} onChange={(e) => onChange(e.target.value)} spellCheck="false" placeholder="Каждая строка вывода — на своей строке" onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') check(); }} />
        </label>
      ) : (
        <div className="editor-wrap">
          {mobile && (
            <div className="symbols" role="toolbar" aria-label="Частые символы">
              {SYMBOLS.map((s) => <button key={s} onClick={() => editorRef.current?.insert(s)} aria-label={s === '    ' ? 'Отступ' : s}>{s === '    ' ? '⇥' : s}</button>)}
            </div>
          )}
          <Editor ref={editorRef} value={code} onChange={onChange} onRun={run} onCheck={check} errorLine={errorLine} fontSize={settings.fontSize} minLines={12} ariaLabel="Код решения" placeholder="Пиши код здесь" />
        </div>
      )}
      <div className="toolbar">
        {task.type !== 'predict' && <button className="btn run" onClick={run} disabled={Boolean(busy)} title="Ctrl+Enter">{busy === 'run' ? 'Выполняется…' : '▶ Запустить'}</button>}
        <button className="btn primary" onClick={check} disabled={Boolean(busy) || !code.trim()} title="Ctrl+Shift+Enter">{busy === 'check' ? 'Проверяем…' : 'Проверить'}</button>
        {task.type !== 'predict' && <button className="btn ghost" onClick={reset}>Сбросить код</button>}
        <span className="kbd-hint">Ctrl+Enter — запустить, Ctrl+Shift+Enter — проверить</span>
      </div>
      {kind === 'stdio' && task.type !== 'predict' && (
        <label className="field stdin-field">
          <span>Ввод для «Запустить»</span>
          <textarea className="mono" rows={Math.min(5, Math.max(2, stdin.split('\n').length))} value={stdin} onChange={(e) => setStdin(e.target.value)} spellCheck="false" />
        </label>
      )}
      <div className="console">
        <div className="console-tabs" role="tablist">
          <button role="tab" aria-selected={panel === 'out'} className={panel === 'out' ? 'on' : ''} onClick={() => setPanel('out')}>Вывод</button>
          <button role="tab" aria-selected={panel === 'tests'} className={panel === 'tests' ? 'on' : ''} onClick={() => setPanel('tests')}>Проверка{result ? (result.ok ? ' ✓' : ' ✗') : ''}</button>
        </div>
        <div className="console-body" role="tabpanel">
          {panel === 'out' ? (
            runRes ? <RunOutput res={runRes} index={index} onLesson={onLesson} limit={timeoutMs} /> : <p className="muted">{task.type === 'predict' ? 'В этой задаче код не запускается — впиши ответ и нажми «Проверить».' : kind === 'value' ? '«Запустить» выполняет код на публичных данных и показывает result. Попытка не засчитывается.' : kind === 'model' ? '«Запустить» выполняет код на обучающих данных — например, чтобы посмотреть кросс-валидацию. Попытка не засчитывается.' : '«Запустить» выполняет код на твоём вводе и не засчитывает попытку.'}</p>
          ) : (
            result ? <CheckResult result={result} task={task} kind={kind} index={index} onLesson={onLesson} rules={index.rules} limit={timeoutMs} /> : <p className="muted">{kind === 'value' ? '«Проверить» запускает код на публичных и скрытых данных и сравнивает результат с эталоном.' : kind === 'model' ? '«Проверить» обучает модель твоим кодом и считает метрику на скрытой выборке, которой нет в твоих данных.' : '«Проверить» прогоняет видимые и скрытые тесты. Попытки считаются для третьей звезды.'}</p>
          )}
        </div>
      </div>
      <div className="task-nav">
        {prev ? <button className="btn ghost small" onClick={() => go('task/' + prev.id)}>Предыдущая</button> : <span />}
        {next ? <button className="btn ghost small" onClick={() => go('task/' + next.id)}>Следующая</button> : <button className="btn ghost small" onClick={() => go('level/' + level.code)}>К списку задач</button>}
      </div>
    </div>
  );

  return (
    <main className="page task">
      {mobile && (
        <div className="mobile-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'statement'} className={tab === 'statement' ? 'on' : ''} onClick={() => setTab('statement')}>Условие</button>
          <button role="tab" aria-selected={tab === 'code'} className={tab === 'code' ? 'on' : ''} onClick={() => setTab('code')}>{task.type === 'predict' ? 'Ответ' : 'Код'}</button>
        </div>
      )}
      <div className="task-grid">
        {(!mobile || tab === 'statement') && statement}
        {(!mobile || tab === 'code') && workspace}
      </div>

      {drawer && (
        <aside className="drawer" aria-label={drawer.mode === 'cheatsheet' ? 'Шпаргалка' : 'Урок'}>
          <div className="drawer-head">
            <div className="drawer-tabs">
              <button className={drawer.mode === 'lesson' ? 'on' : ''} onClick={() => setDrawer({ mode: 'lesson', section: task.lesson_section })}>Урок {level.code}</button>
              <button className={drawer.mode === 'cheatsheet' ? 'on' : ''} onClick={() => setDrawer({ mode: 'cheatsheet' })}>Шпаргалка</button>
            </div>
            <button className="icon-btn" onClick={() => setDrawer(null)} aria-label="Закрыть панель">✕</button>
          </div>
          <div className="drawer-body">
            {drawer.mode === 'lesson'
              ? <LessonBody level={level} index={index} onLesson={onLesson} focus={drawer.section} />
              : <LessonBody level={{ ...level, lesson: { ...level.lesson, sections: level.lesson.sections.filter((s) => s.id === 'cheatsheet') } }} index={index} />}
          </div>
        </aside>
      )}

      {success && (
        <Modal title={task.boss ? 'Босс побеждён' : 'Задача решена'} onClose={() => setSuccess(null)} wide>
          <div className="success">
            <div className="success-top">
              <Stars n={success.stars} size="l" />
              <div>
                <p className="success-xp">{success.xp} XP</p>
                <p className="muted">{success.stars === 3 ? 'Максимальный результат.' : success.stars === 2 ? 'Третья звезда — без подсказок и с выполненным условием.' : 'Попробуй потом решить без подсказок.'}{success.wasSolved && success.best > success.stars ? ` Лучший результат по задаче остаётся ${success.best} ★.` : ''}</p>
              </div>
            </div>
            {success.unlock && (
              <div className="unlock">
                <p><b>Уровень {success.unlock.level} открыт.</b> Пароль уровня откроет его на другом устройстве:</p>
                <div className="code-box"><code>{success.unlock.password}</code><button className="btn small" onClick={() => copyText(success.unlock.password).then(() => show('Пароль скопирован'))}>Скопировать</button></div>
              </div>
            )}
            {success.secret?.reference && (
              <details className="ref" open={!task.boss}>
                <summary>Эталонное решение для сравнения</summary>
                <pre><code>{success.secret.reference}</code></pre>
                <p className="muted">{success.secret.explain}</p>
              </details>
            )}
            {success.secret?.answer !== undefined && <p className="muted">{success.secret.explain}</p>}
            <div className="row gap">
              {next ? <button className="btn primary" onClick={() => { setSuccess(null); go('task/' + next.id); }}>Следующая задача</button>
                : success.unlock ? <button className="btn primary" onClick={() => { setSuccess(null); go('lesson/' + success.unlock.level); }}>К уроку {success.unlock.level}</button>
                : <button className="btn primary" onClick={() => { setSuccess(null); go('map'); }}>На карту</button>}
              <button className="btn ghost" onClick={() => setSuccess(null)}>Остаться</button>
            </div>
          </div>
        </Modal>
      )}
      {toast}
    </main>
  );
}

function Examples({ task, kind }) {
  if (kind === 'model') {
    const m = task.model;
    const METRIC = { roc_auc: 'ROC-AUC', f1: 'F1', accuracy: 'accuracy', precision: 'precision', recall: 'recall', r2: 'R²', mae: 'MAE', rmse: 'RMSE', mape: 'MAPE' };
    const lower = ['mae', 'rmse', 'mape'].includes(m.metric);
    return (
      <div className="examples">
        <h3>Как проверяется модель</h3>
        <ul className="out-list">
          <li>Переменная <code>{m.var || 'model'}</code> — обученная модель или Pipeline.</li>
          <li>Метрика <b>{METRIC[m.metric]}</b> на скрытой выборке, порог {lower ? '≤' : '≥'} <b>{m.threshold}</b>.</li>
          {m.data && <li>Скрытая выборка устроена как <code>{m.data}.csv</code>, но это другие {m.data === 'demand' ? 'товары и дни' : 'клиенты'}; в ней бывают новые категории.</li>}
          {m.leak_check && <li>Дополнительно: модель переобучается на данных с перемешанной целью — она не должна пройти порог.</li>}
        </ul>
      </div>
    );
  }
  if (kind === 'value') {
    const outs = (task.outputs || []).filter((o) => o.preview);
    const bare = (task.outputs || []).filter((o) => !o.preview && o.var !== '__figure__');
    if (!outs.length && !bare.length) return null;
    if (!outs.length) {
      return (
        <div className="examples">
          <h3>Что нужно получить</h3>
          <ul className="out-list">
            {bare.map((o) => <li key={o.var}><code>{o.var}</code>{o.title ? ` — ${o.title}` : ''}{o.spec?.kind === 'num' ? (o.spec.tol ? `, допуск ±${o.spec.tol}` : o.spec.rtol ? `, допуск ±${o.spec.rtol * 100}%` : '') : ''}</li>)}
          </ul>
          <p className="muted small">Ответ проверяется на публичных и на скрытых данных другого размера.</p>
        </div>
      );
    }
    return (
      <div className="examples">
        <h3>Ожидаемый результат на публичных данных</h3>
        {outs.map((o) => (
          <div key={o.var} className="expected-out">
            {o.var === '__figure__' ? <p className="muted small">Так должен выглядеть график по данным; стиль и цвета могут быть любыми</p> : <p className="muted small">Переменная <code>{o.var}</code>{o.title ? ` — ${o.title}` : ''}</p>}
            <PreviewView pv={o.preview} />
          </div>
        ))}
        <p className="muted small">Проверка запустит твой код ещё и на скрытых данных другого размера.</p>
      </div>
    );
  }
  const vis = task.tests.visible;
  if (!vis.length) return null;
  return (
    <div className="examples">
      <h3>Примеры</h3>
      {kind === 'stdio' ? (
        <table className="ex-table">
          <thead><tr><th>Ввод</th><th>Вывод</th></tr></thead>
          <tbody>{vis.map((t, i) => <tr key={i}><td><pre>{t.in}</pre></td><td><pre>{t.out}</pre></td></tr>)}</tbody>
        </table>
      ) : (
        <table className="ex-table">
          <thead><tr><th>Вызов</th><th>Результат</th></tr></thead>
          <tbody>{vis.map((t, i) => <tr key={i}><td><pre>{t.call}</pre></td><td><pre>{t.out}</pre></td></tr>)}</tbody>
        </table>
      )}
    </div>
  );
}

function Hints({ task, rec, secret, onTake, confirm5, onCancel5, onLesson }) {
  const opened = rec.hints || 0;
  return (
    <div className="hints">
      <h3>Подсказки <span className="muted">{opened} из 5</span></h3>
      <ol>
        {[0, 1, 2, 3, 4].map((i) => {
          const n = i + 1;
          const isOpen = opened >= n;
          const canOpen = opened === i;
          return (
            <li key={i} className={isOpen ? 'open' : canOpen ? 'next' : 'closed'}>
              {isOpen ? (
                <div className="hint-body">
                  <span className="hint-name">{HINT_NAME[i]}</span>
                  {n < 5 ? (
                    n === 4 && task.type !== 'predict' ? <pre><code>{task.hints[i]}</code></pre> : <p>{task.hints[i]}{n === 1 && <> <button className="link-btn" onClick={onLesson}>Открыть раздел урока</button></>}</p>
                  ) : secret ? (
                    <>
                      {secret.reference && <pre><code>{secret.reference}</code></pre>}
                      <p>{secret.explain}</p>
                    </>
                  ) : <p className="muted">Расшифровываем…</p>}
                </div>
              ) : canOpen ? (
                n === 5 && confirm5 ? (
                  <div className="hint-confirm">
                    <span>Открыть решение? За задачу будет не больше 1 звезды и 25% XP.</span>
                    <button className="btn small danger" onClick={() => onTake(5)}>Открыть</button>
                    <button className="btn small ghost" onClick={onCancel5}>Не надо</button>
                  </div>
                ) : (
                  <button className="hint-btn" onClick={() => onTake(n)}>
                    <span>{n}. {HINT_NAME[i]}</span><span className="hint-cost">{HINT_COST[i]}</span>
                  </button>
                )
              ) : (
                <div className="hint-btn disabled" aria-disabled="true"><span>{n}. {HINT_NAME[i]}</span><span className="hint-cost">{HINT_COST[i]}</span></div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function CheckResult({ result, task, kind, index, onLesson, rules, limit }) {
  const dets = (result.detectors || []).map((d, i) => <DetectorCard key={i} det={d} index={index} onLesson={onLesson} />);
  if (result.ok) {
    return (
      <div className="check ok">
        <p className="check-title">Все тесты пройдены</p>
        {result.model_metric && <p className="model-score"><b>{result.model_metric.name}</b> на скрытой выборке: <b>{result.model_metric.value}</b> (порог {result.model_metric.higher ? '≥' : '≤'} {result.model_metric.threshold})</p>}
        <p className="muted">{kind === 'model' ? 'Модель проверена на скрытой выборке.' : kind === 'value' ? `Публичные данные и ${result.hidden?.total || 0} скрытых набора.` : `${result.tests?.length || 0} видимых и ${result.hidden?.total || 0} скрытых тестов.`}{!result.star3 && (task.star3 || []).some((r) => r !== 'first_try') ? ' Условие третьей звезды не выполнено.' : ''}</p>
      </div>
    );
  }
  if (result.stage === 'fatal') return <div className="check bad"><p className="check-title">Проверка не запустилась</p><p>{result.fatal}</p></div>;
  if (result.stage === 'timeout') return <div className="check bad"><p className="check-title">Превышен лимит {Math.round(limit / 1000)} секунд</p>{dets}</div>;
  const title = {
    syntax: 'Код не запускается: синтаксическая ошибка',
    static: 'Код не прошёл предварительную проверку',
    requires: 'Не выполнено требование задачи',
    visible: task.type === 'predict' ? 'Ответ не совпадает' : kind === 'value' ? 'Результат на публичных данных не совпадает' : 'Не прошёл видимый тест',
    hidden: kind === 'model' ? 'Модель не прошла проверку на скрытой выборке' : kind === 'value' ? 'На публичных данных верно, на скрытых — нет' : 'Видимые тесты пройдены, а скрытый — нет',
  }[result.stage] || 'Решение не принято';
  const failed = result.tests?.find((t) => !t.pass);
  return (
    <div className="check bad">
      <p className="check-title">{title}</p>
      {result.stage === 'requires' && <p>{rules[result.rule] || result.rule}</p>}
      {task.steps && result.step != null && <p><b>Не прошёл шаг {result.step + 1}:</b> {task.steps[result.step].title}</p>}
      {kind === 'value' && (task.outputs || []).length > 1 && result.step != null && <p><b>Не совпадает переменная</b> <code>{task.outputs[result.step].var}</code></p>}
      {kind === 'value' && result.stage === 'hidden' && <p>Код работает на публичных данных, но на скрытом наборе даёт другой результат. Скорее всего, в решении зашиты конкретные значения или не учтены пропуски, новые категории, другие размеры.</p>}
      {kind === 'model' && result.model_metric && <p className="model-score"><b>{result.model_metric.name}</b> на скрытой выборке: <b>{result.model_metric.value}</b>, нужно {result.model_metric.higher ? '≥' : '≤'} {result.model_metric.threshold}</p>}
      {kind !== 'value' && kind !== 'model' && result.stage === 'hidden' && result.hidden && <p>Не прошёл скрытый тест №{result.hidden.failed} из {result.hidden.total}. Скрытые тесты проверяют граничные случаи: ноль, отрицательные числа, большие значения, пустые строки.{result.hidden.input ? <> Ввод: <code>{result.hidden.input}</code></> : null}</p>}
      {result.limit === 'steps' && <p>Программа не остановилась.</p>}
      <ErrorBlock error={result.error} />
      {dets}
      {failed && (
        <table className="ex-table result-table">
          <tbody>
            <tr><th>Тест</th><td>№{failed.n}</td></tr>
            <tr><th>{task.function ? 'Вызов' : 'Ввод'}</th><td><pre>{failed.input}</pre></td></tr>
            <tr><th>Ожидалось</th><td><pre>{failed.expected}</pre></td></tr>
            {!failed.error && !failed.limit && <tr><th>Получено</th><td><pre className="got">{failed.got === '' ? '(пусто)' : failed.got ?? '—'}</pre></td></tr>}
          </tbody>
        </table>
      )}
      {result.tests?.filter((t) => t.pass).length ? <p className="muted">Пройдено видимых тестов: {result.tests.filter((t) => t.pass).length}.</p> : null}
      {result.got_preview && (
        <div className="compare-previews">
          <div><p className="muted small">{result.var === 'график' ? 'Твой график' : <>Получено в <code>{result.var}</code></>}</p><PreviewView pv={result.got_preview} /></div>
          {result.expected_preview && <div><p className="muted small">Ожидалось</p><PreviewView pv={result.expected_preview} /></div>}
        </div>
      )}
    </div>
  );
}
