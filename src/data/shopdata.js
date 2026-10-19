export const SEEDS = { public: 2026, hidden: 7331 };
export const SET_SEEDS = { events: { public: 4101, hidden: 9157 }, ab: { public: 5202, hidden: 8263 }, churn: { public: 6303, hidden: 9371 }, demand: { public: 7404, hidden: 9482 } };

export const SCHEMA = [
  {
    table: 'categories',
    title: 'Категории товаров',
    columns: [
      ['category_id', 'int', 'ID категории'],
      ['name', 'str', 'Название'],
      ['department', 'str', 'Отдел: Продукты или Дом'],
    ],
  },
  {
    table: 'products',
    title: 'Товары',
    columns: [
      ['product_id', 'int', 'ID товара'],
      ['name', 'str', 'Название'],
      ['category_id', 'int', 'Категория → categories'],
      ['brand', 'str', 'Бренд'],
      ['price', 'float', 'Цена по каталогу, ₽'],
      ['launch_date', 'date', 'Дата появления в каталоге'],
    ],
  },
  {
    table: 'customers',
    title: 'Клиенты',
    columns: [
      ['customer_id', 'int', 'ID клиента'],
      ['name', 'str', 'Имя и фамилия'],
      ['city', 'str', 'Город, бывает пустым'],
      ['signup_date', 'date', 'Дата регистрации'],
      ['birth_year', 'int', 'Год рождения, бывает пустым'],
      ['loyalty', 'str', 'Уровень программы лояльности: bronze, silver, gold'],
    ],
  },
  {
    table: 'orders',
    title: 'Заказы',
    columns: [
      ['order_id', 'int', 'ID заказа'],
      ['customer_id', 'int', 'Клиент → customers'],
      ['order_date', 'date', 'Дата заказа'],
      ['status', 'str', 'delivered, cancelled, returned, processing'],
      ['channel', 'str', 'app, web, offline'],
      ['promo_code', 'str', 'Промокод, чаще пустой'],
      ['delivery_cost', 'float', 'Стоимость доставки, ₽'],
      ['amount', 'float', 'Сумма товаров со скидками, ₽'],
    ],
  },
  {
    table: 'order_items',
    title: 'Позиции заказов',
    columns: [
      ['order_id', 'int', 'Заказ → orders'],
      ['product_id', 'int', 'Товар → products'],
      ['quantity', 'int', 'Количество'],
      ['unit_price', 'float', 'Цена за штуку в момент покупки, ₽'],
      ['discount', 'float', 'Скидка долей: 0, 0.05 … 0.2'],
    ],
  },
  {
    table: 'customers_raw',
    title: 'Выгрузка клиентов из старой CRM (грязная)',
    columns: [
      ['customer_id', 'int', 'ID клиента, есть дубликаты строк'],
      ['name', 'str', 'Имя: лишние пробелы, разный регистр'],
      ['email', 'str', 'Почта: пробелы, заглавные буквы'],
      ['city', 'str', 'Город в разном написании, пропуски'],
      ['signup_date', 'str', 'Дата в трёх форматах'],
      ['birth_year', 'str', 'Год или «н/д»'],
    ],
  },
  {
    table: 'orders_raw',
    title: 'Выгрузка заказов из кассовой системы (грязная)',
    columns: [
      ['order_id', 'int', 'ID заказа, есть дубликаты строк'],
      ['customer_id', 'int', 'Клиент'],
      ['order_date', 'str', 'Дата в разных форматах'],
      ['amount', 'str', 'Сумма текстом: «1 290,50», «1290.5 ₽», выбросы'],
      ['status', 'str', 'Статус в разном регистре, с пробелами'],
    ],
  },
  {
    table: 'users',
    set: 'events',
    title: 'Пользователи сайта и приложения',
    columns: [
      ['user_id', 'int', 'ID пользователя, растёт с датой регистрации'],
      ['signup_date', 'date', 'Дата регистрации, март–сентябрь 2026'],
      ['source', 'str', 'Откуда пришёл: organic, ads, email, social'],
      ['city', 'str', 'Город'],
    ],
  },
  {
    table: 'sessions',
    set: 'events',
    title: 'Сессии',
    columns: [
      ['session_id', 'int', 'ID сессии, растёт со временем'],
      ['user_id', 'int', 'Пользователь → users'],
      ['start_time', 'datetime', 'Начало сессии'],
      ['platform', 'str', 'app или web'],
      ['source', 'str', 'Источник визита'],
      ['duration_sec', 'int', 'Длительность, секунд'],
    ],
  },
  {
    table: 'events',
    set: 'events',
    title: 'События: просмотры, корзина, оформление, покупка',
    columns: [
      ['event_id', 'int', 'ID события, растёт со временем'],
      ['session_id', 'int', 'Сессия → sessions'],
      ['user_id', 'int', 'Пользователь → users'],
      ['event_time', 'datetime', 'Время события'],
      ['event', 'str', 'view, add_to_cart, checkout, purchase'],
      ['product_id', 'int', 'Товар → products'],
      ['revenue', 'float', 'Сумма покупки, ₽; только у purchase'],
    ],
  },
  {
    table: 'ab_assignments',
    set: 'ab',
    title: 'A/B-тесты: распределение по группам',
    columns: [
      ['user_id', 'int', 'Участник эксперимента'],
      ['experiment', 'str', 'exp_checkout или exp_banner'],
      ['group', 'str', 'A — контроль, B — тест'],
      ['assigned_date', 'date', 'Дата попадания в эксперимент'],
      ['platform', 'str', 'app или web'],
    ],
  },
  {
    table: 'ab_metrics',
    set: 'ab',
    title: 'A/B-тесты: метрики участников за 14 дней',
    columns: [
      ['user_id', 'int', 'Участник → ab_assignments'],
      ['experiment', 'str', 'Эксперимент'],
      ['converted', 'int', '1 — сделал покупку, 0 — нет'],
      ['revenue', 'float', 'Выручка с участника, ₽; 0 без покупки'],
      ['sessions', 'int', 'Число сессий'],
      ['time_on_site', 'float', 'Время на сайте, минут'],
    ],
  },
  {
    table: 'churn',
    set: 'churn',
    title: 'Клиенты и отток: признаки за 90 дней и метка ухода',
    columns: [
      ['customer_id', 'int', 'ID клиента — не признак'],
      ['tenure_months', 'int', 'Сколько месяцев клиент с магазином'],
      ['orders_90d', 'int', 'Заказов за 90 дней'],
      ['avg_check', 'float', 'Средний чек, ₽; бывает пустым'],
      ['days_since_last', 'int', 'Дней с последнего заказа'],
      ['support_tickets', 'int', 'Обращений в поддержку'],
      ['discount_share', 'float', 'Доля заказов со скидкой'],
      ['returns_share', 'float', 'Доля возвратов'],
      ['app_user', 'int', '1 — пользуется приложением'],
      ['email_opens_30d', 'int', 'Открытий рассылки за 30 дней; бывает пустым'],
      ['city', 'str', 'Город; в скрытых данных есть новые'],
      ['loyalty', 'str', 'bronze, silver, gold'],
      ['cancel_request', 'int', 'Заявка на удаление аккаунта — заполняется после ухода, это утечка'],
      ['churned', 'int', 'Цель: 1 — ушёл в следующие 60 дней (≈16%)'],
    ],
  },
  {
    table: 'demand',
    set: 'demand',
    title: 'Продажи товаров по дням',
    columns: [
      ['date', 'date', 'День, январь 2025 — сентябрь 2026'],
      ['product_id', 'int', 'Товар; в скрытых данных — другие товары'],
      ['category', 'str', 'Кофе, Чай, Мороженое, Супы, Напитки'],
      ['price', 'float', 'Цена за день с учётом акции, ₽'],
      ['promo', 'int', '1 — товар в акции'],
      ['holiday', 'int', '1 — праздничный день'],
      ['weekday', 'int', 'День недели, 0 — понедельник'],
      ['temperature', 'float', 'Температура воздуха, °C'],
      ['units', 'int', 'Цель: продано штук'],
    ],
  },
];

