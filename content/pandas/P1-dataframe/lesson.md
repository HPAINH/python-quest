# Series и DataFrame

## Зачем это нужно {#why}

pandas — главный инструмент аналитика на Python. Он читает таблицы из CSV, Excel и баз данных, фильтрует, группирует и соединяет их — всё то, что ты делал в SQL Quest запросами, только в коде. Под капотом каждая колонка — массив NumPy, поэтому всё из треков ядра и NumPy здесь пригодится.

Во всех уровнях pandas работаем с данными магазина ShopData: заказы, клиенты, товары. Схема таблиц — на экране «Данные». Ответ, как и в NumPy, записывается в `result`, а проверка запускает код ещё и на скрытых данных: в них больше строк, другие города и категории. В этом уровне — Series, DataFrame, чтение CSV и первый осмотр таблицы.

## Series {#series}

Series — одна колонка: массив значений с подписями-индексом. Арифметика, сравнения и агрегаты работают поэлементно, как в NumPy.

```python run
import pandas as pd

prices = pd.Series([450, 990, 1290], index=["чай", "кофе", "сыр"], name="price")
print(prices)
print(prices["кофе"], prices.mean(), prices.max())
print(prices * 1.2)
```

Индекс — подписи строк. По умолчанию это номера 0, 1, 2…, но подписями могут быть и названия, и даты. Почти все методы NumPy есть и у Series: `sum`, `mean`, `min`, `max`, `std`, `round`.

## DataFrame {#dataframe}

DataFrame — таблица: несколько Series с общим индексом. Колонку выбирают по имени в квадратных скобках и получают Series, а список имён возвращает DataFrame из этих колонок.

```python run
import pandas as pd

df = pd.DataFrame({
    "product": ["чай", "кофе", "сыр"],
    "price": [450, 990, 1290],
    "qty": [2, 1, 3],
})
print(df["price"].sum())
df["total"] = df["price"] * df["qty"]
df[["product", "total"]]
```

Новая колонка создаётся присваиванием по имени — значение считается для всех строк сразу. Запись `df.price` тоже работает, но не подходит для имён с пробелами и имён, совпадающих с методами (`count`, `size`). Надёжнее квадратные скобки.

В уроках последняя строка ячейки показывает таблицу, как в Jupyter.

## Чтение CSV {#read-csv}

`pd.read_csv` читает CSV-файл в DataFrame. Типы колонок pandas определяет сам: числа становятся `int64` или `float64`, текст — `str`. Пустые ячейки превращаются в `NaN` — «нет значения».

```python run
import pandas as pd

orders = pd.read_csv("orders.csv")
print(orders.shape)
print(orders.dtypes)
orders.head(3)
```

`shape` — пара (строки, колонки). `head(n)` и `tail(n)` показывают первые и последние строки, `columns` — список колонок. Даты в CSV читаются как текст: превращать их в даты будем в уровне P3.

Полезные параметры: `sep=";"` — другой разделитель, `usecols=[...]` — прочитать только нужные колонки, `parse_dates=[...]` — сразу разобрать даты.

## Первый осмотр таблицы {#explore}

Перед анализом таблицу осматривают: сколько строк, какие типы, где пропуски, какие значения встречаются.

```python run
import pandas as pd

orders = pd.read_csv("orders.csv")
print(orders["status"].value_counts())
print(orders["channel"].value_counts(normalize=True).round(3))
print(orders["customer_id"].nunique(), orders["promo_code"].isna().sum())
orders["amount"].describe().round(1)
```

`value_counts()` считает частоты значений, а с `normalize=True` — доли. `nunique()` — число разных значений, `unique()` — сами значения. `isna()` отмечает пропуски, а `isna().sum()` считает их по каждой колонке. `describe()` даёт сводку: количество, среднее, разброс, квартили.

`info()` печатает типы и число непустых значений в одной таблице.

## Частые ошибки {#mistakes}

Круглые скобки вместо квадратных:

```python wrong
orders("amount").mean()
```

```python right
orders["amount"].mean()
```

Одна пара скобок для нескольких колонок:

```python wrong
orders["order_id", "amount"]
```

```python right
orders[["order_id", "amount"]]
```

Метод без скобок возвращает сам метод, а не результат:

```python wrong
result = orders["amount"].mean
```

```python right
result = orders["amount"].mean()
```

Колонка с другим регистром:

```python wrong
orders["Amount"]
```

```python right
orders["amount"]
```

## Шпаргалка {#cheatsheet}

```python
import pandas as pd
df = pd.read_csv("orders.csv")
df.shape  df.columns  df.dtypes  df.head(5)  df.tail(3)  df.info()
df["amount"]                 # Series
df[["order_id", "amount"]]   # DataFrame
df["total"] = df["price"] * df["qty"]
s.sum()  s.mean()  s.max()  s.round(2)
s.value_counts()  s.value_counts(normalize=True)
s.nunique()  s.unique()
df.isna().sum()  s.describe()
pd.Series([1, 2], index=["a", "b"])
pd.DataFrame({"a": [1, 2], "b": [3, 4]})
```
