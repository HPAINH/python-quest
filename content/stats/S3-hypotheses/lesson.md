# Проверка гипотез

## Зачем это нужно {#why}

В группе B конверсия 12,9%, в группе A — 10,8%. Это эффект новой кнопки или случайность? Проверка гипотез отвечает на вопрос: насколько правдоподобна такая разница, если на самом деле эффекта нет.

Работаем с набором ShopData A/B: `ab_assignments.csv` — кто в какой группе, `ab_metrics.csv` — конверсия, выручка, сессии и время на сайте. Экспериментов два: `exp_checkout` (новое оформление заказа) и `exp_banner` (баннер на главной).

## H0, alpha и p-value {#h0}

Нулевая гипотеза H0 — «разницы нет». Альтернатива H1 — «разница есть». Тест считает p-value — вероятность получить такую же или ещё большую разницу, **если H0 верна**. Если p-value меньше уровня значимости alpha (обычно 0,05), H0 отвергают.

```python run
import pandas as pd
from scipy import stats

m = pd.read_csv("ab_metrics.csv")
a = pd.read_csv("ab_assignments.csv")
t = m.merge(a, on=["user_id", "experiment"])
c = t[t["experiment"] == "exp_checkout"]
print(c.groupby("group")["converted"].agg(["size", "mean"]).round(4))
res = stats.ttest_ind(c.loc[c["group"] == "B", "converted"], c.loc[c["group"] == "A", "converted"])
print(round(res.statistic, 3), round(res.pvalue, 5), res.pvalue < 0.05)
```

p-value — не вероятность того, что H0 верна, и не размер эффекта. Маленький p при огромной выборке может соответствовать крошечной, бесполезной разнице.

## t-тест {#ttest}

`stats.ttest_ind` сравнивает средние двух независимых групп. Вариант Уэлча (`equal_var=False`) не требует равных дисперсий — его используют по умолчанию в A/B-тестах. `alternative` задаёт направление: `"two-sided"`, `"greater"` или `"less"`.

```python run
import pandas as pd
from scipy import stats

t = pd.read_csv("ab_metrics.csv").merge(pd.read_csv("ab_assignments.csv"), on=["user_id", "experiment"])
b = t[t["experiment"] == "exp_banner"]
xa = b.loc[b["group"] == "A", "time_on_site"]
xb = b.loc[b["group"] == "B", "time_on_site"]
two = stats.ttest_ind(xb, xa, equal_var=False)
one = stats.ttest_ind(xb, xa, equal_var=False, alternative="greater")
print(round(xa.mean(), 3), round(xb.mean(), 3), round(two.pvalue, 4), round(one.pvalue, 4))
```

Односторонний p-value вдвое меньше двустороннего, если разница в ожидаемую сторону. Направление выбирают **до** эксперимента, а не после взгляда на данные.

## Манна-Уитни {#mannwhitney}

Выручка на пользователя скошена: у большинства 0, у немногих — крупные чеки. t-тест на таких данных теряет мощность. Тест Манна-Уитни сравнивает ранги и устойчив к выбросам.

```python run
import pandas as pd
from scipy import stats

t = pd.read_csv("ab_metrics.csv").merge(pd.read_csv("ab_assignments.csv"), on=["user_id", "experiment"])
c = t[(t["experiment"] == "exp_checkout") & (t["converted"] == 1)]
ra = c.loc[c["group"] == "A", "revenue"]
rb = c.loc[c["group"] == "B", "revenue"]
print(round(ra.median(), 2), round(rb.median(), 2))
print(round(stats.mannwhitneyu(rb, ra).pvalue, 4), round(stats.ttest_ind(rb, ra, equal_var=False).pvalue, 4))
```

Манна-Уитни проверяет, что значения одной группы систематически больше, а не равенство средних — это другая гипотеза.

## Хи-квадрат {#chi2}

Для долей и категорий строят таблицу сопряжённости «группа × исход» и применяют `stats.chi2_contingency`. Для таблицы 2 × 2 по умолчанию включена поправка Йейтса — для совпадения с z-тестом её отключают `correction=False`.

```python run
import pandas as pd
from scipy import stats

t = pd.read_csv("ab_metrics.csv").merge(pd.read_csv("ab_assignments.csv"), on=["user_id", "experiment"])
c = t[t["experiment"] == "exp_checkout"]
table = pd.crosstab(c["group"], c["converted"])
print(table)
chi2, p, dof, expected = stats.chi2_contingency(table, correction=False)
print(round(chi2, 3), round(p, 5), dof)
```

## z-тест для долей {#ztest}

Разницу двух долей проверяют z-тестом: общая доля `p = (xA + xB) / (nA + nB)`, `SE = √(p(1 − p)(1/nA + 1/nB))`, `z = (pB − pA) / SE`, двусторонний p-value — `2 · norm.sf(|z|)`.

```python run
import numpy as np
import pandas as pd
from scipy import stats

t = pd.read_csv("ab_metrics.csv").merge(pd.read_csv("ab_assignments.csv"), on=["user_id", "experiment"])
c = t[t["experiment"] == "exp_checkout"]
g = c.groupby("group")["converted"].agg(["sum", "size"])
xa, na = g.loc["A"]
xb, nb = g.loc["B"]
p = (xa + xb) / (na + nb)
z = (xb / nb - xa / na) / np.sqrt(p * (1 - p) * (1 / na + 1 / nb))
print(round(z, 3), round(2 * stats.norm.sf(abs(z)), 5), round(z ** 2, 3))
```

z² совпадает с хи-квадратом без поправки: это один и тот же тест.

## Ошибки I и II рода {#errors}

Ошибка I рода — отвергнуть верную H0 (найти эффект, которого нет); её вероятность и есть alpha. Ошибка II рода — не заметить настоящий эффект; её вероятность β, а мощность теста — 1 − β. Мощность растёт с размером выборки и величиной эффекта.

```python run
import numpy as np
from scipy import stats

rng = np.random.default_rng(1)
false_pos = sum(stats.ttest_ind(rng.normal(0, 1, 200), rng.normal(0, 1, 200)).pvalue < 0.05 for _ in range(400))
hits = sum(stats.ttest_ind(rng.normal(0, 1, 200), rng.normal(0.25, 1, 200)).pvalue < 0.05 for _ in range(400))
print(false_pos / 400, hits / 400)
```

Без эффекта тест ошибается примерно в 5% случаев; при эффекте 0,25 std и 200 наблюдениях в группе он замечает его примерно в двух случаях из трёх.

## Частые ошибки {#mistakes}

Решение с обратным знаком:

```python wrong
reject = p_value > 0.05
```

```python right
reject = p_value < 0.05
```

Классический t-тест для групп с разными дисперсиями:

```python wrong
stats.ttest_ind(xb, xa)
```

```python right
stats.ttest_ind(xb, xa, equal_var=False)
```

Поправка Йейтса, когда нужен z-тест для долей:

```python wrong
stats.chi2_contingency(table)
```

```python right
stats.chi2_contingency(table, correction=False)
```

## Шпаргалка {#cheatsheet}

```python
stats.ttest_ind(b, a, equal_var=False, alternative="two-sided").pvalue
stats.mannwhitneyu(b, a, alternative="two-sided").pvalue
table = pd.crosstab(df["group"], df["converted"])
chi2, p, dof, exp = stats.chi2_contingency(table, correction=False)
p = (xa + xb) / (na + nb); se = np.sqrt(p * (1 - p) * (1 / na + 1 / nb))
z = (xb / nb - xa / na) / se; p_value = 2 * stats.norm.sf(abs(z))
reject = p_value < alpha
```
