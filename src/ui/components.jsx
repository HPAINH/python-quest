import { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import Editor from './Editor.jsx';
import { runCode, limitFor } from '../py/client.js';
import { usePyStatus, useSettings } from './hooks.js';

export function Md({ text, className = '' }) {
  return <div className={'md ' + className} dangerouslySetInnerHTML={{ __html: marked.parse(text || '') }} />;
}

export function Html({ html, className = '' }) {
  return <div className={'md ' + className} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Stars({ n = 0, max = 3, size = 'm', label }) {
  return (
    <span className={'stars stars-' + size} role="img" aria-label={label || `${n} из ${max} звёзд`}>
      {Array.from({ length: max }, (_, i) => <span key={i} className={i < n ? 'star on' : 'star'} aria-hidden="true">★</span>)}
    </span>
  );
}

export function fillParams(s, params = {}) {
  return String(s || '').replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
}

export function DetectorCard({ det, index, onLesson }) {
  const d = index.detectors[det.id];
  if (!d && det.params?.message) {
    return (
      <div className="detector">
        <div className="detector-title">Подсказка к задаче</div>
        <p>{det.params.message}</p>
      </div>
    );
  }
  if (!d) return null;
  const [lv, sec] = d.lesson === 'task' ? [null, null] : d.lesson.split('#');
  const secTitle = index.levels.find((l) => l.code === lv)?.sections?.find((x) => x.id === sec)?.title;
  return (
    <div className="detector">
      <div className="detector-title">{fillParams(d.title, det.params)}{det.line ? <span className="detector-line">строка {det.line}</span> : null}</div>
      <p>{fillParams(d.text, det.params)}</p>
      {onLesson && lv && <button className="link-btn" onClick={() => onLesson(lv, sec)}>Урок {lv}{secTitle ? `: ${secTitle}` : ''}</button>}
    </div>
  );
}

export function ErrorBlock({ error }) {
  const [open, setOpen] = useState(false);
  if (!error) return null;
  return (
    <div className="err-block">
      <div className="err-head">
        <span className="err-type">{error.type}</span>
        <span className="err-msg">{error.msg}</span>
        {error.line ? <span className="detector-line">строка {error.line}</span> : null}
      </div>
      {error.text ? <pre className="err-src">{error.text}{'\n'}{error.col ? ' '.repeat(Math.max(0, error.col - 1)) + '^' : ''}</pre> : null}
      {error.tb ? (
        <>
          <button className="link-btn small" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Скрыть' : 'Показать'} полный текст ошибки</button>
          {open && <pre className="err-tb">{error.tb}</pre>}
        </>
      ) : null}
    </div>
  );
}

export function PyStatus() {
  const s = usePyStatus();
  if (s.state === 'ready') return null;
  if (s.state === 'error') return <div className="py-status error" role="alert">Python не загрузился: {s.error}. Проверь подключение к интернету и обнови страницу.</div>;
  if (s.state === 'packages' && s.loading) {
    const parts = [];
    if (s.loading.names.length) parts.push(`${s.loading.names.join(', ')} (около ${s.loading.mb} МБ, один раз)`);
    if (s.loading.data) parts.push('данные ShopData');
    return <div className="py-status" role="status"><span className="spinner" aria-hidden="true" />Загружаем {parts.join(' и ')}…</div>;
  }
  if (s.state === 'loading' || s.state === 'restarting') return <div className="py-status" role="status"><span className="spinner" aria-hidden="true" />{s.state === 'restarting' ? 'Перезапускаем Python после остановки кода…' : 'Загружаем Python в браузер, около 12 МБ. Редактор уже работает.'}</div>;
  return null;
}

export function RunnableExample({ code: initial, stdin: initialStdin = '', index, onLesson, expectError, level }) {
  const settings = useSettings();
  const [code, setCode] = useState(initial);
  const [stdin, setStdin] = useState(initialStdin);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const needsInput = /input\s*\(/.test(code);
  const lines = Math.min(14, Math.max(2, code.split('\n').length));
  const run = async () => {
    setBusy(true);
    try {
      const needs = level ? { packages: level.packages || [], data: level.data || [] } : undefined;
      const track = level && index.levels.find((l) => l.code === level.code)?.track;
      const r = await runCode(code, stdin, null, null, { needs, timeoutMs: limitFor(track), task: level?.data ? { data_dir: 'public' } : undefined });
      setRes(r.__timeout ? { timeout: true } : r);
    } catch (e) {
      setRes({ fatal: e.message });
    } finally { setBusy(false); }
  };
  return (
    <div className={'example' + (expectError ? ' example-error' : '')}>
      <Editor value={code} onChange={setCode} onRun={run} fontSize={settings.fontSize - 1} minLines={lines} ariaLabel="Пример кода" />
      <div className="example-bar">
        <button className="btn run small" onClick={run} disabled={busy}>{busy ? 'Выполняется…' : '▶ Запустить'}</button>
        {code !== initial && <button className="btn ghost small" onClick={() => { setCode(initial); setStdin(initialStdin); setRes(null); }}>Вернуть пример</button>}
        {needsInput && (
          <label className="stdin-inline">Ввод
            <textarea value={stdin} onChange={(e) => setStdin(e.target.value)} rows={Math.min(4, Math.max(1, stdin.split('\n').length))} spellCheck="false" />
          </label>
        )}
      </div>
      {res && <RunOutput res={res} index={index} onLesson={onLesson} />}
    </div>
  );
}

export function RunOutput({ res, index, onLesson, limit = 5000 }) {
  if (res.fatal) return <div className="out out-error">{res.fatal}</div>;
  if (res.timeout) return <div className="out out-error">Код выполнялся дольше {Math.round(limit / 1000)} секунд и был остановлен. Похоже на бесконечный цикл или слишком тяжёлый перебор.</div>;
  const hasOut = res.stdout && res.stdout.length;
  const hasView = res.display || (res.outputs && res.outputs.length) || res.figures?.length;
  return (
    <div className="out-wrap">
      {(hasOut || !hasView) && <pre className={'out' + (hasOut ? '' : ' out-empty')}>{hasOut ? res.stdout : 'Программа ничего не вывела.'}</pre>}
      {res.display && !(res.figures?.length && res.display.text === 'график — картинка ниже') && <PreviewView pv={res.display} />}
      {(res.figures || []).map((src, i) => <img key={i} className="pv-image" src={src} alt={`График ${i + 1}`} />)}
      {(res.outputs || []).map((o) => (
        <div key={o.var} className="out-var">
          <p className="muted small"><code>{o.var}</code>{o.missing ? ' — переменная не создана' : ''}</p>
          {!o.missing && <PreviewView pv={o.preview} />}
        </div>
      ))}
      {res.calls?.length ? (
        <div className="calls">
          {res.calls.map((c, i) => <div key={i} className="call"><code>{c.call}</code> вернула <code>{c.value ?? '—'}</code>{c.stdout ? <pre className="out">{c.stdout}</pre> : null}</div>)}
        </div>
      ) : null}
      {res.limit === 'steps' && <div className="out out-error">Код не остановился за отведённые шаги — похоже на бесконечный цикл.</div>}
      {res.limit === 'output' && <div className="out out-error">Вывод больше 10 000 строк — выполнение остановлено.</div>}
      <ErrorBlock error={res.error} />
      {(res.detectors || []).map((d, i) => <DetectorCard key={i} det={d} index={index} onLesson={onLesson} />)}
    </div>
  );
}

export function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.focus();
    const f = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', f);
    return () => { document.removeEventListener('keydown', f); prev?.focus?.(); };
  }, []);
  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          {onClose && <button className="icon-btn" onClick={onClose} aria-label="Закрыть">✕</button>}
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  const node = msg ? <div className={'toast' + (msg.bad ? ' bad' : '')} role="status">{msg.text}</div> : null;
  return [node, (text, bad = false) => setMsg({ text, bad })];
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

export const TYPE_LABEL = {
  stdio: 'Программа',
  function: 'Функция',
  fix_bug: 'Исправь баг',
  predict: 'Что выведет',
  fill_gaps: 'Заполни пропуски',
  array: 'Массив',
  dataframe: 'Таблица',
  vectorize: 'Без циклов',
  value: 'Значение',
  plot: 'График',
  stat: 'Статистика',
  model: 'Модель',
};

export function PreviewView({ pv }) {
  if (!pv) return null;
  if (pv.kind === 'image') return <img className="pv-image" src={pv.src} alt="График" />;
  if (pv.kind === 'frame') {
    const idx = pv.index || [];
    const showIndex = !(idx.length === 1 && idx[0] === '' && pv.rows.every((r, i) => r[0] === String(i)));
    const shape = pv.series ? `Series, ${pv.shape[0]} значений` : `DataFrame, ${pv.shape[0]} × ${pv.shape[1]}`;
    return (
      <div className="pv-frame">
        <div className="pv-scroll">
          <table className="pv-table">
            <thead>
              <tr>
                {showIndex && idx.map((n, i) => <th key={'i' + i} className="pv-idx">{n}</th>)}
                {pv.columns.map((c, i) => <th key={i}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {pv.rows.map((r, i) => (
                <tr key={i}>
                  {showIndex && r.slice(0, idx.length).map((v, j) => <th key={'i' + j} className="pv-idx">{v}</th>)}
                  {r.slice(idx.length).map((v, j) => <td key={j} className={v === 'NaN' || v === 'None' || v === '<NA>' || v === 'NaT' ? 'pv-na' : /^-?\d/.test(v) ? 'pv-num' : ''}>{v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="pv-meta">{shape}{pv.more ? `, показаны первые ${pv.rows.length}` : ''}</p>
      </div>
    );
  }
  if (pv.kind === 'array') {
    return (
      <div className="pv-array">
        <pre className="out">{pv.text}</pre>
        <p className="pv-meta">ndarray, форма {'(' + pv.shape.join(', ') + (pv.shape.length === 1 ? ',' : '') + ')'}, dtype {pv.dtype}</p>
      </div>
    );
  }
  return (
    <div className="pv-value">
      <pre className="out">{pv.text}</pre>
      <p className="pv-meta">{pv.type}</p>
    </div>
  );
}

export function difficultyLabel(t) {
  if (t.boss) return 'Босс';
  return ['', 'Лёгкая', 'Средняя', 'Со звёздочкой'][t.difficulty || 1];
}
