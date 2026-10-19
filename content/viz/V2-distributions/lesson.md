# Распределения и связи

## Зачем это нужно {#why}

Среднее скрывает форму данных. Средний чек 3 000 ₽ может значить «все платят около трёх тысяч», а может — «большинство платит тысячу, и немного очень крупных заказов». Перед любым расчётом аналитик смотрит на распределение и на связь признаков.

В уровне — гистограмма, ящик с усами, точечный график и библиотека seaborn, которая строит их по таблице одной строкой. seaborn рисует на matplotlib, поэтому подписи и оси настраиваются так же, как в V1.

## Гистограмма {#hist}

Гистограмма делит диапазон значений на корзины (`bins`) и показывает, сколько значений попало в каждую.

```python run
import pandas as pd
import matplotlib.pyplot as plt

orders = pd.read_csv("orders.csv")
fig, ax = plt.subplots(figsize=(7, 3))
counts, edges, bars = ax.hist(orders["amount"], bins=30)
ax.set_title("Распределение суммы заказа")
ax.set_xlabel("₽")
print(len(bars), int(counts.max()), round(orders["amount"].median()), round(orders["amount"].mean()))
```

Длинный правый хвост и среднее заметно выше медианы — признак скошенного распределения: несколько крупных заказов тянут среднее вверх. Число корзин меняет картину, поэтому его задают явно.

## Ящик с усами {#box}

Boxplot показывает медиану (линия в ящике), квартили (края ящика), усы до 1,5 межквартильного размаха и выбросы точками. Удобно сравнивать распределения нескольких групп рядом.

```python run
import pandas as pd
import matplotlib.pyplot as plt

orders = pd.read_csv("orders.csv")
groups = ["app", "offline", "web"]
fig, ax = plt.subplots(figsize=(6, 3))
ax.boxplot([orders.loc[orders["channel"] == g, "amount"] for g in groups])
ax.set_xticks([1, 2, 3], groups)
ax.set_title("Сумма заказа по каналам")
print(orders.groupby("channel")["amount"].quantile([0.25, 0.5, 0.75]).unstack().round(0))
```

## Точечный график {#scatter}

Scatter показывает связь двух чисел: каждая точка — один объект. По форме облака видно, растёт ли Y вместе с X.

```python run
import pandas as pd
import matplotlib.pyplot as plt

items = pd.read_csv("order_items.csv")
products = pd.read_csv("products.csv")
sold = items.groupby("product_id")["quantity"].sum()
t = products.set_index("product_id").join(sold.rename("units"))
fig, ax = plt.subplots(figsize=(6, 3))
ax.scatter(t["price"], t["units"], s=12, alpha=0.6)
ax.set_xlabel("Цена, ₽")
ax.set_ylabel("Продано, шт.")
print(round(t["price"].corr(t["units"]), 3))
```

Коэффициент корреляции `corr` измеряет силу линейной связи от −1 до 1. Корреляция не доказывает причину: дешёвые товары продаются чаще не обязательно из-за цены.

## seaborn {#seaborn}

seaborn строит график по таблице: передаёшь `data=` и имена колонок в `x=`, `y=`, `hue=`. Он сам подписывает оси именами колонок и группирует по `hue`.

```python run
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

orders = pd.read_csv("orders.csv", parse_dates=["order_date"])
orders["weekday"] = orders["order_date"].dt.dayofweek
fig, axes = plt.subplots(1, 2, figsize=(10, 3))
sns.histplot(data=orders, x="amount", bins=30, ax=axes[0])
sns.countplot(data=orders, x="weekday", ax=axes[1])
axes[1].set_title("Заказы по дням недели, 0 — понедельник")
fig.tight_layout()
```

Основные функции: `histplot`, `boxplot`, `scatterplot`, `countplot` (число строк по категории), `barplot` (среднее по категории с доверительным интервалом), `lineplot`, `heatmap`. Аргумент `ax=` рисует на нужных осях.

## Корреляции {#corr}

Матрица корреляций показывает попарные связи сразу для нескольких числовых колонок. Её рисуют тепловой картой.

```python run
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

orders = pd.read_csv("orders.csv")
items = pd.read_csv("order_items.csv")
n = items.groupby("order_id").agg(positions=("product_id", "count"), units=("quantity", "sum"))
t = orders.set_index("order_id").join(n)[["amount", "delivery_cost", "positions", "units"]]
c = t.corr().round(2)
fig, ax = plt.subplots(figsize=(5, 4))
sns.heatmap(c, annot=True, cmap="coolwarm", vmin=-1, vmax=1, ax=ax)
print(c.loc["amount", "units"])
```

## Частые ошибки {#mistakes}

Гистограмма без явного числа корзин — у matplotlib и seaborn разные значения по умолчанию:

```python wrong
sns.histplot(orders["amount"])
```

```python right
sns.histplot(orders["amount"], bins=30)
```

Колонка, которая после groupby стала индексом:

```python wrong
t = orders.groupby("channel")["amount"].sum()
sns.barplot(data=t, x="channel", y="amount")
```

```python right
t = orders.groupby("channel", as_index=False)["amount"].sum()
sns.barplot(data=t, x="channel", y="amount")
```

Точечный график с перепутанными осями — причина по X, следствие по Y:

```python wrong
ax.scatter(t["units"], t["price"])
```

```python right
ax.scatter(t["price"], t["units"])
```

## Шпаргалка {#cheatsheet}

```python
ax.hist(s, bins=30)            sns.histplot(data=df, x="v", bins=30, ax=ax)
ax.boxplot([a, b, c])          sns.boxplot(data=df, x="group", y="v", order=[...], ax=ax)
ax.scatter(x, y, s=10, alpha=.5)   sns.scatterplot(data=df, x="a", y="b", hue="g", ax=ax)
sns.countplot(data=df, x="cat", order=[...])     sns.barplot(...)  # среднее!
df.corr()   sns.heatmap(c, annot=True, vmin=-1, vmax=1)
s.quantile([.25, .5, .75])     s.median()    s.corr(other)
```