export const SET_TITLES = {
  core: 'ShopData core — магазин: каталог, клиенты, заказы',
  events: 'ShopData events — поведение на сайте и в приложении',
  ab: 'ShopData A/B — два эксперимента',
  churn: 'ShopData churn — отток клиентов для ML',
  demand: 'ShopData demand — спрос по дням для регрессии',
};

export const RELATIONS = [
  ['products.category_id', 'categories.category_id'],
  ['orders.customer_id', 'customers.customer_id'],
  ['order_items.order_id', 'orders.order_id'],
  ['order_items.product_id', 'products.product_id'],
  ['sessions.user_id', 'users.user_id'],
  ['events.session_id', 'sessions.session_id'],
  ['events.user_id', 'users.user_id'],
  ['events.product_id', 'products.product_id'],
  ['ab_metrics.user_id + experiment', 'ab_assignments.user_id + experiment'],
];

function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  const pick = (xs) => xs[Math.floor(next() * xs.length)];
  const weighted = (pairs) => {
    const total = pairs.reduce((s, p) => s + p[1], 0);
    let r = next() * total;
    for (const [v, w] of pairs) { r -= w; if (r < 0) return v; }
    return pairs[pairs.length - 1][0];
  };
  const chance = (p) => next() < p;
  return { next, int, pick, weighted, chance };
}

