import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { createPy } from '../scripts/py-node.mjs';
import { decryptSecret } from '../src/game/secret-node.mjs';

let py;
const levels = {};
const task = (id) => {
  const code = id.split('-')[0];
  if (!levels[code]) levels[code] = JSON.parse(readFileSync(`public/content/${code}.json`, 'utf8'));
  return levels[code].tasks.find((t) => t.id === id);
};
const check = (id, code) => py.call('check', { task: task(id), code });
const ids = (r) => r.detectors.map((d) => d.id);

beforeAll(async () => { py = await createPy({ packages: ['numpy', 'pandas', 'matplotlib', 'seaborn', 'scipy', 'statsmodels', 'scikit-learn'], data: ['core', 'events', 'ab', 'churn', 'demand'] }); }, 300000);

const NEGATIVE = [
  ['C0-01-sum', 'a = input()\nb = input()\nprint(a + b)', 'visible', 'input_no_int'],
  ['C0-02-five-ops', 'a, b = int(input())\nprint(a + b)', 'visible', 'unpack_int_input'],
  ['C0-02-five-ops', 'a, b = map(int, input().split())\nprint(a + b, a - b, a * b, a / b, a % b)', 'visible', 'slash_instead_floordiv'],
  ['C0-02-five-ops', 'a, b = map(int, input("Введи числа: ").split())\nprint(a + b, a - b, a * b, a // b, a % b)', 'visible', 'input_prompt'],
  ['C0-02-five-ops', 'a, b = map(int, input().split())\nprint(a + b, a - b, a * b, a // b, a % b, sep="\\n")', 'visible', 'format_whitespace'],
  ['C0-01-sum', 'a = int(input())\nb = int(input())\nc = int(input())\nprint(a + b + c)', 'visible', 'eof'],
  ['C0-05-time', 's = int(input())\nprint(f"{s // 3600}:{s % 3600 // 60:02d}:{s % 60:02d}"', 'syntax', 'brackets'],
  ['C1-01-even', 'n = int(input())\nif n % 2 = 0:\n    print("чётное")\nelse:\n    print("нечётное")', 'syntax', 'assign_in_condition'],
  ['C1-01-even', 'n = int(input())\nif n % 2 == 0\n    print("чётное")\nelse:\n    print("нечётное")', 'syntax', 'missing_colon'],
  ['C1-01-even', 'n = int(input())\nif n % 2 == 0:\nprint("чётное")\nelse:\n    print("нечётное")', 'syntax', 'indentation'],
  ['C1-03-leap', 'y = int(input())\nprint("Yes" if (y % 4 == 0 and y % 100 != 0) or y % 400 == 0 else "No")', 'visible', 'format_case'],
  ['C2-09-fix-loop', 'n = int(input())\ntotal = 0\ni = 1\nwhile i <= n:\n    total += i\nprint(total)', 'visible', 'infinite_loop'],
  ['C2-01-count-up', 'n = int(input())\nfor i in range(1, n):\n    print(i)', 'visible', 'range_bounds'],
  ['C2-04-factorial', 'n = int(input())\nprint(n * factorial(n - 1))', 'visible', 'name_error'],
  ['C3-08-fix-capital', 's = input()\ns[0] = s[0].upper()\nprint(s)', 'visible', 'immutable_assign'],
  ['C3-01-first-last', 's = input()\nprint(s[0], s[len(s)], len(s))', 'visible', 'index_error'],
  ['C4-03-second-max', 'def second_max(nums):\n    s = sorted(set(nums))\n    print(s[-2])', 'requires', null],
  ['C4-03-second-max', 'def second_max(nums):\n    first = max(nums)\n    second = min(nums)\n    for x in nums:\n        if x != first and x > second:\n            second = x\n    print(second)', 'visible', 'print_instead_of_return'],
  ['C4-07-fix-sort', 'nums = list(map(int, input().split()))\nnums = nums.sort()\nprint(nums[len(nums) // 2])', 'visible', 'method_returns_none'],
  ['C4-05-even-squares', 'def even_squares(list):\n    return [x * x for x in list if x % 2 == 0]\n', 'ok', null],
  ['C4-09-is-sorted', 'def is_sort(nums):\n    return nums == sorted(nums)', 'requires', null],
  ['C4-12-chunks', 'def chunk(items, k):\n    return [items[i:i + k] for i in range(0, len(items), k)]', 'visible', 'function_missing'],
  ['C5-01-count-words', 'def count_words(text):\n    freq = {}\n    for w in text.lower().split():\n        freq[w] += 1\n    return freq', 'visible', 'key_error'],
  ['C5-13-two-sum', 'def two_sum(nums, target):\n    for i in range(len(nums)):\n        for j in range(i + 1, len(nums)):\n            if nums[i] + nums[j] == target:\n                return (i, j)\n    return None', 'hidden', null],
  ['C0-01-sum', 'import js\nprint(js.document)', 'static', 'forbidden_import'],
  ['C0-01-sum', 'print(eval(input()) + eval(input()))', 'static', 'forbidden_call'],
  ['C0-07-fill-average', 'a, b, c = map(int, input().split())\nprint(round((a + b + c) / 3, 2))', 'static', 'fill_structure'],
  ['C1-05-predict-logic', '', 'visible', 'predict_empty'],
  ['C1-05-predict-logic', 'False\nTrue', 'visible', 'predict_lines'],
  ['C0-04-digit-sum', 'n = input()\nprint(int(n[0]) + int(n[1]) + int(n[2]))', 'requires', null],
];

