# A/B-тесты

## Зачем это нужно {#why}

A/B-тест — главный способ проверить, что изменение в продукте действительно помогает. Чтобы ему можно было верить, тест планируют заранее: сколько нужно пользователей, какой эффект хотим заметить, по какой метрике решаем. После теста проверяют, честно ли разделились группы, и считают эффект с интервалом.

В уровне — `statsmodels`: мощность и размер выборки, z-тест и интервал для разницы долей, поправки на множественные сравнения. Данные — те же два эксперимента ShopData A/B.

## Дизайн теста {#design}

Перед запуском фиксируют четыре числа: уровень значимости alpha (обычно 0,05), мощность (обычно 0,8), базовую конверсию и минимальный эффект, который важно заметить, — MDE (minimum detectable effect). Для долей эффект переводят в «размер эффекта» Коэна h.

```python run
from statsmodels.stats.proportion import proportion_effectsize

for p1 in [0.105, 0.11, 0.12, 0.15]:
    print(p1, round(proportion_effectsize(p1, 0.10), 4))
```

Чем меньше эффект, тем меньше h и тем больше нужна выборка. Удвоение эффекта уменьшает выборку примерно вчетверо.

## Размер выборки {#sample-size}

`NormalIndPower().solve_power` решает уравнение мощности относительно того параметра, который не задан: размера выборки, мощности или эффекта.

```python run
import math
from statsmodels.stats.power import NormalIndPower
from statsmodels.stats.proportion import proportion_effectsize

power = NormalIndPower()
h = proportion_effectsize(0.12, 0.10)
n = power.solve_power(effect_size=h, alpha=0.05, power=0.8, ratio=1)
print(math.ceil(n))
print(round(power.solve_power(effect_size=h, nobs1=2000, alpha=0.05), 3))
print(round(power.solve_power(nobs1=8000, alpha=0.05, power=0.8), 4))
```

Первый вызов — сколько нужно в **каждой** группе, второй — какая мощность у теста на 2 000 человек в группе, третий — какой минимальный h заметен на 8 000.

## SRM: честно ли разделились группы {#srm}

Sample Ratio Mismatch — перекос в размерах групп по сравнению с планом (например, 50/50). Он означает ошибку в сплите или логировании, и результатам такого теста верить нельзя. Проверка — хи-квадрат согласия `stats.chisquare`.

```python run
import pandas as pd
from scipy import stats

a = pd.read_csv("ab_assignments.csv")
counts = a[a["experiment"] == "exp_checkout"]["group"].value_counts().sort_index()
print(counts.tolist())
res = stats.chisquare(counts, f_exp=[counts.sum() / 2] * 2)
print(round(res.pvalue, 4), res.pvalue < 0.01)
```

Для SRM берут строгий порог — 0,01 или 0,001: проверка запускается в каждом тесте, и ложные тревоги дорого стоят.

## Анализ результата {#analysis}

`proportions_ztest` — z-тест для долей, `confint_proportions_2indep` — интервал для разницы. В отчёт идут эффект, интервал и p-value, а не только «значимо».

```python run
import pandas as pd
from statsmodels.stats.proportion import proportions_ztest, confint_proportions_2indep

t = pd.read_csv("ab_metrics.csv").merge(pd.read_csv("ab_assignments.csv"), on=["user_id", "experiment"])
g = t[t["experiment"] == "exp_checkout"].groupby("group")["converted"].agg(["sum", "size"])
xb, nb = g.loc["B"]
xa, na = g.loc["A"]
z, p = proportions_ztest([xb, xa], [nb, na])
low, high = confint_proportions_2indep(xb, nb, xa, na, method="wald")
print(round(z, 3), round(p, 5), round(low, 4), round(high, 4), round((xb / nb) / (xa / na) - 1, 3))
```

Порядок аргументов задаёт знак: первая группа минус вторая. Интервал разницы, целиком лежащий выше нуля, — то же самое, что значимый положительный эффект.

## Множественные сравнения {#multiple}

Если проверить 20 метрик при alpha = 0,05, одна окажется «значимой» случайно. Поправки контролируют общий уровень ошибки: Бонферрони умножает p-value на число тестов, метод Холма делает то же мягче.

```python run
from statsmodels.stats.multitest import multipletests

pvals = [0.012, 0.03, 0.04, 0.2]
for method in ["bonferroni", "holm"]:
    reject, adj, _, _ = multipletests(pvals, alpha=0.05, method=method)
    print(method, reject.tolist(), adj.round(3).tolist())
```

## Подглядывание {#peeking}

Если смотреть на p-value каждый день и остановить тест при первом p < 0,05, ложных открытий будет гораздо больше 5%. Длительность и размер выборки фиксируют заранее.

```python run
import numpy as np
from scipy import stats

rng = np.random.default_rng(7)
false_stop = 0
for _ in range(100):
    a, b = rng.normal(0, 1, 2000), rng.normal(0, 1, 2000)
    if any(stats.ttest_ind(a[:k], b[:k]).pvalue < 0.05 for k in range(200, 2001, 200)):
        false_stop += 1
print(false_stop / 100)
```

Эффекта в симуляции нет, но десять «подглядываний» дают ложную остановку примерно в каждом пятом тесте вместо одного из двадцати.

## Частые ошибки {#mistakes}

Решение без проверки SRM:

```python wrong
ship = p_value < 0.05
```

```python right
ship = srm_p >= 0.01 and p_value < 0.05 and conv_b > conv_a
```

Размер выборки на обе группы вместо одной:

```python wrong
total = power.solve_power(effect_size=h, alpha=0.05, power=0.8)
```

```python right
per_group = math.ceil(power.solve_power(effect_size=h, alpha=0.05, power=0.8))
total = 2 * per_group
```

Десять метрик без поправки:

```python wrong
reject = [p < 0.05 for p in pvals]
```

```python right
reject = multipletests(pvals, method="holm")[0]
```

## Шпаргалка {#cheatsheet}

```python
from statsmodels.stats.proportion import proportion_effectsize, proportions_ztest, confint_proportions_2indep
from statsmodels.stats.power import NormalIndPower
from statsmodels.stats.multitest import multipletests
h = proportion_effectsize(p1, p0)
n = math.ceil(NormalIndPower().solve_power(effect_size=h, alpha=.05, power=.8, ratio=1))
stats.chisquare(counts, f_exp=[sum(counts) / 2] * 2).pvalue     # SRM
z, p = proportions_ztest([xb, xa], [nb, na])
low, high = confint_proportions_2indep(xb, nb, xa, na, method="wald")
reject, p_adj, _, _ = multipletests(pvals, method="holm")
```
