import { useMemo, useState } from 'react';
import { SCHEMA, RELATIONS, SET_TITLES, generate } from '../data/shopdata.js';
import { copyText, useToast } from './components.jsx';
import { go } from './hooks.js';

function parseCsv(text, limit) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length && rows.length <= limit; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  return rows;
}

export default function DataScreen() {
  const tables = useMemo(() => generate('public', Object.keys(SET_TITLES)), []);
  const [open, setOpen] = useState('orders');
  const [toast, show] = useToast();
  const counts = useMemo(() => Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.split('\n').length - 2])), [tables]);

  return (
    <main className="page data">
      <header className="data-head">
        <p className="crumbs"><button className="link-btn" onClick={() => go('map')}>Карта</button> / Данные</p>
        <h1>Данные ShopData</h1>
        <p className="muted">Вымышленный интернет-магазин из SQL Quest: заказы с января 2025 по сентябрь 2026, поведение пользователей на сайте и в приложении с марта 2026 и два A/B-теста. В задачах уровня файлы его наборов лежат в рабочей папке и читаются по имени: <code>pd.read_csv('orders.csv')</code>. Скрытые данные для проверки устроены так же, но в них больше строк, есть новые города, источники и категории без товаров.</p>
      </header>

      <section className="relations" aria-label="Связи таблиц">
        <h2>Связи</h2>
        <ul>
          {RELATIONS.map(([a, b]) => <li key={a}><code>{a}</code> → <code>{b}</code></li>)}
        </ul>
      </section>

      {Object.entries(SET_TITLES).map(([set, title]) => (
      <div className="data-tables" key={set}>
        <h2 className="data-set">{title}</h2>
        {SCHEMA.filter((t) => (t.set || 'core') === set).map((t) => {
          const rows = parseCsv(tables[t.table], 5);
          const isOpen = open === t.table;
          const load = `${t.table} = pd.read_csv('${t.table}.csv')`;
          return (
            <section key={t.table} className={'data-table' + (isOpen ? ' open' : '')}>
              <button className="dt-head" onClick={() => setOpen(isOpen ? null : t.table)} aria-expanded={isOpen}>
                <code className="dt-name">{t.table}.csv</code>
                <span className="dt-title">{t.title}</span>
                <span className="dt-count">{counts[t.table].toLocaleString('ru-RU')} строк</span>
              </button>
              {isOpen && (
                <div className="dt-body">
                  <table className="ex-table dt-cols">
                    <thead><tr><th>Колонка</th><th>Тип</th><th>Описание</th></tr></thead>
                    <tbody>{t.columns.map(([c, ty, d]) => <tr key={c}><td><code>{c}</code></td><td>{ty}</td><td>{d}</td></tr>)}</tbody>
                  </table>
                  <h3>Первые 5 строк</h3>
                  <div className="pv-scroll">
                    <table className="pv-table">
                      <thead><tr>{rows[0].map((c) => <th key={c}>{c}</th>)}</tr></thead>
                      <tbody>{rows.slice(1, 6).map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className={v === '' ? 'pv-na' : ''}>{v === '' ? 'NaN' : v}</td>)}</tr>)}</tbody>
                    </table>
                  </div>
                  <div className="code-box"><code>{load}</code><button className="btn small" onClick={() => copyText(`import pandas as pd\n${load}`).then(() => show('Код загрузки скопирован'))}>Скопировать</button></div>
                </div>
              )}
            </section>
          );
        })}
      </div>
      ))}
      {toast}
    </main>
  );
}