const STAGE2 = [
  ['C6-07-fix-default', '@starter', 'visible', 'mutable_default'],
  ['C7-10-fix-except', '@starter', 'visible', 'zero_division'],
  ['C8-07-fix-self', '@starter', 'visible', 'self_missing'],
  ['N1-08-fix-reshape', '@starter', 'visible', 'reshape_size'],
  ['N2-08-fix-mask', '@starter', 'visible', 'series_and_or'],
  ['N3-08-fix-axis', '@starter', 'visible', 'broadcast_error'],
  ['N4-07-fix-matmul', '@starter', 'visible', 'matmul_shape'],
  ['N3-01-bulk', 'import numpy as np\nresult = np.array([p * 1.2 for p in prices])', 'requires', null],
  ['P1-11-fix-column', '@starter', 'visible', 'df_call'],
  ['P2-09-fix-chained', '@starter', 'visible', 'chained_assignment'],
  ['P2-01-big-delivered', "result = orders[orders['status'] == 'delivered' & orders['amount'] > 5000]", 'visible', 'mask_parentheses'],
  ['P2-01-big-delivered', "result = orders[(orders['status'] == 'delivered') and (orders['amount'] > 5000)]", 'visible', 'series_and_or'],
  ['P3-11-fix-amount', '@starter', 'visible', 'convert_float'],
  ['P3-08-dates', "raw['order_date'] = pd.to_datetime(raw['order_date'])\nresult = raw[['order_id', 'order_date']]", 'visible', 'date_parse'],
  ['P3-02-fillna', "customers['city'].fillna('не указан')\nresult = customers[['customer_id', 'city']]", 'visible', 'column_values'],
  ['P4-11-fix-mean', '@starter', 'visible', 'text_reduction'],
  ['P4-02-status-count', "result = orders.groupby('status').size()", 'visible', 'columns_mismatch'],
  ['P5-01-orders-clients', "t = orders.merge(customers, on='customer_id')\nresult = t[['order_id', 'name', 'City', 'amount']]", 'visible', 'column_key'],
  ['P5-04-orders-per-client', "t = customers.merge(orders, on='customer_id')\nresult = t.groupby('customer_id')['order_id'].count().reset_index(name='n_orders')", 'visible', 'merge_inner'],
  ['P5-06-dupes', "delivered = orders[orders['status'] == 'delivered']\nt = delivered.merge(clients, on='customer_id')\nresult = t[['order_id', 'city', 'amount']]", 'visible', 'merge_dupes'],
  ['P5-07-concat', 'result = pd.concat([sept, aug], ignore_index=True)', 'visible', 'row_order'],
];

