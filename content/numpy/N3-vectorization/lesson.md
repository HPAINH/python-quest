# Векторизация

## Зачем это нужно {#why}

Векторизация — запись расчёта через операции над целыми массивами вместо циклов. Код получается короче и в десятки раз быстрее: цикл Python обрабатывает элементы по одному, а NumPy — пачкой внутри быстрого скомпилированного кода. На больших данных это разница между секундой и минутой.

В этом уровне — переписывание циклов, broadcasting (как NumPy совмещает массивы разной формы), агрегаты по осям и накопительные суммы. В задачах типа «Без циклов» `for`, `while` и генераторы списков запрещены, а время работы ограничено. Босс — сводка продаж «магазин × день».

## Векторизация вместо цикла {#vectorization}

Любой расчёт «для каждого элемента» записывается одной формулой. Условия внутри цикла заменяют на `np.where` или на умножение на маску.

```python run
import numpy as np
import time

price = np.random.default_rng(1).uniform(100, 5000, size=200_000)
qty = np.random.default_rng(2).integers(1, 20, size=200_000)

t = time.perf_counter()
slow = [p * q * (0.9 if q >= 10 else 1.0) for p, q in zip(price, qty)]
t_loop = time.perf_counter() - t

t = time.perf_counter()
fast = price * qty * np.where(qty >= 10, 0.9, 1.0)
t_vec = time.perf_counter() - t
print(round(t_loop / t_vec), "раз быстрее", np.allclose(slow, fast))
```

Математические функции NumPy тоже работают поэлементно: `np.sqrt`, `np.log`, `np.exp`, `np.abs`, `np.round`. Их называют универсальными функциями.

## Broadcasting {#broadcasting}

Broadcasting — правило, по которому NumPy совмещает массивы разной формы. Число совмещается с любым массивом. Строка формы `(n,)` прибавляется к каждой строке матрицы `(m, n)`. Чтобы совместить с матрицей столбец, ему нужна форма `(m, 1)`.

```python run
import numpy as np

sales = np.array([[10, 20, 30],
                  [40, 50, 60]])
plan = np.array([15, 25, 35])
print(sales - plan)
bonus = np.array([[100], [200]])
print(sales + bonus)
print(sales / sales.sum(axis=1, keepdims=True))
```

Правило: формы сравниваются с конца, и по каждой оси размеры должны совпадать или один из них должен быть равен 1. `(2, 3)` и `(3,)` совмещаются, `(2, 3)` и `(2,)` — нет. Столбец из одномерного массива получают через `a[:, None]` или `a.reshape(-1, 1)`.

## Оси {#axis}

Агрегаты `sum`, `mean`, `max`, `min`, `std` можно считать по всему массиву или по оси. `axis=0` сворачивает строки: получается результат по каждому **столбцу**. `axis=1` сворачивает столбцы: результат по каждой **строке**.

```python run
import numpy as np

sales = np.array([[10, 20, 30],
                  [40, 50, 60]])
print(sales.sum())
print(sales.sum(axis=0))
print(sales.sum(axis=1))
print(sales.mean(axis=1), sales.argmax(axis=1))
```

Запомнить легко: ось, указанная в `axis`, исчезает из формы. У `(2, 3)` сумма по `axis=0` имеет форму `(3,)`, а по `axis=1` — `(2,)`. `keepdims=True` оставляет ось размером 1, и результат удобно делить обратно на исходную матрицу.

## Накопление и статистика {#aggregates}

`np.cumsum` даёт накопительную сумму, `np.diff` — разности соседних элементов, `np.mean` и `np.std` — среднее и стандартное отклонение. Стандартизация (z-оценка) показывает, на сколько отклонений значение отличается от среднего.

```python run
import numpy as np

daily = np.array([100, 120, 90, 150, 130])
print(np.cumsum(daily))
print(np.diff(daily))
z = (daily - daily.mean()) / daily.std()
print(np.round(z, 2))
print(np.percentile(daily, 50), np.median(daily))
```

`np.diff` возвращает массив на один элемент короче. `np.percentile(a, q)` — значение, ниже которого лежит q процентов данных, а 50-й перцентиль — медиана.

## Частые ошибки {#mistakes}

Цикл вместо векторной операции:

```python wrong
result = np.array([x * 2 if x > 0 else 0 for x in a])
```

```python right
result = np.where(a > 0, a * 2, 0)
```

Перепутана ось:

```python wrong
store_totals = sales.sum(axis=0)
```

```python right
store_totals = sales.sum(axis=1)
```

Деление матрицы на суммы строк без keepdims:

```python wrong
share = sales / sales.sum(axis=1)
```

```python right
share = sales / sales.sum(axis=1, keepdims=True)
```

Сравнение дробных через ==:

```python wrong
same = np.all(a == b)
```

```python right
same = np.allclose(a, b)
```

## Шпаргалка {#cheatsheet}

```python
a * 2  a + b  np.sqrt(a)  np.abs(a)  np.round(a, 2)
np.where(a > 0, a, 0)            # условие без цикла
m - row                          # (m, n) - (n,)
m + col[:, None]                 # (m, n) + (m, 1)
m.sum(axis=0)                    # по столбцам
m.sum(axis=1)                    # по строкам
m / m.sum(axis=1, keepdims=True)
m.argmax(axis=1)  m.mean(axis=0)  a.std()
np.cumsum(a)  np.diff(a)  np.percentile(a, 90)  np.median(a)
(a - a.mean()) / a.std()         # z-оценка
np.allclose(a, b)
```
