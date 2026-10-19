# Доверительные интервалы

## Зачем это нужно {#why}

Средний чек по выборке 2 950 ₽ — это оценка, а не истина. Другая выборка дала бы 2 900 или 3 010. Доверительный интервал отвечает на вопрос «в каком диапазоне, скорее всего, настоящее значение» и показывает, насколько можно доверять цифре в отчёте.

В уровне — стандартная ошибка, интервалы для среднего и для доли, расчёт размера выборки и bootstrap, который строит интервал для любой метрики без формул.

## Стандартная ошибка {#se}

Стандартная ошибка среднего (SE) — разброс выборочного среднего от выборки к выборке: `SE = s / √n`, где s — выборочное стандартное отклонение. Она падает с ростом выборки, но медленно: чтобы уменьшить SE вдвое, нужно в 4 раза больше данных.

```python run
import numpy as np
import pandas as pd
from scipy import stats

a = pd.read_csv("orders.csv")["amount"]
se = a.std() / np.sqrt(len(a))
print(round(se, 2), round(stats.sem(a), 2))
small = a.sample(100, random_state=1)
print(round(small.std() / np.sqrt(len(small)), 2))
```

`stats.sem` считает то же самое: по умолчанию с `ddof=1`.

## Интервал для среднего {#ci-mean}

95% интервал для среднего: `mean ± t · SE`, где t — квантиль распределения Стьюдента с n − 1 степенями свободы. На больших выборках t почти равно 1,96 из нормального распределения.

```python run
import numpy as np
import pandas as pd
from scipy import stats

a = pd.read_csv("orders.csv")["amount"]
n, m, se = len(a), a.mean(), stats.sem(a)
t = stats.t.ppf(0.975, df=n - 1)
print(round(m - t * se, 2), round(m + t * se, 2))
low, high = stats.t.interval(0.95, df=n - 1, loc=m, scale=se)
print(round(low, 2), round(high, 2), round(t, 4))
```

Интервал — про среднее, а не про отдельные заказы: 95% заказов лежат в гораздо более широком диапазоне.

## Интервал для доли {#ci-prop}

Для доли p по n наблюдениям `SE = √(p(1 − p) / n)`, интервал — `p ± 1,96 · SE` (нормальное приближение). Оно хорошо работает, когда в выборке есть хотя бы по 10 «успехов» и «неуспехов».

```python run
import numpy as np
import pandas as pd
from scipy import stats

orders = pd.read_csv("orders.csv")
x = (orders["status"] == "cancelled").sum()
n = len(orders)
p = x / n
se = np.sqrt(p * (1 - p) / n)
z = stats.norm.ppf(0.975)
print(x, n, round(p, 4), round(p - z * se, 4), round(p + z * se, 4))
```

## Размер выборки {#sample-size}

Из формулы интервала можно найти n для нужной точности: если допустимая погрешность E, то `n = (z · s / E)²` для среднего и `n = z² · p(1 − p) / E²` для доли. Результат округляют **вверх**.

```python run
import math
from scipy import stats

z = stats.norm.ppf(0.975)
s = 2400
print(math.ceil((z * s / 100) ** 2))
p = 0.1
print(math.ceil(z ** 2 * p * (1 - p) / 0.01 ** 2))
```

Точность в 100 ₽ при разбросе 2 400 ₽ требует около 2 200 заказов; точность доли ±1 п. п. при p ≈ 10% — около 3 500 наблюдений.

## Bootstrap {#bootstrap}

Bootstrap строит интервал для любой метрики — медианы, разницы средних, перцентиля. Из выборки много раз берут случайную выборку того же размера **с возвращением**, считают метрику и смотрят на 2,5-й и 97,5-й перцентили полученных значений.

```python run
import numpy as np
import pandas as pd

a = pd.read_csv("orders.csv")["amount"].to_numpy()
rng = np.random.default_rng(42)
medians = [np.median(rng.choice(a, size=len(a), replace=True)) for _ in range(1000)]
low, high = np.percentile(medians, [2.5, 97.5])
print(np.median(a), round(low, 2), round(high, 2))
```

Генератор с зафиксированным seed делает результат воспроизводимым. Bootstrap случаен, поэтому при другом seed границы немного сдвинутся — проверка в задачах сравнивает их с допуском.

## Частые ошибки {#mistakes}

Стандартное отклонение вместо стандартной ошибки:

```python wrong
low, high = m - 1.96 * a.std(), m + 1.96 * a.std()
```

```python right
low, high = m - 1.96 * a.std() / np.sqrt(len(a)), m + 1.96 * a.std() / np.sqrt(len(a))
```

Bootstrap без возвращения — каждая «новая» выборка совпадает с исходной:

```python wrong
rng.choice(a, size=len(a), replace=False)
```

```python right
rng.choice(a, size=len(a), replace=True)
```

Размер выборки округлён вниз:

```python wrong
n = int((z * s / e) ** 2)
```

```python right
n = math.ceil((z * s / e) ** 2)
```

## Шпаргалка {#cheatsheet}

```python
se = s.std() / np.sqrt(len(s))       stats.sem(s)
t = stats.t.ppf(0.975, df=n - 1)     stats.t.interval(0.95, df=n - 1, loc=m, scale=se)
p = x / n; se = np.sqrt(p * (1 - p) / n); p ± stats.norm.ppf(0.975) * se
n = math.ceil((z * s / e) ** 2)      n = math.ceil(z**2 * p * (1 - p) / e**2)
rng = np.random.default_rng(seed); rng.choice(a, size=len(a), replace=True)
np.percentile(boot, [2.5, 97.5])
```
