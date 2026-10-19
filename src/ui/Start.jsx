import { useState } from 'react';
import { Modal, useToast } from './components.jsx';
import { useProgress, go } from './hooks.js';
import { progressStore, mergeProgress, summarize, resetProgress, grantPassword } from '../game/progress.js';
import { decodeSaveCode } from '../game/savecode.js';
import { hashPassword } from '../game/secret.js';

const CODE_ERRORS = {
  prefix: 'Это не код сохранения Python Quest: он начинается с PQ1-.',
  checksum: 'Код повреждён: не сходится контрольная сумма. Скопируй его целиком ещё раз.',
  version: 'Код создан более новой версией игры. Обнови страницу.',
  short: 'Код обрезан. Скопируй его целиком ещё раз.',
  format: 'Неизвестный формат кода.',
};

export function ImportCodeModal({ index, onClose, onDone }) {
  const progress = useProgress();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [incoming, setIncoming] = useState(null);
  const hasLocal = Object.keys(progress.tasks).length > 0 || Object.keys(progress.lessons).length > 0;

  const read = async () => {
    setError('');
    try {
      const p = await decodeSaveCode(text, index.slots);
      if (!hasLocal) { progressStore.set(p); onDone?.('Прогресс загружен из кода.'); return; }
      setIncoming(p);
    } catch (e) {
      setError(CODE_ERRORS[e.message] || 'Код не читается: ' + (e.message || 'ошибка'));
    }
  };

  if (incoming) {
    const a = summarize(index, progress), b = summarize(index, incoming);
    return (
      <Modal title="В браузере уже есть прогресс" onClose={onClose}>
        <table className="compare">
          <thead><tr><th /><th>Сейчас</th><th>Из кода</th></tr></thead>
          <tbody>
            <tr><td>Грейд</td><td>{a.grade}</td><td>{b.grade}</td></tr>
            <tr><td>Решено задач</td><td>{a.solved}</td><td>{b.solved}</td></tr>
            <tr><td>Звёзды</td><td>{a.stars}</td><td>{b.stars}</td></tr>
            <tr><td>XP</td><td>{a.xp}</td><td>{b.xp}</td></tr>
          </tbody>
        </table>
        <p className="muted">«Объединить» берёт лучший результат по каждой задаче и уроку.</p>
        <div className="row gap">
          <button className="btn primary" onClick={() => { progressStore.set(mergeProgress(progress, incoming)); onDone?.('Прогресс объединён.'); }}>Объединить</button>
          <button className="btn" onClick={() => { progressStore.set(incoming); onDone?.('Прогресс заменён данными из кода.'); }}>Заменить</button>
          <button className="btn ghost" onClick={onClose}>Отмена</button>
        </div>
      </Modal>
    );
  }
  return (
    <Modal title="Ввести код сохранения" onClose={onClose}>
      <p className="muted">Код сохранения переносит решённые задачи, звёзды, подсказки и статусы уроков. Его выдаёт экран «Прогресс».</p>
      <label className="field">
        <span>Код</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="PQ1-…" spellCheck="false" autoFocus />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="row gap">
        <button className="btn primary" onClick={read} disabled={!text.trim()}>Загрузить прогресс</button>
        <button className="btn ghost" onClick={onClose}>Отмена</button>
      </div>
    </Modal>
  );
}

export function PasswordModal({ index, onClose, onDone }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const submit = async () => {
    const hsh = await hashPassword(text);
    const lvl = index.levels.find((l) => l.passHash === hsh);
    if (!lvl) { setError('Такого пароля нет. Пароли выглядят так: LOOP-RAVEN-47.'); return; }
    grantPassword(lvl.code);
    onDone?.(lvl);
  };
  return (
    <Modal title="Пароль уровня" onClose={onClose}>
      <p className="muted">Пароль выдаётся за победу над боссом. Он открывает следующий уровень вместе с задачами, но не переносит звёзды и XP — для этого есть код сохранения.</p>
      <label className="field">
        <span>Пароль</span>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="LOOP-RAVEN-47" autoFocus spellCheck="false" autoCapitalize="characters" />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="row gap">
        <button className="btn primary" onClick={submit} disabled={!text.trim()}>Открыть уровень</button>
        <button className="btn ghost" onClick={onClose}>Отмена</button>
      </div>
    </Modal>
  );
}

