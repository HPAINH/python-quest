# Описательная статистика

## Зачем это нужно {#why}

Прежде чем сравнивать группы и проверять гипотезы, данные описывают: где центр, насколько велик разброс, есть ли длинный хвост и выбросы. От этого зависит, какое среднее брать и какой тест применять.

В уровне — меры центра и разброса, форма распределения, классические распределения из `scipy.stats` и стандартизация. Проверка сравнивает числа с допуском, указанным в задаче, — округлять ответы не нужно.

## Центр {#center}

Среднее (`mean`) чувствительно к выбросам, медиана (`median`) — нет. Мода (`mode`) — самое частое значение, полезна для категорий и дискретных величин.

```python run
import pandas as pd

orders = pd.read_csv("orders.csv")
a = orders["amount"]
print(round(a.mean(), 2), a.median(), orders["channel"].mode().tolist())
trimmed = a[(a > a.quantile(0.05)) & (a < a.quantile(0.95))].mean()
print(round(trimmed, 2))
```

Если среднее заметно больше медианы, распределение скошено вправо. Для чека, зарплат и длительности визитов медиана обычно честнее описывает «типичное» значение.

## Разброс {#spread}

Дисперсия (`var`) — средний квадрат отклонения от среднего, стандартное отклонение (`std`) — корень из неё в тех же единицах, что и данные. Квантили делят упорядоченные данные: медиана — квантиль 0,5, квартили — 0,25 и 0,75, межквартильный размах IQR — их разность.

```python run
import numpy as np
import pandas as pd

a = pd.read_csv("orders.csv")["amount"]
print(round(a.std(), 2), round(np.std(a.values), 2), round(np.std(a.values, ddof=1), 2))
q1, q3 = a.quantile([0.25, 0.75])
print(q1, q3, round(q3 - q1, 2))
```

pandas по умолчанию считает **выборочное** стандартное отклонение с `ddof=1` (деление на n − 1), а NumPy — с `ddof=0` (деление на n). На больших выборках разница мала, на маленьких — заметна.

## Форма {#shape}

Асимметрия (`skew`) больше 0 — длинный правый хвост, меньше 0 — левый. Эксцесс (`kurt`) показывает тяжесть хвостов по сравнению с нормальным распределением.

```python run
import numpy as np
import pandas as pd
from scipy import stats

a = pd.read_csv("orders.csv")["amount"]
print(round(a.skew(), 3), round(stats.skew(a), 3), round(a.kurt(), 3))
print(round(np.log(a).skew(), 3))
```

pandas и scipy считают асимметрию с разными поправками, поэтому числа немного отличаются. Логарифм часто делает скошенные данные почти симметричными.

## Распределения {#distributions}

В `scipy.stats` у каждого распределения одинаковые методы: `pmf` или `pdf` — вероятность или плотность в точке, `cdf` — вероятность получить не больше x, `sf` — больше x (то есть 1 − cdf), `ppf` — обратная к cdf (квантиль).

```python run
from scipy import stats

print(round(stats.binom.pmf(3, n=20, p=0.1), 4))
print(round(stats.binom.sf(2, n=20, p=0.1), 4))
print(round(stats.norm.cdf(1.96), 4), round(stats.norm.ppf(0.975), 4))
print(round(stats.poisson.pmf(0, mu=2.5), 4))
```

Биномиальное — число успехов из n попыток (покупок из 20 визитов), Пуассона — число событий за интервал (заказов в час), нормальное — сумма многих мелких влияний. `sf(2)` — это P(X ≥ 3) для дискретной величины: «больше 2».

## Стандартизация и выбросы {#zscore}

z-оценка показывает, на сколько стандартных отклонений значение отстоит от среднего: `z = (x − mean) / std`. Для выбросов есть два правила: |z| > 3 и выход за границы Q1 − 1,5·IQR и Q3 + 1,5·IQR.

```python run
import pandas as pd
from scipy import stats

a = pd.read_csv("orders.csv")["amount"]
z = (a - a.mean()) / a.std()
print(int((z.abs() > 3).sum()))
q1, q3 = a.quantile([0.25, 0.75])
iqr = q3 - q1
print(int(((a < q1 - 1.5 * iqr) | (a > q3 + 1.5 * iqr)).sum()))
print(round(stats.zscore(a).std(), 3))
```

`stats.zscore` по умолчанию делит на std с `ddof=0`, поэтому его результат чуть отличается от формулы через pandas.

## Частые ошибки {#mistakes}

Разный ddof у NumPy и pandas:

```python wrong
np.std(sample)
```

```python right
np.std(sample, ddof=1)
```

P(X ≥ 3) через sf(3) — для дискретных величин это «больше 3»:

```python wrong
stats.binom.sf(3, n=20, p=0.1)
```

```python right
stats.binom.sf(2, n=20, p=0.1)
```

Среднее для скошенных данных как «типичное» значение:

```python wrong
typical = orders["amount"].mean()
```

```python right
typical = orders["amount"].median()
```

## Шпаргалка {#cheatsheet}

```python
s.mean()  s.median()  s.mode()  s.var()  s.std()   # ddof=1
np.std(x, ddof=1)    s.quantile([.25, .5, .75])   q3 - q1
s.skew()  s.kurt()   stats.skew(x)
stats.binom.pmf(k, n, p)  .cdf  .sf  .ppf
stats.poisson.pmf(k, mu)  stats.norm.cdf(x, loc, scale)  stats.norm.ppf(q)
z = (s - s.mean()) / s.std()     stats.zscore(x)   # ddof=0
```
