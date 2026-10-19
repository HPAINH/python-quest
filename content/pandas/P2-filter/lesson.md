# Выбор и фильтрация

## Зачем это нужно {#why}

Почти любой вопрос к данным начинается с отбора: заказы за сентябрь, клиенты из Казани, товары дороже 1000 ₽. В SQL это `WHERE`, `ORDER BY` и `LIMIT`, в pandas — маски, `loc`, `query` и `sort_values`. Маски работают так же, как в NumPy из уровня N2, только для таблиц.

В этом уровне — работа с колонками, выбор строк и колонок через `loc` и `iloc`, фильтры с несколькими условиями, `isin` и `between`, `query` и сортировка. Босс — список VIP-клиентов и их крупных заказов.

## Колонки {#columns}

Колонки выбирают, переименовывают, создают и удаляют. `rename` меняет имена по словарю, `drop(columns=...)` удаляет колонки, `assign` добавляет новые и возвращает новую таблицу.

```python run
import pandas as pd

orders = pd.read_csv("orders.csv")
small = orders[["order_id", "amount", "delivery_cost"]]
small = small.rename(columns={"order_id": "id"})
small = small.assign(total=small["amount"] + small["delivery_cost"])
small.drop(columns=["delivery_cost"]).head(3)
```

Методы pandas обычно возвращают **новую** таблицу, а исходную не меняют. Поэтому результат присваивают: `df = df.rename(...)`. Параметр `inplace=True` меняет таблицу на месте и возвращает `None` — его лучше не использовать.

## loc и iloc {#loc-iloc}

`loc` выбирает строки и колонки по **подписям** и маскам, `iloc` — по **позициям**, как индексы в NumPy. Формат: `df.loc[строки, колонки]`.

```python run
import pandas as pd

customers = pd.read_csv("customers.csv")
print(customers.iloc[0, 1], customers.iloc[-1]["name"])
print(customers.iloc[:3, :2])
customers.loc[customers["city"] == "Казань", ["name", "loyalty"]].head(3)
```

Срез `iloc[:3]` не включает конец, как в Python, а срез `loc[2:5]` по подписям включает обе границы. Через `loc` правильно менять значения по условию: `df.loc[маска, "колонка"] = значение`. Запись в два шага `df[маска]["колонка"] = ...` меняет временную копию и в pandas 3 не работает.

```python run
import pandas as pd

orders = pd.read_csv("orders.csv")
orders.loc[orders["promo_code"] == "FREEDLV", "delivery_cost"] = 0
print(orders.loc[orders["promo_code"] == "FREEDLV", "delivery_cost"].max())
```

## Фильтры {#filter}

Маска из сравнения колонки оставляет подходящие строки. Условия объединяются через `&`, `|` и `~`, каждое — в скобках. `isin` проверяет попадание в список, `between` — в диапазон включительно.

```python run
import pandas as pd

orders = pd.read_csv("orders.csv")
big = orders[(orders["status"] == "delivered") & (orders["amount"] > 5000)]
print(len(big))
mobile = orders[orders["channel"].isin(["app", "web"])]
sept = orders[orders["order_date"].between("2026-09-01", "2026-09-30")]
print(len(mobile), len(sept))
orders[orders["promo_code"].notna()].head(3)
```

`notna()` и `isna()` выбирают строки с заполненным и пустым значением. Даты в формате ГГГГ-ММ-ДД можно сравнивать строками. После фильтра индекс сохраняет старые номера строк — `reset_index(drop=True)` пронумерует их заново.

## query {#query}

`query` принимает условие строкой — читается почти как SQL. Внутри можно писать `and`, `or`, `not`, `in`, а внешние переменные подставлять через `@`.

```python run
import pandas as pd

orders = pd.read_csv("orders.csv")
limit = 3000
res = orders.query("channel == 'offline' and amount > @limit")
print(len(res))
orders.query("status in ['cancelled', 'returned']").head(3)
```

`query` удобен для длинных условий. Маски универсальнее: работают с методами вроде `str.contains`, и их проще собирать по частям в коде.

## Сортировка {#sort}

`sort_values` сортирует по одной или нескольким колонкам. `ascending=False` — по убыванию, а список в `ascending` задаёт направление для каждой колонки. `nlargest(n, колонка)` и `nsmallest` быстро дают топ.

```python run
import pandas as pd

orders = pd.read_csv("orders.csv")
top = orders.sort_values(["amount", "order_id"], ascending=[False, True])
print(top[["order_id", "amount"]].head(3))
orders.nlargest(3, "amount")[["order_id", "amount"]]
```

При одинаковых значениях порядок строк зависит от алгоритма, поэтому для воспроизводимого результата добавляют вторую колонку сортировки — как `ORDER BY amount DESC, order_id` в SQL.

## Частые ошибки {#mistakes}

and вместо &:

```python wrong
orders[orders["amount"] > 1000 and orders["channel"] == "app"]
```

```python right
orders[(orders["amount"] > 1000) & (orders["channel"] == "app")]
```

Цепочное присваивание:

```python wrong
orders[orders["promo_code"] == "FREEDLV"]["delivery_cost"] = 0
```

```python right
orders.loc[orders["promo_code"] == "FREEDLV", "delivery_cost"] = 0
```

inplace=True с присваиванием:

```python wrong
orders = orders.sort_values("amount", inplace=True)
```

```python right
orders = orders.sort_values("amount")
```

Сравнение с несколькими значениями через ==:

```python wrong
orders[orders["channel"] == ["app", "web"]]
```

```python right
orders[orders["channel"].isin(["app", "web"])]
```

## Шпаргалка {#cheatsheet}

```python
df[["a", "b"]]  df.rename(columns={"a": "x"})  df.drop(columns=["b"])
df.assign(c=df["a"] * 2)
df.iloc[0]  df.iloc[:3, :2]  df.iloc[-1]
df.loc[mask, ["a", "b"]]
df.loc[mask, "a"] = 0                  # изменение по условию
df[(df.a > 1) & (df.b == "x")]  df[~mask]
df[df.c.isin(["app", "web"])]  df[df.d.between("2026-09-01", "2026-09-30")]
df[df.p.notna()]  df.reset_index(drop=True)
df.query("a > 1 and b == 'x'")  df.query("a > @limit")
df.sort_values(["a", "id"], ascending=[False, True])
df.nlargest(5, "a")  df.head(10)
```