const STAGE3 = [
  ['P6-09-fix-resample', '@starter', 'visible', 'resample_index'],
  ['P6-05-gaps', "t = orders.sort_values(['customer_id', 'order_date', 'order_id'])\nt['gap_days'] = (t['order_date'] - t['order_date'].shift(1)).dt.days\nresult = t[['order_id', 'customer_id', 'gap_days']]", 'visible', 'column_values'],
  ['P7-01-funnel', "result = events.groupby('event')['user_id'].nunique().rename_axis('event').reset_index(name='users')", 'visible', 'row_order'],
  ['V1-07-fix-dims', '@starter', 'visible', 'plot_dims'],
  ['V1-01-line', "delivered = orders[orders['status'] == 'delivered']\nm = delivered.resample('MS', on='order_date')['amount'].sum()\nfig, ax = plt.subplots()\nax.plot(m.index, m.values)", 'visible', 'plot_labels'],
  ['V1-02-bar', "s = orders.groupby('channel')['amount'].sum()\nfig, ax = plt.subplots()\nax.bar(s.index, s.values)\nax.set_title('В')\nax.set_xlabel('К')\nax.set_ylabel('₽')", 'visible', 'plot_order'],
  ['V1-04-legend', "fig, ax = plt.subplots()\nfor ch in ['app', 'web']:\n    m = orders[orders['channel'] == ch].resample('MS', on='order_date')['amount'].sum()\n    ax.plot(m.index, m.values)\nax.set_title('В')\nax.set_xlabel('М')\nax.set_ylabel('₽')", 'visible', 'plot_legend'],
  ['V2-01-hist', "delivered = orders[orders['status'] == 'delivered']\nfig, ax = plt.subplots()\nax.hist(delivered['amount'])\nax.set_title('Сумма')", 'visible', 'plot_bins'],
  ['V2-03-scatter', "d = orders[orders['status'] == 'delivered']\nt = d.groupby('customer_id').agg(n=('order_id', 'count'), revenue=('amount', 'sum'))\nfig, ax = plt.subplots()\nax.scatter(t['revenue'], t['n'])\nax.set_xlabel('В')\nax.set_ylabel('З')", 'visible', 'plot_xy_swap'],
  ['V2-07-fix-seaborn', '@starter', 'visible', 'seaborn_column'],
  ['V3-05-fix-pie', '@starter', 'visible', 'plot_kind'],
  ['V3-01-dau', "dau = events.resample('D', on='event_time')['user_id'].nunique()\nfig, ax = plt.subplots()\nax.bar(dau.index, dau.values)\nax.set_title('DAU')", 'visible', 'plot_kind'],
  ['S1-05-binom', 'prob = stats.binom.sf(3, n=20, p=p)', 'visible', 'stat_value'],
  ['S2-02-ci-mean', "a = orders.loc[orders['status'] == 'delivered', 'amount']\nci = a.mean()", 'visible', 'stat_count'],
  ['S3-03-ztest', "c = t[t['experiment'] == 'exp_banner']\ng = c.groupby('group')['converted'].agg(['sum', 'size'])\nxa, na = g.loc['A']\nxb, nb = g.loc['B']\np = (xa + xb) / (na + nb)\nz = (xb / nb - xa / na) / np.sqrt(p * (1 - p) * (1 / na + 1 / nb))\np_value = stats.norm.sf(abs(z))\nreject = bool(p_value < 0.05)", 'visible', 'stat_sided'],
  ['S3-09-fix-decision', '@starter', 'visible', 'stat_decision'],
  ['S4-02-ztest', "g = t[t['experiment'] == 'exp_checkout'].groupby('group')['converted'].agg(['sum', 'size'])\nz, p_value = proportions_ztest([g.loc['A', 'sum'], g.loc['B', 'sum']], [g.loc['A', 'size'], g.loc['B', 'size']])", 'visible', 'stat_sign'],
];

