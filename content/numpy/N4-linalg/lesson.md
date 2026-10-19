# Линейная алгебра и random

## Зачем это нужно {#why}

Почти любая модель машинного обучения внутри — умножение матриц: линейная регрессия считает `X @ w`, а слой нейросети — `X @ W + b`. В треке D ты соберёшь нейросеть именно из этих операций. Вторая тема — случайные числа: на них построены симуляции, бутстрэп в статистике, разбиение данных на обучающую и тестовую выборки.

В этом уровне — матричное умножение, решение систем уравнений и метод наименьших квадратов, генератор случайных чисел с seed и симуляции Монте-Карло. Босс — прогноз нехватки товара на складе.

## Матрицы {#linalg}

Оператор `@` умножает матрицы: строка первой матрицы скалярно умножается на столбец второй. Формы должны быть согласованы: `(m, k) @ (k, n)` даёт `(m, n)`. `*` умножает поэлементно — это другая операция.

```python run
import numpy as np

qty = np.array([[2, 0, 1],
                [1, 3, 0]])
price = np.array([450, 990, 1290])
print(qty @ price)
print(qty.T.shape, (qty @ qty.T).shape)
```

Здесь каждая строка `qty` — заказ, а `qty @ price` сразу считает суммы всех заказов. `np.linalg.solve(A, b)` решает систему уравнений `A x = b`, `np.linalg.inv` находит обратную матрицу, `np.eye(n)` создаёт единичную.

```python run
import numpy as np

A = np.array([[2.0, 1.0], [1.0, 3.0]])
b = np.array([8.0, 13.0])
x = np.linalg.solve(A, b)
print(x, np.allclose(A @ x, b))
x_line = np.array([1, 2, 3, 4.0])
y = np.array([3.1, 4.9, 7.2, 8.8])
print(np.round(np.polyfit(x_line, y, 1), 3))
```

`np.polyfit(x, y, 1)` подбирает прямую `y = a·x + b` методом наименьших квадратов и возвращает `[a, b]`. Это простейшая линейная регрессия.

## Случайные числа {#random}

Случайные числа создаёт генератор `rng = np.random.default_rng(seed)`. Одинаковый `seed` даёт одинаковую последовательность — так эксперимент можно повторить, а проверка задачи совпадёт с эталоном.

```python run
import numpy as np

rng = np.random.default_rng(42)
print(rng.integers(1, 7, size=5))
print(np.round(rng.random(3), 3))
print(np.round(rng.normal(100, 15, size=3), 1))
print(rng.choice(["app", "web", "offline"], size=4, p=[0.5, 0.4, 0.1]))
rng2 = np.random.default_rng(42)
print(rng2.integers(1, 7, size=5))
```

`integers(lo, hi)` не включает `hi`, `random()` даёт числа от 0 до 1, `normal(mean, sd)` — нормальное распределение, `poisson(lam)` — число событий за период, `choice` — выбор из списка с вероятностями.

Каждый вызов сдвигает генератор. Если вызвать функции в другом порядке, числа будут другими. Поэтому в задачах важно делать вызовы ровно так, как сказано в условии.

## Симуляции {#simulation}

Метод Монте-Карло отвечает на вопрос «какова вероятность» без формул: генерируем тысячи случайных сценариев и считаем долю нужных. Каждый сценарий — строка матрицы, поэтому всё считается без циклов.

```python run
import numpy as np

rng = np.random.default_rng(7)
rolls = rng.integers(1, 7, size=(100_000, 4))
has_six = (rolls == 6).any(axis=1)
print(round(has_six.mean(), 3), round(1 - (5 / 6) ** 4, 3))
demand = rng.poisson(20, size=(10_000, 30)).sum(axis=1)
print(np.percentile(demand, [5, 50, 95]))
```

Оценка совпадает с точным ответом `1 - (5/6)⁴` до второго-третьего знака. Чем больше сценариев, тем точнее. `np.percentile(a, 95)` даёт значение, которое не превышают 95% сценариев, — так считают запас товара «с запасом прочности».

## Частые ошибки {#mistakes}

Поэлементное умножение вместо матричного:

```python wrong
totals = qty * price_matrix
```

```python right
totals = qty @ price_matrix
```

Несогласованные формы:

```python wrong
(np.ones((3, 2)) @ np.ones((3, 2))).shape
```

```python right
(np.ones((3, 2)) @ np.ones((3, 2)).T).shape
```

Генератор без seed — результат каждый раз разный:

```python wrong
rng = np.random.default_rng()
```

```python right
rng = np.random.default_rng(42)
```

Новый генератор на каждый вызов повторяет одни и те же числа:

```python wrong
a = np.random.default_rng(1).random()
b = np.random.default_rng(1).random()
```

```python right
rng = np.random.default_rng(1)
a, b = rng.random(), rng.random()
```

## Шпаргалка {#cheatsheet}

```python
A @ B          # (m, k) @ (k, n) -> (m, n)
A.T  np.eye(3)  np.linalg.inv(A)  np.linalg.det(A)
np.linalg.solve(A, b)        # A x = b
np.polyfit(x, y, 1)          # [наклон, сдвиг]
rng = np.random.default_rng(42)
rng.integers(1, 7, size=10)  # без правой границы
rng.random(5)  rng.normal(0, 1, 5)  rng.poisson(20, 5)
rng.choice(items, size=3, p=[...])
(sims == 6).any(axis=1).mean()   # доля сценариев
np.percentile(a, 95)
```
