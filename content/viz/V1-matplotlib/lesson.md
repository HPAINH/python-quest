# matplotlib

## Зачем это нужно {#why}

График объясняет данные быстрее таблицы: рост выручки, провал в июле, лидер среди каналов видны сразу. matplotlib — основа графиков в Python: на нём построены pandas `.plot()` и seaborn, и на нём же их донастраивают.

В уровне строим линии, столбцы и несколько графиков на одной картинке, подписываем оси и добавляем легенду. Проверка смотрит не на картинку, а на объект графика: тип, данные, число линий, подписи. Цвета и стиль можно выбирать любые.

## Фигура и оси {#figure}

Фигура (`Figure`) — весь холст, оси (`Axes`) — отдельный график на нём. Надёжный способ работы — явно получить оба объекта через `plt.subplots()` и рисовать методами `ax`.

```python run
import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(6, 3))
ax.plot([1, 2, 3, 4], [10, 14, 9, 17])
ax.set_title("Первый график")
print(type(fig).__name__, type(ax).__name__, len(fig.axes))
```

`plt.plot(...)` без `ax` тоже работает — рисует на «текущих» осях. Для одного графика это удобно, а для нескольких осей лучше явный `ax`: так видно, куда что рисуется.

## Линия {#line}

Линия показывает изменение во времени. По X — даты или периоды, по Y — значение.

```python run
import pandas as pd
import matplotlib.pyplot as plt

orders = pd.read_csv("orders.csv", parse_dates=["order_date"])
m = orders.resample("MS", on="order_date")["amount"].sum() / 1e6
fig, ax = plt.subplots(figsize=(7, 3))
ax.plot(m.index, m.values, marker="o")
ax.set_title("Выручка по месяцам")
ax.set_ylabel("млн ₽")
```

У pandas есть короткая запись: `m.plot(ax=ax)`. Она строит ту же линию и сама подписывает ось X именем индекса.

## Столбцы {#bar}

Столбцы сравнивают категории: каналы, города, категории товаров. Вертикальные — `ax.bar(x, высоты)`, горизонтальные — `ax.barh(y, длины)`; горизонтальные удобны для длинных подписей.

```python run
import pandas as pd
import matplotlib.pyplot as plt

orders = pd.read_csv("orders.csv")
s = orders.groupby("channel")["amount"].sum().sort_values(ascending=False) / 1e6
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(8, 3))
ax1.bar(s.index, s.values)
ax1.set_title("Выручка, млн ₽")
s.sort_values().plot(kind="barh", ax=ax2)
ax2.set_title("То же горизонтально")
```

Столбцы сортируют по значению, чтобы глаз сразу находил лидера. Для `barh` сортируют по возрастанию: matplotlib рисует первую строку снизу.

## Подписи и легенда {#labels}

У графика для отчёта всегда есть заголовок и подписи осей с единицами измерения. Если линий несколько, нужна легенда: у каждой линии `label=...`, затем `ax.legend()`.

```python run
import pandas as pd
import matplotlib.pyplot as plt

orders = pd.read_csv("orders.csv", parse_dates=["order_date"])
fig, ax = plt.subplots(figsize=(7, 3))
for ch in ["app", "web"]:
    m = orders[orders["channel"] == ch].resample("MS", on="order_date")["amount"].sum()
    ax.plot(m.index, m.values / 1e6, label=ch)
ax.set_title("Выручка по каналам")
ax.set_xlabel("Месяц")
ax.set_ylabel("млн ₽")
ax.legend()
```

Через `plt` то же самое: `plt.title`, `plt.xlabel`, `plt.ylabel`, `plt.legend`. Методы осей начинаются с `set_`.

## Несколько графиков {#subplots}

`plt.subplots(строк, колонок)` создаёт сетку осей. Для одной строки или колонки `axes` — массив из осей, для сетки — двумерный массив `axes[i, j]`.

```python run
import pandas as pd
import matplotlib.pyplot as plt

orders = pd.read_csv("orders.csv", parse_dates=["order_date"])
m = orders.resample("MS", on="order_date").agg(n=("order_id", "count"), check=("amount", "mean"))
fig, axes = plt.subplots(1, 2, figsize=(9, 3))
axes[0].plot(m.index, m["n"])
axes[0].set_title("Заказов в месяц")
axes[1].plot(m.index, m["check"])
axes[1].set_title("Средний чек, ₽")
fig.tight_layout()
print(axes.shape)
```

`fig.tight_layout()` раздвигает графики, чтобы подписи не налезали друг на друга. `sharex=True` делает общую ось X.

## Частые ошибки {#mistakes}

X и Y разной длины — например, X взят до фильтра, а Y после:

```python wrong
ax.plot(orders["order_date"], delivered["amount"])
```

```python right
ax.plot(delivered["order_date"], delivered["amount"])
```

Неотсортированные столбцы:

```python wrong
ax.bar(s.index, s.values)
```

```python right
s = s.sort_values(ascending=False)
ax.bar(s.index, s.values)
```

Несколько линий без легенды:

```python wrong
ax.plot(a.index, a.values)
ax.plot(b.index, b.values)
```

```python right
ax.plot(a.index, a.values, label="app")
ax.plot(b.index, b.values, label="web")
ax.legend()
```

## Шпаргалка {#cheatsheet}

```python
fig, ax = plt.subplots(figsize=(7, 3))       fig, axes = plt.subplots(1, 2)
ax.plot(x, y, marker="o", label="...")       s.plot(ax=ax)
ax.bar(x, h)   ax.barh(y, w)                  s.plot(kind="bar" | "barh", ax=ax)
ax.set_title("...")  ax.set_xlabel("...")  ax.set_ylabel("...")
ax.legend()   fig.tight_layout()   fig.suptitle("...")
plt.title / plt.xlabel / plt.ylabel / plt.legend   # то же без ax
```
