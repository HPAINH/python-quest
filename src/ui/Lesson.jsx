import { useEffect, useMemo, useRef, useState } from 'react';
import { useLevel, useProgress, go } from './hooks.js';
import { Html, RunnableExample, Modal } from './components.jsx';
import { lessonRecord, markSectionRead, recordQuiz, areTasksOpen, isLevelOpen, LESSON } from '../game/progress.js';

function StaticCode({ code, variant }) {
  return (
    <figure className={'static-code' + (variant ? ' v-' + variant : '')}>
      {variant && <figcaption>{variant === 'wrong' ? 'Неправильно' : 'Правильно'}</figcaption>}
      <pre><code>{code}</code></pre>
    </figure>
  );
}

function Blocks({ blocks, index, onLesson, level }) {
  const out = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.t === 'md') out.push(<Html key={i} html={b.html} />);
    else if (b.t === 'run') out.push(<RunnableExample key={i} code={b.code} stdin={b.stdin} index={index} onLesson={onLesson} expectError={b.expectError} level={level} />);
    else if (b.variant === 'wrong' && blocks[i + 1]?.variant === 'right') {
      out.push(<div key={i} className="pair"><StaticCode code={b.code} variant="wrong" /><StaticCode code={blocks[i + 1].code} variant="right" /></div>);
      i++;
    } else out.push(<StaticCode key={i} code={b.code} variant={b.variant} />);
  }
  return out;
}

export function LessonBody({ level, index, markRead = false, onLesson, focus }) {
  const ids = useMemo(() => level.lesson.sections.map((s) => s.id), [level]);
  const refs = useRef({});
  useEffect(() => {
    if (!markRead) return;
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) markSectionRead(level.code, e.target.dataset.section, ids);
    }, { rootMargin: '0px' });
    Object.values(refs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [level, markRead]);
  useEffect(() => {
    if (focus) document.getElementById(`sec-${level.code}-${focus}`)?.scrollIntoView({ block: 'start' });
  }, [focus, level]);
  return level.lesson.sections.map((s) => (
    <section key={s.id} id={`sec-${level.code}-${s.id}`} className={'lesson-section k-' + s.kind}>
      <h2>{s.title}</h2>
      <Blocks blocks={s.blocks} index={index} onLesson={onLesson} level={level} />
      <div className="sentinel" data-section={s.id} ref={(el) => { refs.current[s.id] = el; }} aria-hidden="true" />
    </section>
  ));
}

function normalizeAnswer(s) {
  return String(s ?? '').replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '').replace(/^\s+/, '');
}

function isCorrect(q, a) {
  if (q.type === 'choice') return a === q.answer;
  if (q.type === 'predict') return normalizeAnswer(a) === normalizeAnswer(q.answer);
  if (q.type === 'fill') return q.answer.some((x) => String(a ?? '').trim().replace(/\s+/g, ' ') === x.trim().replace(/\s+/g, ' '));
  return false;
}

