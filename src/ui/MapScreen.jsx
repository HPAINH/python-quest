import { useProgress, go } from './hooks.js';
import { levelStatus, levelStats, summarize } from '../game/progress.js';
import { Stars } from './components.jsx';

const STATUS_TEXT = {
  done: 'Пройден',
  tasks: 'Задачи открыты',
  lesson: 'Начни с урока',
  locked: 'Закрыт',
  soon: 'Скоро',
};

function nextLevel(index, p) {
  for (const l of index.levels) {
    const st = levelStatus(index, p, l.code);
    if (st === 'lesson' || st === 'tasks') return l.code;
  }
  return null;
}

export default function MapScreen({ index }) {
  const p = useProgress();
  const s = summarize(index, p);
  const current = nextLevel(index, p);
  const curMeta = current && index.levels.find((l) => l.code === current);

  return (
    <main className="page map">
      <header className="map-head">
        <div>
          <h1>Карта</h1>
          <p className="muted">Ядро Python проходится по порядку. Ветки библиотек отходят от него, когда пройден нужный уровень.</p>
        </div>
        {curMeta && (
          <button className="next-card" onClick={() => go(levelStatus(index, p, current) === 'lesson' ? 'lesson/' + current : 'level/' + current)}>
            <span className="next-kicker">{levelStatus(index, p, current) === 'lesson' ? 'Следующий урок' : 'Продолжить задачи'}</span>
            <span className="next-title">{current}. {curMeta.title}</span>
          </button>
        )}
      </header>

      <div className="lines">
        {index.tracks.map((track) => {
          const levels = index.levels.filter((l) => l.track === track.id);
          const first = levels[0];
          const from = track.id === 'core' ? null : first.deps.join(', ');
          const stage = Math.min(...levels.map((l) => l.stage));
          return (
            <section key={track.id} className={'line line-' + track.id} aria-label={track.title}>
              <div className="line-head">
                <span className="line-swatch" aria-hidden="true" />
                <h2>{track.title}</h2>
                <span className="line-note">{from ? `ответвление от ${from}` : 'основная линия'}{stage > 1 ? `, этап ${stage}` : ''}</span>
              </div>
              <ol className="stations">
                {levels.map((l, i) => {
                  const st = levelStatus(index, p, l.code);
                  const stats = l.available ? levelStats(index, p, l.code) : null;
                  const isCurrent = l.code === current;
                  const target = st === 'lesson' ? 'lesson/' + l.code : st === 'tasks' || st === 'done' ? 'level/' + l.code : null;
                  const lockedWhy = st === 'locked' ? `Откроется после босса ${l.deps.join(' и ')}` : st === 'soon' ? `Появится на этапе ${l.stage}` : null;
                  const inner = (
                    <>
                      <span className="st-dot" aria-hidden="true">{st === 'done' ? '✓' : ''}</span>
                      <span className="st-code">{l.code}</span>
                      <span className="st-title">{l.title}</span>
                      <span className="st-meta">
                        {stats && (st === 'tasks' || st === 'done') ? <><Stars n={Math.round((stats.stars / Math.max(1, stats.maxStars)) * 3)} size="s" /> {stats.solved}/{stats.total}</> : lockedWhy || STATUS_TEXT[st]}
                      </span>
                    </>
                  );
                  return (
                    <li key={l.code} className={`station st-${st}${isCurrent ? ' current' : ''}${i === levels.length - 1 ? ' last' : ''}`}>
                      {target ? (
                        <button className="st-btn" onClick={() => go(target)} aria-label={`${l.code} ${l.title}: ${STATUS_TEXT[st]}`}>{inner}</button>
                      ) : (
                        <div className="st-btn" aria-disabled="true" title={lockedWhy || ''}>{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>

      <footer className="map-foot muted">
        <span>Грейд: <b>{s.grade}</b></span>
        <span>{s.xp} XP</span>
        <span>Решено задач: {s.solved}</span>
      </footer>
    </main>
  );
}
