# Группировки

## Зачем это нужно {#why}

Большинство вопросов бизнеса звучит как «сколько по каждому…»: выручка по каналам, число заказов по клиентам, средний чек по месяцам. В SQL это `GROUP BY`, в pandas — `groupby`. Схема одна и та же: **разбить** строки на группы по ключу, **посчитать** что-то в каждой группе и **собрать** ответы в таблицу.

В уровне разберём `groupby` с одной и несколькими колонками, `agg` с несколькими функциями, `transform` для расчётов «доля от группы», `size` и `value_counts`, сводные таблицы `pivot_table` и `crosstab`.

## groupby {#groupby}

`df.groupby("ключ")["колонка"].функция()` возвращает Series: подписи — значения ключа, значения — результат по группе.

```python run
import pandas as pd

orders = pd.read_csv("orders.csv")
by_channel = orders.groupby("channel")["amount"].sum().round(2)
print(by_channel)
print(orders.groupby("channel").size())
orders.groupby(["channel", "status"]).size().reset_index(name="n").head(6)
```

Функции: `sum`, `mean`, `median`, `min`, `max`, `count` (непустые значения), `size` (все строки группы), `nunique` (разные значения). Ключом может быть список колонок — тогда группы образуют все встретившиеся сочетания.

`reset_index()` превращает подписи-ключи обратно в обычные колонки. У Series для этого есть удобный аргумент `name` — имя колонки с результатом.

## agg: несколько функций {#agg}

`agg` считает сразу несколько показателей. Самая читаемая форма — **именованная агрегация**: `новое_имя=("колонка", "функция")`.

```python run
import pandas as pd

orders = pd.read_csv("orders.csv")
report = orders.groupby("channel").agg(
    n_orders=("order_id", "count"),
    revenue=("amount", "sum"),
    avg_check=("amount", "mean"),
    clients=("customer_id", "nunique"),
).round(2)
report.sort_values("revenue", ascending=False)
```

Фильтр по результату группировки — аналог `HAVING` — пишут обычной маской по уже посчитанной таблице: `report[report["n_orders"] >= 100]`.

## transform: значение группы в каждой строке {#transform}

Обычная агрегация сжимает группу в одну строку. `transform` возвращает результат **той же длины**, что исходная таблица: каждая строка получает значение своей группы. Так считают доли и отклонения от среднего группы.

```python run
import pandas as pd

orders = pd.read_csv("orders.csv")
total = orders.groupby("customer_id")["amount"].transform("sum")
orders["share"] = (orders["amount"] / total).round(4)
orders["rank"] = orders.groupby("customer_id")["amount"].rank(ascending=False, method="first")
orders.loc[orders["customer_id"] == orders["customer_id"].iloc[0], ["order_id", "amount", "share", "rank"]]
```

Похоже на оконные функции SQL: `SUM(amount) OVER (PARTITION BY customer_id)` и `ROW_NUMBER()`. Первая строка группы — `groupby(...).head(1)` после сортировки, n-я — `nth(n)`.

## Сводные таблицы {#pivot}

`pivot_table` разворачивает группировку по двум ключам в таблицу: один ключ — строки, другой — колонки. `crosstab` — то же для частот.

```python run
import pandas as pd

orders = pd.read_csv("orders.csv")
pt = orders.pivot_table(index="channel", columns="status", values="amount", aggfunc="sum", fill_value=0).round(0)
print(pt)
pd.crosstab(orders["channel"], orders["status"], normalize="index").round(3)
```

`fill_value=0` ставит ноль там, где сочетания не было. `normalize="index"` в crosstab превращает частоты в доли по строке.

## Частые ошибки {#mistakes}

Среднее по всей таблице вместо одной колонки — в pandas 3 падает на текстовых колонках:

```python wrong
orders.groupby("channel").mean()
```

```python right
orders.groupby("channel")["amount"].mean()
```

Деление на агрегат вместо transform — подписи не совпадают, получаются NaN:

```python wrong
orders["amount"] / orders.groupby("customer_id")["amount"].sum()
```

```python right
orders["amount"] / orders.groupby("customer_id")["amount"].transform("sum")
```

count вместо size, когда в колонке есть пропуски:

```python wrong
orders.groupby("channel")["promo_code"].count()
```

```python right
orders.groupby("channel").size()
```

## Шпаргалка {#cheatsheet}

```python
df.groupby("k")["v"].sum()          df.groupby(["k1", "k2"]).size()
s.reset_index(name="n")              df["k"].value_counts()
df.groupby("k").agg(n=("id", "count"), total=("v", "sum"), avg=("v", "mean"))
t[t["n"] >= 10]                      # HAVING
df.groupby("k")["v"].transform("sum")   df.groupby("k")["v"].rank()
df.sort_values("v", ascending=False).groupby("k").head(1)
df.pivot_table(index="a", columns="b", values="v", aggfunc="sum", fill_value=0)
pd.crosstab(df["a"], df["b"], normalize="index")
```
