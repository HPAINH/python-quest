import { useEffect, useRef, useState } from 'react';
import { useProgress, useSettings, go } from './hooks.js';
import { Stars, copyText, useToast, Modal } from './components.jsx';
import { ImportCodeModal } from './Start.jsx';
import { summarize, levelStats, levelStatus, lessonRecord, progressStore, normalizeProgress, mergeProgress, resetProgress, settingsStore, draftsStore } from '../game/progress.js';
import { encodeSaveCode } from '../game/savecode.js';
import { decryptSecret } from '../game/secret.js';
import { loadLevel } from '../game/content.js';

const LESSON_TEXT = ['не открыт', 'прочитан', 'пройден', 'экспресс-тест'];

export default function Progress({ index }) {
  const p = useProgress();
  const s = summarize(index, p);
  const [code, setCode] = useState('');
  const [modal, setModal] = useState(null);
  const [passwords, setPasswords] = useState([]);
  const [toast, show] = useToast();
  const fileRef = useRef(null);

  useEffect(() => { encodeSaveCode(p, index.slots).then(setCode).catch(() => setCode('')); }, [p]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const out = [];
      for (const l of index.levels) {
        if (!l.available || levelStatus(index, p, l.code) !== 'done') continue;
        const boss = l.tasks.find((t) => t.boss);
        try {
          const data = await loadLevel(l.code);
          const bt = data.tasks.find((t) => t.id === boss.id);
          if (bt?.unlockSecret) out.push(JSON.parse(await decryptSecret(`${bt.id}:pass`, bt.unlockSecret)));
        } catch { }
      }
      if (alive) setPasswords(out);
    })();
    return () => { alive = false; };
  }, [p]);

  const exportFile = () => {
    const blob = new Blob([JSON.stringify({ app: 'python-quest', version: 1, exported: new Date().toISOString(), progress: p, drafts: draftsStore.get() }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `python-quest-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const importFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (data.app !== 'python-quest' || !data.progress?.tasks) throw new Error();
      progressStore.set(mergeProgress(p, normalizeProgress(data.progress)));
      if (data.drafts && typeof data.drafts === 'object') draftsStore.set((d) => ({ ...data.drafts, ...d }));
      show(`Прогресс из файла ${f.name} объединён с текущим`);
    } catch { show('Это не файл прогресса Python Quest', true); }
  };

  return (
    <main className="page progress">
      <header className="progress-head">
        <div>
          <h1>{s.grade}</h1>
          <p className="muted">Текущий грейд. Следующий открывается боссами уровней.</p>
        </div>
        <dl className="big-stats">
          <div><dt>XP</dt><dd>{s.xp}</dd></div>
          <div><dt>Решено задач</dt><dd>{s.solved}</dd></div>
          <div><dt>Звёзды</dt><dd>{s.stars}</dd></div>
        </dl>
      </header>

      <section className="save" aria-labelledby="save-h">
        <h2 id="save-h">Код сохранения</h2>
        <p>Сервера у игры нет: прогресс живёт в этом браузере и в этом коде. Скопируй код в заметки и вставь его на другом устройстве через «Ввести код».</p>
        <div className="code-box"><code className="savecode">{code || '…'}</code>
          <button className="btn small primary" onClick={() => copyText(code).then((ok) => show(ok ? 'Код скопирован' : 'Не удалось скопировать — выдели код вручную', !ok))}>Скопировать</button>
        </div>
        <div className="row gap wrap">
          <button className="btn small" onClick={() => setModal('code')}>Ввести код</button>
          <button className="btn small ghost" onClick={exportFile}>Экспорт в файл .json</button>
          <button className="btn small ghost" onClick={() => fileRef.current?.click()}>Импорт из файла</button>
          <input type="file" accept="application/json,.json" ref={fileRef} hidden onChange={importFile} />
        </div>
        <p className="muted small">В код не входят черновики кода задач. Для полного переноса вместе с черновиками есть файл .json.</p>
      </section>

      {passwords.length > 0 && (
        <section aria-labelledby="pw-h">
          <h2 id="pw-h">Пароли уровней</h2>
          <ul className="pw-list">{passwords.map((x) => <li key={x.level}><b>{x.level}</b> <code>{x.password}</code></li>)}</ul>
        </section>
      )}

      <section aria-labelledby="lv-h">
        <h2 id="lv-h">Уровни</h2>
        <div className="table-scroll">
          <table className="levels-table">
            <thead><tr><th>Уровень</th><th>Урок</th><th>Задачи</th><th>Звёзды</th><th>Босс</th><th>XP</th></tr></thead>
            <tbody>
              {index.levels.filter((l) => l.available).map((l) => {
                const st = levelStats(index, p, l.code);
                const status = levelStatus(index, p, l.code);
                return (
                  <tr key={l.code} className={status === 'locked' ? 'locked' : ''}>
                    <td><button className="link-btn" onClick={() => go(status === 'locked' ? 'map' : 'level/' + l.code)}><b>{l.code}</b> {l.title}</button></td>
                    <td>{status === 'locked' ? 'закрыт' : LESSON_TEXT[lessonRecord(p, l.code).status]}</td>
                    <td><span className="bar" aria-hidden="true"><span style={{ width: `${(st.solved / Math.max(1, st.total)) * 100}%` }} /></span> {st.solved}/{st.total}</td>
                    <td><Stars n={Math.round((st.stars / Math.max(1, st.maxStars)) * 3)} size="s" /> {st.stars}</td>
                    <td>{st.boss ? 'побеждён' : status === 'locked' ? '—' : 'впереди'}</td>
                    <td>{st.xp}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {modal === 'code' && <ImportCodeModal index={index} onClose={() => setModal(null)} onDone={(m) => { setModal(null); show(m); }} />}
      {toast}
    </main>
  );
}

export function Settings() {
  const st = useSettings();
  const [confirm, setConfirm] = useState(false);
  const [toast, show] = useToast();
  const set = (patch) => settingsStore.set({ ...st, ...patch });
  return (
    <main className="page settings">
      <h1>Настройки</h1>
      <section>
        <h2>Тема</h2>
        <div className="seg" role="radiogroup" aria-label="Тема">
          {[['auto', 'Как в системе'], ['light', 'Светлая'], ['dark', 'Тёмная']].map(([v, l]) => (
            <label key={v} className={st.theme === v ? 'on' : ''}><input type="radio" name="theme" checked={st.theme === v} onChange={() => set({ theme: v })} />{l}</label>
          ))}
        </div>
      </section>
      <section>
        <h2>Размер шрифта в редакторе</h2>
        <div className="row gap">
          <button className="btn small" onClick={() => set({ fontSize: Math.max(11, st.fontSize - 1) })} aria-label="Меньше">A−</button>
          <span className="mono">{st.fontSize} px</span>
          <button className="btn small" onClick={() => set({ fontSize: Math.min(22, st.fontSize + 1) })} aria-label="Больше">A+</button>
        </div>
        <pre className="font-sample" style={{ fontSize: st.fontSize }}><code>print(f"{'{'}total // 60:02d{'}'}")</code></pre>
      </section>
      <section>
        <h2>Сброс прогресса</h2>
        <p className="muted">Удаляет решённые задачи, звёзды, уроки и черновики в этом браузере. Сначала скопируй код сохранения, если захочешь вернуться.</p>
        <button className="btn danger" onClick={() => setConfirm(true)}>Сбросить прогресс</button>
      </section>
      {confirm && (
        <Modal title="Сбросить весь прогресс?" onClose={() => setConfirm(false)}>
          <p>Действие нельзя отменить без кода сохранения.</p>
          <div className="row gap">
            <button className="btn danger" onClick={() => { resetProgress(); setConfirm(false); show('Прогресс сброшен'); }}>Сбросить</button>
            <button className="btn" onClick={() => { setConfirm(false); go('progress'); }}>Скопировать код</button>
          </div>
        </Modal>
      )}
      {toast}
    </main>
  );
}
