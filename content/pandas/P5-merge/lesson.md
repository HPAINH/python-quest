# Соединения таблиц

## Зачем это нужно {#why}

Данные почти всегда лежат в нескольких таблицах: в заказах — только `customer_id`, имя и город клиента — в `customers`, название категории — в `categories`. Чтобы ответить на вопрос «выручка по городам», таблицы нужно соединить по ключу. В SQL это `JOIN`, в pandas — `merge`.

В уровне разберём `merge` и его виды (`inner`, `left`, `right`, `outer`), ключи с разными именами, конфликт имён колонок, ловушку размножения строк из-за дубликатов ключа и склейку таблиц через `concat`.

## merge {#merge}

`left.merge(right, on="ключ")` находит для каждой строки левой таблицы строки правой с тем же значением ключа и склеивает их колонки.

```python run
import pandas as pd

orders = pd.read_csv("orders.csv")
customers = pd.read_csv("customers.csv")
t = orders.merge(customers[["customer_id", "name", "city"]], on="customer_id")
print(len(orders), len(t))
t[["order_id", "name", "city", "amount"]].head()
```

Перед соединением полезно оставить в правой таблице только нужные колонки — так в результате не появится лишнего. Если одинаковые имена есть в обеих таблицах (например, `name` у товара и у категории), pandas добавит к ним суффиксы `_x` и `_y`. Свои суффиксы задаёт `suffixes=("_product", "_category")`, но понятнее заранее переименовать колонки через `rename`.

## Виды соединений {#how}

Аргумент `how` решает, что делать со строками без пары:

- `inner` (по умолчанию) — только строки, у которых пара нашлась с обеих сторон;
- `left` — все строки левой таблицы, где пары нет — `NaN`;
- `right` — все строки правой;
- `outer` — все строки обеих.

```python run
import pandas as pd

customers = pd.read_csv("customers.csv")
orders = pd.read_csv("orders.csv")
inner = customers.merge(orders, on="customer_id")
left = customers.merge(orders, on="customer_id", how="left", indicator=True)
print(inner["customer_id"].nunique(), left["customer_id"].nunique())
print(left["_merge"].value_counts())
```

`indicator=True` добавляет колонку `_merge` со значениями `both`, `left_only`, `right_only` — так находят строки без пары (аналог `LEFT JOIN ... WHERE right.id IS NULL`). Посчитать заказы с нулями у клиентов без заказов можно только через `left`: `count` по колонке правой таблицы не считает `NaN`.

## Ключи {#keys}

Если ключ называется по-разному, используют `left_on` и `right_on`. Ключей может быть несколько — передают список.

```python run
import pandas as pd

items = pd.read_csv("order_items.csv")
catalog = pd.read_csv("products.csv").rename(columns={"product_id": "id"})
t = items.merge(catalog[["id", "name"]], left_on="product_id", right_on="id")
print(t[["order_id", "product_id", "id", "name"]].head(3))
dup = pd.concat([catalog, catalog.head(5)])
print(len(items.merge(dup, left_on="product_id", right_on="id")) - len(t))
```

Главная ловушка: если в правой таблице ключ повторяется, каждая строка левой таблицы размножится на число повторов. Число строк молча растёт, суммы раздуваются. Защиты две: проверить `right["key"].is_unique` или передать `validate="many_to_one"` — тогда merge упадёт с понятной ошибкой.

## concat {#concat}

`pd.concat` склеивает таблицы одна под другой — как `UNION ALL`. Колонки сопоставляются по именам.

```python run
import pandas as pd

orders = pd.read_csv("orders.csv")
aug = orders[orders["order_date"].str.startswith("2026-08")]
sept = orders[orders["order_date"].str.startswith("2026-09")]
both = pd.concat([aug, sept], ignore_index=True)
print(len(aug), len(sept), len(both), both.index[-1])
```

`ignore_index=True` заново нумерует строки. С `axis=1` concat ставит таблицы рядом по подписям строк — это нужно редко, для соединения по ключу есть merge.

## Частые ошибки {#mistakes}

Нужны все клиенты, а inner теряет клиентов без заказов:

```python wrong
customers.merge(orders, on="customer_id")
```

```python right
customers.merge(orders, on="customer_id", how="left")
```

Дубликаты ключа в справочнике размножают строки:

```python wrong
orders.merge(clients, on="customer_id")
```

```python right
orders.merge(clients.drop_duplicates("customer_id"), on="customer_id", validate="many_to_one")
```

Конфликт имён даёт name_x и name_y:

```python wrong
products.merge(categories, on="category_id")["name"]
```

```python right
cats = categories.rename(columns={"name": "category"})
products.merge(cats, on="category_id")[["name", "category"]]
```

## Шпаргалка {#cheatsheet}

```python
a.merge(b, on="key")                       # INNER JOIN
a.merge(b, on="key", how="left")           # LEFT JOIN
a.merge(b, left_on="k1", right_on="k2")    a.merge(b, on=["k1", "k2"])
a.merge(b, on="key", how="left", indicator=True)   # _merge: left_only
a.merge(b, on="key", validate="many_to_one")       b["key"].is_unique
b.rename(columns={"name": "category"})     suffixes=("_a", "_b")
pd.concat([t1, t2], ignore_index=True)     # UNION ALL
```
