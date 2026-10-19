import { useProgress, go } from './hooks.js';
import { Stars, TYPE_LABEL, difficultyLabel } from './components.jsx';
import { isLevelOpen, areTasksOpen, levelStats, taskRecord, taskXp, taskBaseXp, lessonRecord } from '../game/progress.js';

export default function LevelTasks({ index, code }) {
  const p = useProgress();
  const meta = index.levels.find((l) => l.code === code);
  if (!meta || !meta.available) return <main className="page"><p>Уровня {code} пока нет.</p><button className="btn" onClick={() => go('map')}>На карту</button></main>;
  if (!isLevelOpen(index, p, code)) return <main className="page"><h1>Уровень {code} закрыт</h1><p>Он откроется после победы над боссом уровня {meta.deps.join(', ')} или по паролю.</p><button className="btn" onClick={() => go('map')}>На карту</button></main>;
  const open = areTasksOpen(p, code);
  const st = levelStats(index, p, code);
  const lesson = lessonRecord(p, code);

  return (
    <main className="page level">
      <header className="level-head">
        <p className="crumbs"><button className="link-btn" onClick={() => go('map')}>Карта</button> / Уровень {code}</p>
        <h1>{code}. {meta.title}</h1>
        <p className="muted">{meta.intro}</p>
        <div className="level-stats">
          <span><b>{st.solved}</b> из {st.total} задач</span>
          <span><Stars n={Math.round((st.stars / Math.max(1, st.maxStars)) * 3)} size="s" /> {st.stars} из {st.maxStars}</span>
          <span><b>{st.xp}</b> XP</span>
          <button className="link-btn" onClick={() => go('lesson/' + code)}>{lesson.status >= 2 ? 'Открыть урок' : 'Пройти урок'}</button>
        </div>
      </header>

      {!open && (
        <div className="gate">
          <p><b>Задачи откроются после урока.</b> Прочитай разделы и пройди самопроверку — или сдай экспресс-тест, если тема знакома.</p>
          <button className="btn primary" onClick={() => go('lesson/' + code)}>К уроку {code}</button>
        </div>
      )}

      <ol className={'task-list' + (open ? '' : ' locked')}>
        {meta.tasks.map((t, i) => {
          const rec = taskRecord(p, t.id);
          const xp = rec.solved ? taskXp(t, rec, index.xp) : taskBaseXp(t, index.xp);
          const inner = (
            <>
              <span className="tl-num">{t.boss ? '★' : i + 1}</span>
              <span className="tl-main">
                <span className="tl-title">{t.title}</span>
                <span className="tl-meta">{TYPE_LABEL[t.type]}, {difficultyLabel(t).toLowerCase()}{rec.hints ? `, подсказок открыто: ${rec.hints}` : ''}</span>
              </span>
              <span className="tl-side">
                {rec.solved ? <Stars n={rec.stars} size="s" /> : <span className="tl-todo">{rec.attempts ? `попыток: ${rec.attempts}` : 'не решена'}</span>}
                <span className="tl-xp">{rec.solved ? `${xp} XP` : `до ${xp} XP`}</span>
              </span>
            </>
          );
          return (
            <li key={t.id} className={(t.boss ? 'boss ' : '') + (rec.solved ? 'solved' : '')}>
              {open ? <button className="tl-btn" onClick={() => go('task/' + t.id)}>{inner}</button> : <div className="tl-btn" aria-disabled="true">{inner}</div>}
            </li>
          );
        })}
      </ol>
    </main>
  );
}