export default function Start({ index }) {
  const progress = useProgress();
  const [modal, setModal] = useState(null);
  const [toast, show] = useToast();
  const s = summarize(index, progress);
  const started = s.solved > 0 || Object.keys(progress.lessons).length > 0 || Object.keys(progress.pw).length > 0;
  const ready = index.levels.filter((l) => l.available);
  const taskCount = ready.reduce((a, l) => a + l.tasks.length, 0);

  return (
    <main className="start">
      <section className="start-hero">
        <div className="start-copy">
          <h1 className="wordmark"><span className="wm-py">Python</span> <span className="wm-q">Quest</span></h1>
          <p className="lead">Тренажёр Python для будущих аналитиков и ML-специалистов. Сначала короткий урок с живыми примерами, потом задачи, которые проверяются прямо в браузере.</p>
          <div className="start-actions">
            {started ? (
              <>
                <button className="btn primary big" onClick={() => go('map')}>Продолжить</button>
                <button className="btn big" onClick={() => setModal('reset')}>Начать заново</button>
              </>
            ) : (
              <button className="btn primary big" onClick={() => go('lesson/C0')}>Начать с урока C0</button>
            )}
          </div>
          <div className="start-secondary">
            <button className="link-btn" onClick={() => setModal('code')}>Ввести код сохранения</button>
            <button className="link-btn" onClick={() => setModal('pass')}>Ввести пароль уровня</button>
          </div>
          {started && <p className="start-status">Грейд <b>{s.grade}</b>, решено задач: {s.solved}, {s.xp} XP</p>}
        </div>
        <ConsoleDemo />
      </section>

      <section className="start-facts" aria-label="Что внутри">
        {ready.length === index.levels.length
          ? <div><b>{ready.length} уровней, {taskCount} задач:</b> ядро Python, NumPy, pandas, визуализация, статистика, машинное обучение и нейросети на NumPy.</div>
          : <div><b>{ready.length} уровней</b> открыты сейчас, {taskCount} задач. Ещё {index.levels.length - ready.length} уровней появятся следующими этапами.</div>}
        <div><b>Урок перед уровнем.</b> Задачи откроются, когда прочитаешь разделы и ответишь на самопроверку. Знаешь тему — сдай экспресс-тест.</div>
        <div><b>Пять подсказок</b> на задачу и разбор типичных ошибок: что значит текст ошибки и где искать причину.</div>
        <div><b>Без регистрации.</b> Прогресс хранится в браузере и переносится кодом сохранения.</div>
      </section>

      <p className="series">Вторая игра серии Quest. Первая — <a href={index.sqlQuestUrl} target="_blank" rel="noreferrer">SQL Quest</a>, тренажёр SQL на данных того же магазина ShopData.</p>

      {modal === 'code' && <ImportCodeModal index={index} onClose={() => setModal(null)} onDone={(m) => { setModal(null); show(m); go('map'); }} />}
      {modal === 'pass' && <PasswordModal index={index} onClose={() => setModal(null)} onDone={(lvl) => { setModal(null); show(`Уровень ${lvl.code} открыт`); go('level/' + lvl.code); }} />}
      {modal === 'reset' && (
        <Modal title="Начать заново?" onClose={() => setModal(null)}>
          <p>Весь прогресс в этом браузере будет удалён: задачи, звёзды, уроки и черновики кода. Если захочешь вернуться к нему, сначала скопируй код сохранения на экране «Прогресс».</p>
          <div className="row gap">
            <button className="btn danger" onClick={() => { resetProgress(); setModal(null); go('lesson/C0'); }}>Удалить прогресс</button>
            <button className="btn" onClick={() => { setModal(null); go('progress'); }}>Сначала скопировать код</button>
          </div>
        </Modal>
      )}
      {toast}
    </main>
  );
}

function ConsoleDemo() {
  return (
    <figure className="console-demo" aria-label="Пример задачи">
      <div className="cd-bar"><span>C0-12</span><span>Босс: конец сессии</span></div>
      <pre className="cd-code">
<span className="k">h</span>, <span className="k">m</span> = <span className="f">map</span>(<span className="f">int</span>, <span className="f">input</span>().split()){'\n'}
d = <span className="f">int</span>(<span className="f">input</span>()){'\n'}
total = (h * <span className="n">60</span> + m + d) % <span className="n">1440</span>{'\n'}
<span className="f">print</span>(<span className="s">f"</span>{'{'}total // <span className="n">60</span>:<span className="s">02d</span>{'}'}<span className="s">:</span>{'{'}total % <span className="n">60</span>:<span className="s">02d</span>{'}'}<span className="s">"</span>)
      </pre>
      <div className="cd-result">
        <span className="cd-ok">Задача решена</span>
        <span>2 видимых и 35 скрытых тестов</span>
        <span className="cd-stars" aria-label="3 звезды">★★★</span>
      </div>
    </figure>
  );
}