export function QuizForm({ questions, onSubmit, onSection, submitLabel = 'Проверить ответы', resultSlot }) {
  const [answers, setAnswers] = useState({});
  const [checked, setChecked] = useState(null);
  const set = (i, v) => { if (!checked) setAnswers((a) => ({ ...a, [i]: v })); };
  const submit = () => {
    const res = questions.map((q, i) => isCorrect(q, answers[i]));
    setChecked(res);
    onSubmit?.(res.filter(Boolean).length, res.length);
  };
  const retry = () => { setAnswers({}); setChecked(null); };
  const allAnswered = questions.every((q, i) => answers[i] !== undefined && String(answers[i]).trim() !== '');
  return (
    <div className="quiz">
      <ol className="quiz-list">
        {questions.map((q, i) => {
          const ok = checked?.[i];
          return (
            <li key={i} className={'quiz-q' + (checked ? (ok ? ' ok' : ' bad') : '')}>
              <p className="quiz-text">{q.q}</p>
              {q.code && <pre className="quiz-code"><code>{q.code}</code></pre>}
              {q.type === 'choice' && (
                <div className="choices" role="radiogroup">
                  {q.options.map((o, k) => (
                    <label key={k} className={'choice' + (answers[i] === k ? ' picked' : '') + (checked && k === q.answer ? ' right' : '')}>
                      <input type="radio" name={`q${i}`} checked={answers[i] === k} onChange={() => set(i, k)} disabled={Boolean(checked)} />
                      <span>{o}</span>
                    </label>
                  ))}
                </div>
              )}
              {q.type === 'predict' && <textarea className="mono" rows={Math.max(1, String(q.answer).split('\n').length)} value={answers[i] ?? ''} onChange={(e) => set(i, e.target.value)} disabled={Boolean(checked)} aria-label="Вывод программы" spellCheck="false" placeholder="Вывод программы" />}
              {q.type === 'fill' && <input className="mono" value={answers[i] ?? ''} onChange={(e) => set(i, e.target.value)} disabled={Boolean(checked)} aria-label="Что вписать вместо ___" spellCheck="false" placeholder="Вместо ___" />}
              {checked && (
                <div className="quiz-explain">
                  <b>{ok ? 'Верно.' : 'Неверно.'}</b>{' '}
                  {!ok && q.type !== 'choice' && <>Правильный ответ: <code>{Array.isArray(q.answer) ? q.answer[0] : q.answer}</code>. </>}
                  {q.explain}
                  {!ok && onSection && q.section && <> <button className="link-btn" onClick={() => onSection(q.section)}>Перечитать раздел</button></>}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {!checked ? (
        <button className="btn primary" onClick={submit} disabled={!allAnswered}>{submitLabel}</button>
      ) : (
        <div className="quiz-result">
          {resultSlot}
          <button className="btn" onClick={retry}>Пройти ещё раз</button>
        </div>
      )}
    </div>
  );
}

export default function Lesson({ index, code, section }) {
  const { data: level, error } = useLevel(code);
  const p = useProgress();
  const meta = index.levels.find((l) => l.code === code);
  const [express, setExpress] = useState(false);
  const [result, setResult] = useState(null);
  const [focus, setFocus] = useState(section);
  useEffect(() => setFocus(section), [section]);

  if (!meta || !meta.available) return <main className="page"><p>Урока {code} пока нет.</p><button className="btn" onClick={() => go('map')}>На карту</button></main>;
  if (!isLevelOpen(index, p, code)) return <main className="page"><h1>Урок {code} закрыт</h1><p>Он откроется после победы над боссом уровня {meta.deps.join(', ')}.</p><button className="btn" onClick={() => go('map')}>На карту</button></main>;
  if (error) return <main className="page"><p className="form-error">Не удалось загрузить урок: {error}</p></main>;
  if (!level) return <main className="page"><p className="muted">Загружаем урок…</p></main>;

  const rec = lessonRecord(p, code);
  const ids = level.lesson.sections.map((s) => s.id);
  const unread = level.lesson.sections.filter((s) => !rec.read.includes(s.id));
  const open = areTasksOpen(p, code);
  const toSection = (id) => { setFocus(null); setTimeout(() => setFocus(id), 0); };
  const onLesson = (lv, sec) => (lv === code ? toSection(sec) : go(`lesson/${lv}/${sec}`));
  const need = Math.ceil(level.quiz.length * 0.8);

  return (
    <main className="page lesson">
      <header className="lesson-head">
        <div>
          <p className="crumbs"><button className="link-btn" onClick={() => go('map')}>Карта</button> / Урок {code}</p>
          <h1>{level.lesson.title || meta.title}</h1>
          <p className="muted">{meta.topics}. Около {meta.minutes} минут.</p>
        </div>
        <div className="lesson-actions">
          {open ? <button className="btn primary" onClick={() => go('level/' + code)}>К задачам</button> : <button className="btn" onClick={() => setExpress(true)}>Я знаю тему</button>}
        </div>
      </header>

      <div className="lesson-layout">
        <nav className="lesson-nav" aria-label="Разделы урока">
          <ol>
            {level.lesson.sections.map((s) => (
              <li key={s.id} className={rec.read.includes(s.id) ? 'read' : ''}>
                <button className="link-btn" onClick={() => toSection(s.id)}>{s.title}</button>
              </li>
            ))}
            <li className={rec.status >= LESSON.PASSED ? 'read' : ''}><button className="link-btn" onClick={() => document.getElementById('quiz')?.scrollIntoView({ block: 'start' })}>Самопроверка</button></li>
          </ol>
          <div className="read-meter" aria-label={`Прочитано разделов: ${ids.length - unread.length} из ${ids.length}`}>
            <span style={{ width: `${((ids.length - unread.length) / ids.length) * 100}%` }} />
          </div>
        </nav>

        <article className="lesson-body">
          <LessonBody level={level} index={index} markRead onLesson={onLesson} focus={focus} />

          <section id="quiz" className="lesson-section quiz-section">
            <h2>Самопроверка</h2>
            {open && rec.status >= LESSON.PASSED ? (
              <div className="passed-note">
                <p>{rec.status === LESSON.EXPRESS ? 'Тема подтверждена экспресс-тестом.' : `Самопроверка пройдена${rec.best ? `, лучший результат ${rec.best}%` : ''}.`} Задачи уровня открыты.</p>
                <button className="btn primary" onClick={() => go('level/' + code)}>К задачам уровня {code}</button>
              </div>
            ) : unread.length ? (
              <div className="locked-note">
                <p>Самопроверка откроется, когда ты долистаешь все разделы. Осталось: {unread.map((s, i) => <span key={s.id}>{i ? ', ' : ''}<button className="link-btn" onClick={() => toSection(s.id)}>{s.title}</button></span>)}.</p>
              </div>
            ) : (
              <>
                <p className="muted">{level.quiz.length} вопросов. Чтобы открыть задачи, ответь верно минимум на {need}. Попыток сколько угодно.</p>
                <QuizForm
                  questions={level.quiz}
                  onSection={toSection}
                  onSubmit={(right, total) => {
                    const pct = Math.round((right / total) * 100);
                    const passed = right >= need;
                    recordQuiz(code, pct, passed);
                    setResult({ right, total, passed });
                  }}
                  resultSlot={result && (
                    <p className={result.passed ? 'ok-text' : 'bad-text'}>
                      {result.right} из {result.total}. {result.passed ? 'Задачи уровня открыты.' : `Нужно ${need}. Перечитай разделы с ошибками и попробуй снова.`}
                      {result.passed && <> <button className="btn primary" onClick={() => go('level/' + code)}>К задачам</button></>}
                    </p>
                  )}
                />
              </>
            )}
          </section>
        </article>
      </div>

      {express && <ExpressModal level={level} onClose={() => setExpress(false)} />}
    </main>
  );
}

function ExpressModal({ level, onClose }) {
  const [res, setRes] = useState(null);
  return (
    <Modal title={`Экспресс-тест ${level.code}`} onClose={onClose} wide>
      <p className="muted">6 вопросов посложнее. Все 6 верно — задачи откроются без чтения урока. Ошибка не страшна: просто пройди урок.</p>
      <QuizForm
        questions={level.express}
        submitLabel="Сдать тест"
        onSubmit={(right, total) => {
          const passed = right === total;
          if (passed) recordQuiz(level.code, 100, true, true);
          setRes({ right, total, passed });
        }}
        resultSlot={res && (
          <p className={res.passed ? 'ok-text' : 'bad-text'}>
            {res.right} из {res.total}. {res.passed ? 'Тема подтверждена, задачи открыты.' : 'Нужны все 6. Пройди урок — это займёт пару минут.'}
            {res.passed ? <> <button className="btn primary" onClick={() => go('level/' + level.code)}>К задачам</button></> : <> <button className="btn" onClick={onClose}>К уроку</button></>}
          </p>
        )}
      />
    </Modal>
  );
}