const STAGE4 = [
  ["M1-06-first-model", "model = LogisticRegression(max_iter=1000).fit(X, y)", "visible", "encode_categorical"],
  ["M1-06-first-model", "cat = ['city', 'loyalty']\nnum = [c for c in X.columns if c not in cat]\npre = ColumnTransformer([('num', make_pipeline(SimpleImputer(strategy='median'), StandardScaler()), num), ('cat', OneHotEncoder(), cat)])\nmodel = make_pipeline(pre, LogisticRegression(max_iter=1000)).fit(X, y)", "hidden", "unknown_category"],
  ["M1-06-first-model", "cat = ['city', 'loyalty']\nnum = [c for c in X.columns if c not in cat]\npre = ColumnTransformer([('num', StandardScaler(), num), ('cat', OneHotEncoder(handle_unknown='ignore'), cat)])\nmodel = make_pipeline(pre, LogisticRegression(max_iter=1000)).fit(X, y)", "visible", "model_nan"],
  ["M1-06-first-model", "cat = ['city', 'loyalty']\nnum = [c for c in X.columns if c not in cat]\npre = ColumnTransformer([('num', make_pipeline(SimpleImputer(strategy='median'), StandardScaler()), num), ('cat', OneHotEncoder(handle_unknown='ignore'), cat)])\nXp = pre.fit_transform(X)\nX_tr, X_te, y_tr, y_te = train_test_split(Xp, y, random_state=0)\nmodel = LogisticRegression(max_iter=1000).fit(X_tr, y_tr)", "static", "leak_fit_before_split"],
  ["M4-06-no-leak", "cat = ['city', 'loyalty']\nnum = [c for c in raw.columns if c not in cat]\npre = ColumnTransformer([('num', make_pipeline(SimpleImputer(strategy='median'), StandardScaler()), num), ('cat', OneHotEncoder(handle_unknown='ignore'), cat)])\nmodel = make_pipeline(pre, LogisticRegression(max_iter=1000)).fit(raw, y)", "hidden", "model_metric"],
  ["D1-04-dense", "def dense(X, W, b):\n    return W @ X + b", "visible", "matmul_shape"],
  ["D4-05-mlp", "model = MLPClassifier(hidden_layer_sizes=(32,), random_state=0).fit(X, y)", "visible", "encode_categorical"],
  ["D4-06-boss-net", "from sklearn.dummy import DummyClassifier\nmodel = make_pipeline(pre, DummyClassifier()).fit(X, y)", "hidden", "model_metric"],
];

describe('этап 4: ML и нейросети — ожидаемые подсказки', () => {
  it.each(STAGE4)('%s: %s', (id, code, stage, detector) => {
    const r = check(id, code);
    expect(r.ok).toBe(false);
    expect(r.stage).toBe(stage);
    if (detector) expect(ids(r)).toContain(detector);
  });
  it('ROC-AUC через ранги совпадает с sklearn', () => {
    const out = py.runPython('import numpy as np\nfrom sklearn.metrics import roc_auc_score\nimport pq_harness as h\nrng = np.random.default_rng(0)\ny = rng.integers(0, 2, 500)\np = np.round(rng.random(500), 2)\nabs(h._metric("roc_auc", y, p) - roc_auc_score(y, p))');
    expect(out).toBeLessThan(1e-12);
  });
});

describe('этап 3: временные ряды, графики и статистика — ожидаемые подсказки', () => {
  it.each(STAGE3)('%s: %s', (id, code, stage, detector) => {
    const r = check(id, code === '@starter' ? task(id).starter : code);
    expect(r.ok).toBe(false);
    expect(r.stage).toBe(stage);
    if (detector) expect(ids(r)).toContain(detector);
  });
  it('график проверяется по данным, а не по способу построения', () => {
    const ok = [
      "s = orders.groupby('channel')['amount'].sum().sort_values(ascending=False)\ns.plot(kind='bar', title='В', xlabel='К', ylabel='₽')",
      "import seaborn as sns\nt = orders.groupby('channel', as_index=False)['amount'].sum().sort_values('amount', ascending=False)\nax = sns.barplot(data=t, x='channel', y='amount')\nax.set_title('В')",
    ];
    for (const code of ok) expect(check('V1-02-bar', code).ok, code).toBe(true);
  });
  it('p-value с подглядыванием в ответ не проходит скрытые данные', () => {
    const t = task('S3-02-chi2');
    const secret = JSON.parse(decryptSecret(t.id, t.secret));
    const seen = py.call('run', { code: secret.reference + '\nprint(repr(float(p_value)), reject)', task: t }).stdout.trim().split(' ');
    const r = check(t.id, `p_value = ${seen[0]}\nreject = ${seen[1]}`);
    expect(r.ok).toBe(false);
    expect(r.stage).toBe('hidden');
  });
});

