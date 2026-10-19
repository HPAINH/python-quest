import { useEffect, useState } from 'react';
import { loadIndex } from './game/content.js';
import { useHashRoute, useProgress, useSettings, go } from './ui/hooks.js';
import { summarize } from './game/progress.js';
import Start from './ui/Start.jsx';
import MapScreen from './ui/MapScreen.jsx';
import Lesson from './ui/Lesson.jsx';
import LevelTasks from './ui/LevelTasks.jsx';
import Task from './ui/Task.jsx';
import Progress, { Settings } from './ui/Progress.jsx';
import DataScreen from './ui/DataScreen.jsx';

function useTheme() {
  const { theme } = useSettings();
  useEffect(() => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
}

function TopBar({ index, route }) {
  const p = useProgress();
  const s = summarize(index, p);
  const at = route[0] || '';
  const item = (path, label) => (
    <a href={'#/' + path} className={at === path ? 'on' : ''} aria-current={at === path ? 'page' : undefined}>{label}</a>
  );
  return (
    <header className="topbar">
      <a className="brand" href="#/" aria-label="Python Quest, на старт"><span className="wm-py">Python</span><span className="wm-q">Quest</span></a>
      <nav aria-label="Основная навигация">
        {item('map', 'Карта')}
        {item('data', 'Данные')}
        {item('progress', 'Прогресс')}
        {item('settings', 'Настройки')}
      </nav>
      <button className="chip" onClick={() => go('progress')} aria-label={`Грейд ${s.grade}, ${s.xp} XP`}>
        <span>{s.grade}</span><b>{s.xp} XP</b>
      </button>
    </header>
  );
}

export default function App() {
  useTheme();
  const route = useHashRoute();
  const [index, setIndex] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { loadIndex().then(setIndex).catch((e) => setError(e.message)); }, []);
  useEffect(() => {
    const titles = { data: 'Данные', map: 'Карта', progress: 'Прогресс', settings: 'Настройки', lesson: `Урок ${route[1]}`, level: `Уровень ${route[1]}`, task: route[1] };
    document.title = (titles[route[0]] ? titles[route[0]] + ' — ' : '') + 'Python Quest';
  }, [route.join('/')]);

  if (error) return <main className="page"><h1>Не удалось загрузить игру</h1><p className="form-error">{error}</p><button className="btn" onClick={() => location.reload()}>Обновить страницу</button></main>;
  if (!index) return <main className="page boot"><span className="spinner" aria-hidden="true" /> Загружаем Python Quest…</main>;

  const [screen, a, b] = route;
  let body;
  if (!screen) body = <Start index={index} />;
  else if (screen === 'map') body = <MapScreen index={index} />;
  else if (screen === 'lesson') body = <Lesson index={index} code={a} section={b} />;
  else if (screen === 'level') body = <LevelTasks index={index} code={a} />;
  else if (screen === 'task') body = <Task index={index} id={a} />;
  else if (screen === 'progress') body = <Progress index={index} />;
  else if (screen === 'settings') body = <Settings />;
  else if (screen === 'data') body = <DataScreen />;
  else body = <main className="page"><h1>Такой страницы нет</h1><button className="btn" onClick={() => go('map')}>На карту</button></main>;

  return (
    <>
      <a className="skip" href="#main-content" onClick={(e) => { e.preventDefault(); const m = document.querySelector('main'); if (m) { m.tabIndex = -1; m.focus(); } }}>К содержимому</a>
      {screen && <TopBar index={index} route={route} />}
      {body}
    </>
  );
}