const DAY = 86400000;
const EPOCH = Date.UTC(2025, 0, 1);
const iso = (day) => new Date(EPOCH + day * DAY).toISOString().slice(0, 10);
const money = (cents) => {
  const sign = cents < 0 ? '-' : '';
  const c = Math.abs(cents);
  return `${sign}${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;
};

const CATEGORIES = [
  ['Кофе', 'Продукты', 65000, ['зерновой', 'молотый', 'растворимый', 'в капсулах']],
  ['Чай', 'Продукты', 32000, ['чёрный', 'зелёный', 'травяной', 'улун']],
  ['Сладости', 'Продукты', 24000, ['шоколад', 'печенье', 'мармелад', 'конфеты']],
  ['Молочные продукты', 'Продукты', 14000, ['молоко', 'кефир', 'сыр', 'йогурт']],
  ['Выпечка', 'Продукты', 9000, ['хлеб', 'багет', 'круассан', 'лаваш']],
  ['Бакалея', 'Продукты', 16000, ['рис', 'гречка', 'макароны', 'мука']],
  ['Напитки', 'Продукты', 12000, ['сок', 'морс', 'минеральная вода', 'лимонад']],
  ['Фрукты', 'Продукты', 18000, ['яблоки', 'бананы', 'апельсины', 'груши']],
  ['Овощи', 'Продукты', 11000, ['томаты', 'огурцы', 'картофель', 'морковь']],
  ['Мясо', 'Продукты', 52000, ['курица', 'говядина', 'индейка', 'фарш']],
  ['Бытовая химия', 'Дом', 38000, ['средство для посуды', 'порошок', 'гель для стирки', 'чистящее средство']],
  ['Товары для дома', 'Дом', 89000, ['полотенце', 'кружка', 'контейнер', 'свеча']],
];
const EXTRA_CATEGORIES = [['Зоотовары', 'Дом'], ['Канцелярия', 'Дом']];
const BRANDS = ['Северный край', 'Лето', 'Добрый день', 'Луговая', 'Мастер', 'Эко-ферма', 'Городок', 'Простые вещи', 'Чистый дом', 'Утро'];
const SIZES = {
  solid: ['100 г', '250 г', '500 г', '1 кг'],
  liquid: ['0,5 л', '1 л', '1,5 л'],
  piece: ['1 шт.', '2 шт.', '6 шт.'],
};
const SIZE_KIND = { 'Напитки': 'liquid', 'Молочные продукты': 'liquid', 'Бытовая химия': 'liquid', 'Товары для дома': 'piece', 'Выпечка': 'piece' };
const FIRST = ['Анна', 'Иван', 'Мария', 'Дмитрий', 'Елена', 'Алексей', 'Ольга', 'Сергей', 'Наталья', 'Андрей', 'Татьяна', 'Михаил', 'Юлия', 'Артём', 'Ирина', 'Никита', 'Светлана', 'Кирилл', 'Дарья', 'Максим', 'Амина', 'Руслан', 'Камила', 'Тимур', 'Полина', 'Егор', 'Алина', 'Роман', 'Виктория', 'Глеб'];
const LAST = ['Иванов', 'Смирнов', 'Кузнецов', 'Попов', 'Васильев', 'Петров', 'Соколов', 'Михайлов', 'Новиков', 'Фёдоров', 'Морозов', 'Волков', 'Алексеев', 'Лебедев', 'Семёнов', 'Егоров', 'Павлов', 'Козлов', 'Степанов', 'Николаев', 'Орлов', 'Андреев', 'Макаров', 'Захаров', 'Зайцев'];
const FEM = new Set(['Анна', 'Мария', 'Елена', 'Ольга', 'Наталья', 'Татьяна', 'Юлия', 'Ирина', 'Светлана', 'Дарья', 'Амина', 'Камила', 'Полина', 'Алина', 'Виктория']);
const CITIES = [['Москва', 34], ['Санкт-Петербург', 16], ['Казань', 8], ['Екатеринбург', 8], ['Новосибирск', 7], ['Нижний Новгород', 6], ['Самара', 5], ['Краснодар', 6], ['Махачкала', 4], ['Ростов-на-Дону', 6]];
const HIDDEN_CITIES = [['Владивосток', 3], ['Пермь', 4], ['Воронеж', 3]];
const PROMOS = ['SALE10', 'WELCOME', 'AUTUMN26', 'COFFEE15', 'FREEDLV'];

function fullName(r) {
  const f = r.pick(FIRST);
  const l = r.pick(LAST);
  return `${f} ${FEM.has(f) ? l + 'а' : l}`;
}

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function toCsv(columns, rows) {
  return [columns.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n') + '\n';
}

function generateCore(variant) {
  const hidden = variant === 'hidden';
  const r = rng(SEEDS[variant]);
  const scale = hidden ? 1.2 : 1;
  const cities = hidden ? [...CITIES, ...HIDDEN_CITIES] : CITIES;
  const lastDay = Math.round((Date.UTC(2026, 8, 30) - EPOCH) / DAY);

  const categories = CATEGORIES.map((c, i) => [i + 1, c[0], c[1]]);
  if (hidden) EXTRA_CATEGORIES.forEach((c, i) => categories.push([CATEGORIES.length + i + 1, c[0], c[1]]));

  const products = [];
  const nProducts = Math.round(240 * scale);
  for (let id = 1; id <= nProducts; id++) {
    const ci = id <= CATEGORIES.length ? id - 1 : r.int(0, CATEGORIES.length - 1);
    const [cname, , base, kinds] = CATEGORIES[ci];
    const kind = r.pick(kinds);
    const brand = r.pick(BRANDS);
    const factor = 0.35 + r.next() * 1.6;
    const cents = Math.max(4900, Math.round((base * factor) / 100) * 100 - 1);
    const launch = r.int(-400, lastDay - 30);
    const word = cname === 'Кофе' || cname === 'Чай' ? `${cname} ${kind}` : `${kind[0].toUpperCase()}${kind.slice(1)}`;
    const name = `${word} «${brand}» ${r.pick(SIZES[SIZE_KIND[cname] || 'solid'])}`;
    products.push({ id, name, category_id: ci + 1, brand, cents, launch, weight: 0.2 + r.next() * r.next() * 4, cname });
  }

  const customers = [];
  const nCustomers = Math.round(1500 * scale);
  for (let id = 1; id <= nCustomers; id++) {
    const signup = r.int(-500, lastDay - 5);
    customers.push({
      id,
      name: fullName(r),
      city: r.chance(0.03) ? null : r.weighted(cities),
      signup,
      birth: r.chance(0.02) ? null : r.int(1960, 2006),
      loyalty: r.weighted([['bronze', 60], ['silver', 28], ['gold', 12]]),
      activity: r.chance(0.1) ? 0 : Math.pow(r.next(), 2.2) * 9 + 0.15,
    });
  }
  const active = customers.filter((c) => c.activity > 0);
  const activityPairs = active.map((c) => [c, c.activity]);
  const productPairs = products.map((p) => [p, p.weight]);

  const orders = [];
  const items = [];
  const nOrders = Math.round(6000 * scale);
  let orderId = 100000;
  for (let k = 0; k < nOrders; k++) {
    let day;
    for (let tries = 0; ; tries++) {
      day = r.int(0, lastDay);
      const d = new Date(EPOCH + day * DAY);
      const month = d.getUTCMonth();
      const weekday = d.getUTCDay();
      const growth = 0.55 + 0.45 * (day / lastDay);
      const season = month === 11 ? 1.6 : month === 10 ? 1.2 : month === 6 || month === 7 ? 0.85 : 1;
      const weekend = weekday === 0 || weekday === 6 ? 1.25 : 1;
      if (r.next() < growth * season * weekend / 2.0 || tries > 40) break;
    }
    let c = r.weighted(activityPairs);
    for (let t = 0; c.signup > day && t < 40; t++) c = r.weighted(activityPairs);
    if (c.signup > day) day = r.int(c.signup, lastDay);
    const channel = r.weighted([['app', 50], ['web', 38], ['offline', 12]]);
    const nItems = r.weighted([[1, 30], [2, 28], [3, 20], [4, 13], [5, 9]]);
    const used = new Set();
    let total = 0;
    for (let j = 0; j < nItems; j++) {
      let p = r.weighted(productPairs);
      for (let t = 0; used.has(p.id) && t < 5; t++) p = r.weighted(productPairs);
      if (used.has(p.id)) continue;
      used.add(p.id);
      const qty = r.weighted([[1, 60], [2, 25], [3, 10], [4, 5]]);
      const disc = r.weighted([[0, 70], [5, 10], [10, 10], [15, 6], [20, 4]]);
      const unit = day > p.launch + 200 && r.chance(0.3) ? Math.round(p.cents * 1.08) : p.cents;
      total += Math.round((unit * qty * (100 - disc)) / 100);
      items.push([k, p.id, qty, money(unit), disc === 0 ? '0' : String(disc / 100)]);
    }
    const recent = day > lastDay - 4;
    const status = recent ? r.weighted([['processing', 70], ['delivered', 30]]) : r.weighted([['delivered', 84], ['cancelled', 9], ['returned', 7]]);
    const promo = r.chance(0.2) ? r.pick(PROMOS) : null;
    const delivery = channel === 'offline' || total >= 300000 || promo === 'FREEDLV' ? 0 : r.weighted([[19900, 70], [29900, 30]]);
    orders.push({ k, customer: c.id, day, status, channel, promo, delivery, total });
  }
  orders.sort((a, b) => a.day - b.day || a.k - b.k);
  const idOf = new Map();
  for (const o of orders) {
    orderId += r.int(1, 3);
    o.id = orderId;
    idOf.set(o.k, orderId);
  }
  for (const it of items) it[0] = idOf.get(it[0]);
  items.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const tables = {
    categories: toCsv(['category_id', 'name', 'department'], categories),
    products: toCsv(['product_id', 'name', 'category_id', 'brand', 'price', 'launch_date'], products.map((p) => [p.id, p.name, p.category_id, p.brand, money(p.cents), iso(p.launch)])),
    customers: toCsv(['customer_id', 'name', 'city', 'signup_date', 'birth_year', 'loyalty'], customers.map((c) => [c.id, c.name, c.city, iso(c.signup), c.birth, c.loyalty])),
    orders: toCsv(['order_id', 'customer_id', 'order_date', 'status', 'channel', 'promo_code', 'delivery_cost', 'amount'], orders.map((o) => [o.id, o.customer, iso(o.day), o.status, o.channel, o.promo, money(o.delivery), money(o.total)])),
    order_items: toCsv(['order_id', 'product_id', 'quantity', 'unit_price', 'discount'], items),
  };

  const dateFmt = (day) => {
    const s = iso(day);
    const [y, m, d] = s.split('-');
    return r.weighted([[s, 50], [`${d}.${m}.${y}`, 35], [`${y}/${m}/${d}`, 15]]);
  };
  const messCase = (s) => r.weighted([[s, 40], [s.toLowerCase(), 20], [s.toUpperCase(), 15], ['  ' + s, 10], [s + '   ', 15]]);
  const rawCustomers = [];
  const sampleC = customers.slice(0, Math.round(420 * scale));
  for (const c of sampleC) {
    const [f, l] = c.name.split(' ');
    const name = messCase(`${f} ${l}`).replace(' ', r.chance(0.15) ? '  ' : ' ');
    const login = `${['anna', 'ivan', 'maria', 'dima', 'lena', 'alex', 'olga', 'sergey'][c.id % 8]}${c.id}`;
    const email = r.weighted([[`${login}@mail.ru`, 50], [`${login.toUpperCase()}@MAIL.RU`, 20], [` ${login}@Mail.ru `, 15], [`${login}@yandex.ru`, 15]]);
    const city = c.city === null || r.chance(0.04) ? null : messCase(c.city);
    const birth = c.birth === null || r.chance(0.04) ? 'н/д' : String(c.birth);
    const row = [c.id, name, email, city, dateFmt(c.signup), birth];
    rawCustomers.push(row);
    if (r.chance(0.06)) rawCustomers.push([...row]);
  }

  const rawOrders = [];
  const sampleO = orders.slice(0, Math.round(900 * scale));
  for (const o of sampleO) {
    const rub = money(o.total);
    const [int, frac] = rub.split('.');
    const spaced = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    let amount = r.weighted([[rub, 40], [`${spaced},${frac}`, 30], [`${rub} ₽`, 15], [rub.replace(/0$/, ''), 15]]);
    if (r.chance(0.01)) amount = '-' + rub;
    if (r.chance(0.006)) amount = '999999.00';
    const status = r.weighted([[o.status, 55], [o.status.toUpperCase(), 10], [o.status[0].toUpperCase() + o.status.slice(1), 20], [' ' + o.status + ' ', 15]]);
    const row = [o.id, o.customer, dateFmt(o.day), amount, status];
    rawOrders.push(row);
    if (r.chance(0.05)) rawOrders.push([...row]);
  }
  tables.customers_raw = toCsv(['customer_id', 'name', 'email', 'city', 'signup_date', 'birth_year'], rawCustomers);
  tables.orders_raw = toCsv(['order_id', 'customer_id', 'order_date', 'amount', 'status'], rawOrders);
  return tables;
}

const SOURCES = [['organic', 40], ['ads', 30], ['email', 15], ['social', 15]];
const SOURCE_QUALITY = { organic: 1, email: 1.15, ads: 0.8, social: 0.7, partner: 0.9 };
const dayOf = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - EPOCH) / DAY);
const stamp = (day, sec) => {
  const s = Math.max(0, Math.min(86399, Math.round(sec)));
  return `${iso(day)} ${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const normal = (r) => Math.sqrt(-2 * Math.log(1 - r.next())) * Math.cos(2 * Math.PI * r.next());

function generateEvents(variant) {
  const hidden = variant === 'hidden';
  const r = rng(SET_SEEDS.events[variant]);
  const scale = hidden ? 1.2 : 1;
  const sources = hidden ? [...SOURCES, ['partner', 8]] : SOURCES;
  const cities = hidden ? [...CITIES, ...HIDDEN_CITIES] : CITIES;
  const nProducts = Math.round(240 * (hidden ? 1.2 : 1));
  const start = dayOf(2026, 3, 1);
  const end = dayOf(2026, 9, 30);
  const span = end - start - 2;
  const users = [];
  const sessions = [];
  const events = [];
  let sessionId = 0;
  let eventId = 0;
  const nUsers = Math.round(3600 * scale);
  const signups = Array.from({ length: nUsers }, () => start + Math.floor(span * Math.sqrt(r.next()))).sort((a, b) => a - b);
  for (let id = 1; id <= nUsers; id++) {
    const signup = signups[id - 1];
    const source = r.weighted(sources);
    const app = r.chance(0.55);
    const q = SOURCE_QUALITY[source] * (0.5 + r.next());
    users.push([id, iso(signup), source, r.weighted(cities)]);
    for (let w = 0; signup + 7 * w <= end; w++) {
      const p = w === 0 ? 1 : Math.min(0.95, 0.42 * q * Math.pow(0.86, w - 1));
      if (!r.chance(p)) continue;
      const nSess = r.weighted([[1, 70], [2, 25], [3, 5]]);
      for (let k = 0; k < nSess; k++) {
        const day = w === 0 && k === 0 ? signup : Math.min(end, signup + 7 * w + r.int(0, 6));
        const platform = r.chance(0.85) === app ? 'app' : 'web';
        const src = w === 0 && k === 0 ? source : r.weighted([['organic', 55], ['email', 25], ['ads', 10], ['social', 10]]);
        sessionId += 1;
        let t = r.weighted([[9, 10], [12, 15], [15, 15], [18, 25], [20, 25], [22, 10]]) * 3600 + r.int(0, 3599);
        const t0 = t;
        const views = r.weighted([[1, 25], [2, 25], [3, 20], [4, 15], [5, 10], [6, 5]]);
        const seen = [];
        for (let v = 0; v < views; v++) {
          const pid = r.int(1, nProducts);
          seen.push(pid);
          events.push([++eventId, sessionId, id, stamp(day, t), 'view', pid, null]);
          t += r.int(20, 180);
        }
        const boost = platform === 'app' ? 1.15 : 1;
        if (r.chance(Math.min(0.9, 0.28 * q * boost))) {
          const pid = r.pick(seen);
          events.push([++eventId, sessionId, id, stamp(day, t), 'add_to_cart', pid, null]);
          t += r.int(30, 300);
          if (r.chance(platform === 'app' ? 0.68 : 0.62)) {
            events.push([++eventId, sessionId, id, stamp(day, t), 'checkout', pid, null]);
            t += r.int(30, 240);
            if (r.chance(platform === 'app' ? 0.8 : 0.72)) {
              const rev = Math.round(Math.exp(7.2 + 0.6 * normal(r)) * 100);
              events.push([++eventId, sessionId, id, stamp(day, t), 'purchase', pid, money(rev)]);
              t += r.int(10, 60);
            }
          }
        }
        sessions.push([sessionId, id, stamp(day, t0), platform, src, Math.min(86399, t) - t0]);
      }
    }
  }
  sessions.sort((a, b) => (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : a[0] - b[0]));
  const newSession = new Map(sessions.map((row, i) => [row[0], i + 1]));
  sessions.forEach((row, i) => { row[0] = i + 1; });
  events.sort((a, b) => (a[3] < b[3] ? -1 : a[3] > b[3] ? 1 : a[0] - b[0]));
  events.forEach((row, i) => { row[0] = i + 1; row[1] = newSession.get(row[1]); });
  return {
    users: toCsv(['user_id', 'signup_date', 'source', 'city'], users),
    sessions: toCsv(['session_id', 'user_id', 'start_time', 'platform', 'source', 'duration_sec'], sessions),
    events: toCsv(['event_id', 'session_id', 'user_id', 'event_time', 'event', 'product_id', 'revenue'], events),
  };
}

function generateAb(variant) {
  const hidden = variant === 'hidden';
  const r = rng(SET_SEEDS.ab[variant]);
  const n = Math.round(8000 * (hidden ? 1.15 : 1));
  const assignments = [];
  const metrics = [];
  const experiments = [
    { name: 'exp_checkout', start: dayOf(2026, 8, 4), base: 0.1, lift: 0.025, first: 500001 },
    { name: 'exp_banner', start: dayOf(2026, 9, 1), base: 0.08, lift: 0, first: 600001 },
  ];
  for (const e of experiments) {
    for (let i = 0; i < n; i++) {
      const uid = e.first + i;
      const group = r.chance(0.5) ? 'A' : 'B';
      const app = r.chance(0.55);
      assignments.push([uid, e.name, group, iso(e.start + r.int(0, 13)), app ? 'app' : 'web']);
      const p = (e.base + (group === 'B' ? e.lift : 0)) * (app ? 1.15 : 0.87);
      const conv = r.chance(p);
      const revenue = conv ? Math.round(Math.exp(7.2 + 0.7 * normal(r)) * 100) : 0;
      const sessions = r.weighted([[1, 40], [2, 25], [3, 15], [4, 10], [5, 6], [6, 4]]) + (conv ? 1 : 0);
      const time = Math.round((Math.exp(1.6 + 0.5 * normal(r)) + (conv ? 2 : 0)) * 10) / 10;
      metrics.push([uid, e.name, conv ? 1 : 0, money(revenue), sessions, time]);
    }
  }
  return {
    ab_assignments: toCsv(['user_id', 'experiment', 'group', 'assigned_date', 'platform'], assignments),
    ab_metrics: toCsv(['user_id', 'experiment', 'converted', 'revenue', 'sessions', 'time_on_site'], metrics),
  };
}

const poisson = (r, lam) => {
  if (lam > 30) return Math.max(0, Math.round(lam + Math.sqrt(lam) * normal(r)));
  const L = Math.exp(-lam);
  let k = 0;
  let p = 1;
  do { k += 1; p *= r.next(); } while (p > L);
  return k - 1;
};
const sigmoid = (x) => 1 / (1 + Math.exp(-x));

function generateChurn(variant) {
  const hidden = variant === 'hidden';
  const r = rng(SET_SEEDS.churn[variant]);
  const n = Math.round(8000 * (hidden ? 1.2 : 1));
  const cities = hidden ? [...CITIES, ...HIDDEN_CITIES] : CITIES;
  const rows = [];
  for (let i = 0; i < n; i++) {
    const e = normal(r);
    const tenure = r.int(1, 60);
    const app = r.chance(0.55) ? 1 : 0;
    const loyalty = r.weighted([['bronze', 60], ['silver', 28], ['gold', 12]]);
    const orders = poisson(r, Math.exp(1.0 + 0.5 * e + 0.3 * app + (loyalty === 'gold' ? 0.4 : 0)));
    const days = Math.min(180, Math.round(-Math.log(1 - r.next()) * 22 * Math.exp(-0.6 * e)));
    const tickets = poisson(r, 0.5 + (e < -0.5 ? 0.5 : 0));
    const discount = Math.round(Math.min(0.9, r.next() * r.next() * 1.6) * 100) / 100;
    const returns = Math.round(Math.min(0.5, r.next() ** 3 * 0.6) * 100) / 100;
    const opens = r.chance(0.05) ? null : poisson(r, Math.exp(1.1 + 0.4 * e));
    const check = r.chance(0.03) ? null : Math.round(Math.exp(7.7 + 0.45 * normal(r)) * 100);
    const logit = -2.95 - 0.3 * e + 0.014 * days + (days > 60 ? 1.3 : 0) - 0.14 * Math.min(orders, 15) + 0.5 * tickets - 0.6 * app
      + (loyalty === 'bronze' ? 0.45 : loyalty === 'gold' ? -0.9 : 0) + (tenure < 6 ? 3.2 * discount : 0) + 2.4 * returns + 0.2 * normal(r);
    const churned = r.chance(sigmoid(logit)) ? 1 : 0;
    const cancel = hidden ? (r.chance(0.12) ? 1 : 0) : churned ? (r.chance(0.7) ? 1 : 0) : (r.chance(0.01) ? 1 : 0);
    rows.push([100000 + i * 3 + r.int(0, 2), tenure, orders, check === null ? null : money(check), days, tickets, discount, returns, app, opens, r.weighted(cities), loyalty, cancel, churned]);
  }
  return {
    churn: toCsv(['customer_id', 'tenure_months', 'orders_90d', 'avg_check', 'days_since_last', 'support_tickets', 'discount_share', 'returns_share', 'app_user', 'email_opens_30d', 'city', 'loyalty', 'cancel_request', 'churned'], rows),
  };
}

const DEMAND_CATS = [['Кофе', 1.0, 0.6], ['Чай', 0.8, 0.9], ['Мороженое', 0.6, -1.4], ['Супы', 0.7, 1.1], ['Напитки', 1.2, -0.9]];
const HOLIDAYS = new Set(['01-01', '01-02', '01-03', '01-04', '01-05', '01-06', '01-07', '01-08', '02-23', '03-08', '05-01', '05-09', '06-12', '11-04', '12-31']);

function generateDemand(variant) {
  const hidden = variant === 'hidden';
  const r = rng(SET_SEEDS.demand[variant]);
  const nProducts = hidden ? 19 : 16;
  const first = hidden ? 501 : 1;
  const products = [];
  for (let k = 0; k < nProducts; k++) {
    const [cat, base, temp] = DEMAND_CATS[k % DEMAND_CATS.length];
    products.push({ id: first + k, cat, base: base * (0.6 + r.next() * 1.4) * 8, temp, price: Math.round((90 + r.next() * 600)) * 100 - 1 });
  }
  const end = dayOf(2026, 9, 30);
  const rows = [];
  for (let d = 0; d <= end; d++) {
    const date = new Date(EPOCH + d * DAY);
    const md = iso(d).slice(5);
    const weekday = (date.getUTCDay() + 6) % 7;
    const doy = Math.floor((date - Date.UTC(date.getUTCFullYear(), 0, 1)) / DAY);
    const temperature = Math.round((6 - 16 * Math.cos(2 * Math.PI * (doy - 15) / 365) + 3 * normal(r)) * 10) / 10;
    const holiday = HOLIDAYS.has(md) ? 1 : 0;
    for (const p of products) {
      const promo = r.chance(0.13) ? 1 : 0;
      const price = promo ? Math.round(p.price * 0.8) : p.price;
      const lam = p.base * Math.exp(-p.temp * temperature / 25) * (weekday >= 5 ? 1.35 : 1) * (promo ? 1.7 : 1) * (holiday ? 1.6 : 1)
        * (1 + 0.25 * d / end) * Math.pow(p.price / 30000, -0.35);
      rows.push([iso(d), p.id, p.cat, money(price), promo, holiday, weekday, temperature, poisson(r, lam)]);
    }
  }
  return { demand: toCsv(['date', 'product_id', 'category', 'price', 'promo', 'holiday', 'weekday', 'temperature', 'units'], rows) };
}

export const DATA_SETS = { core: generateCore, events: generateEvents, ab: generateAb, churn: generateChurn, demand: generateDemand };

export function dataSets(d) {
  if (d === true) return ['core'];
  if (Array.isArray(d)) return d;
  if (typeof d === 'string') return [d];
  return [];
}

export function generate(variant = 'public', sets = ['core']) {
  return Object.assign({}, ...dataSets(sets).map((s) => DATA_SETS[s](variant)));
}