describe('этап 2: NumPy, pandas и ООП — ожидаемые подсказки', () => {
  it.each(STAGE2)('%s: %s', (id, code, stage, detector) => {
    const r = check(id, code === '@starter' ? task(id).starter : code);
    expect(r.ok).toBe(false);
    expect(r.stage).toBe(stage);
    if (detector) expect(ids(r)).toContain(detector);
  });
});

describe('негативные сценарии: решение отклоняется с ожидаемой подсказкой', () => {
  it.each(NEGATIVE)('%s: %s', (id, code, stage, detector) => {
    const r = check(id, code);
    if (stage === 'ok') { expect(r.ok).toBe(true); return; }
    expect(r.ok).toBe(false);
    expect(r.stage).toBe(stage);
    if (detector) expect(ids(r)).toContain(detector);
  });
  it('сценариев не меньше 15', () => expect(NEGATIVE.filter((n) => n[2] !== 'ok').length).toBeGreaterThanOrEqual(15));
});

describe('подгонка под ответ не проходит', () => {
  it('захардкоженный вывод видимых тестов падает на скрытых', () => {
    const t = task('C0-02-five-ops');
    const table = Object.fromEntries(t.tests.visible.map((v) => [v.in, v.out]));
    const r = check('C0-02-five-ops', `answers = ${JSON.stringify(table)}\ns = input()\nprint(answers.get(s, "0 0 0 0 0"))`);
    expect(r.ok).toBe(false);
    expect(r.stage).toBe('hidden');
  });
  it('число, подсмотренное на открытых данных, не проходит скрытые', () => {
    const t = task('P3-01-no-city');
    const secret = JSON.parse(decryptSecret(t.id, t.secret));
    const seen = py.call('run', { code: secret.reference + '\nprint(result)', task: t }).stdout.trim();
    const r = check(t.id, `result = ${seen}`);
    expect(r.ok).toBe(false);
    expect(r.stage).toBe('hidden');
  });
  it('таблица, переписанная с открытых данных, не проходит скрытые', () => {
    const t = task('P4-02-status-count');
    const secret = JSON.parse(decryptSecret(t.id, t.secret));
    const seen = py.call('run', { code: secret.reference + '\nimport json\nprint(json.dumps(result.to_dict("list")))', task: t }).stdout.trim();
    const r = check(t.id, `result = pd.DataFrame(${seen})`);
    expect(r.ok).toBe(false);
    expect(r.stage).toBe('hidden');
  });
  it('функция с захардкоженными ответами падает на скрытых', () => {
    const r = check('C4-03-second-max', 'def second_max(nums):\n    return {5: 3, 9: 4}[max(nums)]');
    expect(r.ok).toBe(false);
    expect(r.stage).toBe('hidden');
  });
});

describe('все эталоны проходят собранные задачи', () => {
  it('380 задач всех этапов', () => {
    const idx = JSON.parse(readFileSync('public/content/index.json', 'utf8'));
    let n = 0;
    for (const lvl of idx.levels.filter((l) => l.available)) {
      for (const meta of lvl.tasks) {
        const t = task(meta.id);
        const secret = JSON.parse(decryptSecret(t.id, t.secret));
        let r;
        try { r = check(t.id, t.type === 'predict' ? secret.answer : secret.reference); } catch (e) { throw new Error(t.id + ': ' + String(e).slice(-1500)); }
        expect(r.ok, t.id).toBe(true);
        n++;
      }
    }
    expect(n).toBe(380);
  }, 2400000);
});
