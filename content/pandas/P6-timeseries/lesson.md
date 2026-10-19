# Временные ряды

## Зачем это нужно {#why}

Почти любой дашборд — это время по оси X: выручка по дням, активные пользователи по неделям, рост месяц к месяцу. Аналитику нужно уметь сворачивать события в дни и месяцы, сглаживать шум скользящим средним и сравнивать период с предыдущим.

В SQL для этого есть `date_trunc`, `GROUP BY` по дате и оконные функции `LAG`, `ROW_NUMBER`, `SUM() OVER`. В pandas то же самое делают `resample`, `rolling`, `shift`, `rank` и `cumsum`. Работаем с заказами `orders.csv` и событиями сайта `events.csv`.

## Даты в индексе {#datetime}

Методы временных рядов работают, когда даты — настоящий `datetime`, а чаще всего ещё и индекс таблицы.

```python run
import pandas as pd

orders = pd.read_csv("orders.csv", parse_dates=["order_date"])
daily = orders.set_index("order_date").sort_index()
print(daily.index.min(), daily.index.max())
print(daily.loc["2026-09-01":"2026-09-03", ["order_id", "amount"]])
```

`parse_dates` переводит колонку в даты сразу при чтении. С `DatetimeIndex` работают срезы строкой: `daily.loc["2026-09"]` — весь сентябрь, `daily.loc["2026-09-01":"2026-09-03"]` — три дня включительно. Перед срезом индекс нужно отсортировать.

## resample: свернуть по периодам {#resample}

`resample` — это `groupby` по периодам времени. Правило периода: `"D"` — день, `"W"` — неделя, `"MS"` — месяц с подписью первым днём, `"ME"` — месяц с подписью последним днём, `"QS"` — квартал.

```python run
import pandas as pd

orders = pd.read_csv("orders.csv", parse_dates=["order_date"])
s = orders.set_index("order_date")["amount"]
print(s.resample("MS").sum().tail(3).round(2))
print(s.resample("D").size().loc["2026-09-24":"2026-09-30"])
orders.resample("W", on="order_date").agg(n=("order_id", "count"), revenue=("amount", "sum")).tail(3)
```

Главное отличие от `groupby`: resample создаёт **все** периоды подряд, даже пустые. День без заказов получит сумму 0 и размер 0 — так на графике не будет «дыр». Вместо `set_index` можно передать колонку через `on=`.

## rolling: скользящее окно {#rolling}

Дневные данные шумят: выходные, праздники, случайности. Скользящее среднее за 7 дней сглаживает недельный цикл.

```python run
import pandas as pd

orders = pd.read_csv("orders.csv", parse_dates=["order_date"])
daily = orders.resample("D", on="order_date")["amount"].sum()
smooth = daily.rolling(7).mean().round(2)
print(pd.DataFrame({"day": daily, "avg7": smooth}).tail(4))
print(daily.rolling(7, min_periods=1).mean().head(3).round(2).tolist())
```

`rolling(7)` берёт текущую строку и 6 предыдущих. Первые 6 значений — `NaN`, потому что окну не хватает данных; `min_periods=1` считает и по неполному окну. Кроме `mean` бывают `sum`, `max`, `std`. Окно `"7D"` вместо `7` считает по календарю и требует индекс из дат.

## shift, diff, pct_change: сравнить с прошлым {#shift}

`shift(1)` сдвигает ряд на одну строку вниз: в каждой строке оказывается предыдущее значение — это `LAG` из SQL. На его основе `diff` даёт разницу, а `pct_change` — относительный рост.

```python run
import pandas as pd

orders = pd.read_csv("orders.csv", parse_dates=["order_date"])
m = orders.resample("MS", on="order_date")["amount"].sum()
t = pd.DataFrame({"revenue": m, "prev": m.shift(1), "diff": m.diff(), "growth": m.pct_change().round(4)})
print(t.tail(3))
orders = orders.sort_values(["customer_id", "order_date"])
orders["prev_date"] = orders.groupby("customer_id")["order_date"].shift(1)
orders[["customer_id", "order_date", "prev_date"]].head(4)
```

С `groupby` сдвиг идёт внутри каждой группы: первая покупка клиента получает `NaN`, а не дату чужого заказа. Порядок строк задаёт сортировка перед shift.

## rank и cumsum: оконные функции {#rank}

Нумерация внутри группы, накопительный итог и номер по порядку — частые вопросы на собеседовании по SQL. В pandas это `rank`, `cumsum` и `cumcount`.

```python run
import pandas as pd

orders = pd.read_csv("orders.csv", parse_dates=["order_date"]).sort_values(["customer_id", "order_date", "order_id"])
g = orders.groupby("customer_id")
orders["n"] = g.cumcount() + 1
orders["running"] = g["amount"].cumsum().round(2)
orders["rank_amount"] = g["amount"].rank(ascending=False, method="first").astype(int)
orders.loc[orders["customer_id"] == 2, ["order_date", "amount", "n", "running", "rank_amount"]].head(5)
```

`method="first"` даёт уникальные номера, как `ROW_NUMBER()`. `method="min"` при равных значениях даёт одинаковый ранг с пропуском, как `RANK()`, а `method="dense"` — без пропуска, как `DENSE_RANK()`.

## Частые ошибки {#mistakes}

resample по таблице без индекса из дат:

```python wrong
orders.resample("MS")["amount"].sum()
```

```python right
orders.resample("MS", on="order_date")["amount"].sum()
```

groupby по дате вместо resample теряет пустые дни:

```python wrong
orders.groupby("order_date")["amount"].sum().rolling(7).mean()
```

```python right
orders.resample("D", on="order_date")["amount"].sum().rolling(7).mean()
```

shift без группировки берёт значение чужого клиента:

```python wrong
orders["prev_date"] = orders["order_date"].shift(1)
```

```python right
orders["prev_date"] = orders.groupby("customer_id")["order_date"].shift(1)
```

## Шпаргалка {#cheatsheet}

```python
pd.read_csv(f, parse_dates=["d"])     df.set_index("d").sort_index()
df.loc["2026-09"]                      df.loc["2026-09-01":"2026-09-07"]
s.resample("D" | "W" | "MS" | "ME").sum()    df.resample("MS", on="d")
s.rolling(7).mean()   s.rolling(7, min_periods=1).mean()
s.shift(1)   s.diff()   s.pct_change()   # LAG
g = df.groupby("k"); g["v"].shift(1); g.cumcount() + 1; g["v"].cumsum()
g["v"].rank(ascending=False, method="first")   # ROW_NUMBER
s.dt.to_period("W").dt.start_time      # начало недели
```
