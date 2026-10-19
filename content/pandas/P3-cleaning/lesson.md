# Очистка данных

## Зачем это нужно {#why}

Аналитики шутят, что 80% работы — чистка данных, и это почти правда. Выгрузки из старых систем приходят с пропусками, дубликатами, суммами текстом «1 290,50 ₽», датами в трёх форматах и городами вроде «  москва» и «МОСКВА». Любой расчёт на таких данных неверен, пока их не привели в порядок.

В этом уровне работаем с двумя грязными выгрузками ShopData — `customers_raw.csv` и `orders_raw.csv` (их описание на экране «Данные»). Разберём пропуски, типы, дубликаты, строковые методы `.str` и даты `.dt`. Босс — полная очистка выгрузки заказов.

## Пропуски {#missing}

Пропуск в pandas — `NaN`. Его находят через `isna()`, заполняют через `fillna()` и удаляют через `dropna()`. Агрегаты `sum`, `mean`, `count` пропуски пропускают.

```python run
import pandas as pd

customers = pd.read_csv("customers.csv")
print(customers.isna().sum())
filled = customers["city"].fillna("не указан")
print(filled.value_counts().tail(3))
known = customers.dropna(subset=["birth_year"])
print(len(customers), len(known))
```

`dropna()` без аргументов удаляет строку, если пропуск в **любой** колонке. Обычно нужен `subset=[...]` — список колонок, где пропуск недопустим. Заполнять можно константой, средним или медианой: `s.fillna(s.median())`.

Решение «удалить или заполнить» зависит от смысла: пустой промокод — это «без промокода», а не ошибка, а пустая сумма заказа — ошибка.

## Типы {#types}

Число, записанное как текст, нельзя сложить или сравнить с числом. `astype` переводит колонку в другой тип, а `pd.to_numeric` делает то же для чисел и с `errors="coerce"` превращает неразборчивые значения в `NaN`.

```python run
import pandas as pd

raw = pd.read_csv("customers_raw.csv")
print(raw["birth_year"].head(4).tolist(), raw["birth_year"].dtype)
year = pd.to_numeric(raw["birth_year"], errors="coerce")
print(year.isna().sum(), year.dtype)
print(year.astype("Int64").head(4).tolist())
```

Тип `Int64` с заглавной буквы — целые числа, допускающие пропуск. Обычный `int64` пропусков не допускает, поэтому колонка с `NaN` становится `float64`. Перед переводом текст часто чистят: убирают пробелы и знак валюты, меняют запятую на точку.

## Дубликаты {#duplicates}

Полностью одинаковые строки находит `duplicated()`, а удаляет `drop_duplicates()`. С `subset` дубликатом считается совпадение только по указанным колонкам.

```python run
import pandas as pd

raw = pd.read_csv("orders_raw.csv")
print(len(raw), raw.duplicated().sum())
print(raw["order_id"].duplicated().sum())
clean = raw.drop_duplicates()
print(len(clean), clean["order_id"].is_unique)
```

`keep="first"` (по умолчанию) оставляет первое вхождение, `keep="last"` — последнее. Перед удалением полезно понять, откуда дубликаты: двойная выгрузка — удаляем, два разных заказа с одним номером — разбираемся.

## Строки: .str {#str}

У текстовой колонки есть набор методов `.str`, которые работают для каждой строки сразу: `strip`, `lower`, `upper`, `title`, `replace`, `contains`, `startswith`, `len`, `split`.

```python run
import pandas as pd

raw = pd.read_csv("customers_raw.csv")
city = raw["city"].str.strip().str.lower()
print(raw["city"].nunique(), city.nunique())
email = raw["email"].str.strip().str.lower()
print(email.str.split("@").str[1].value_counts().head(3))
raw[raw["name"].str.contains("ова", na=False)]["name"].head(3)
```

Методы `.str` пропускают `NaN` и возвращают `NaN`. Для фильтра через `contains` пишут `na=False`, иначе пропуски сломают маску. `str.replace` по умолчанию меняет подстроку буквально, а с `regex=True` понимает регулярные выражения.

## Даты: to_datetime и .dt {#dates}

Даты превращают из текста в настоящие даты через `pd.to_datetime`. Если форматы смешаны, помогает `format="mixed"`, а `dayfirst=True` подсказывает, что «04.03.2025» — это 4 марта. Части даты достаёт `.dt`.

```python run
import pandas as pd

raw = pd.read_csv("orders_raw.csv")
print(raw["order_date"].head(4).tolist())
d = pd.to_datetime(raw["order_date"], format="mixed", dayfirst=True)
print(d.head(4).dt.strftime("%Y-%m-%d").tolist())
print(d.dt.month.value_counts().sort_index().head(3).tolist())
print(d.dt.day_name().head(2).tolist(), (d.max() - d.min()).days)
```

`.dt.year`, `.dt.month`, `.dt.day`, `.dt.dayofweek` (0 — понедельник), `.dt.to_period("M")` — месяц целиком. Разность дат — `Timedelta`, число дней в ней — `.days` или `.dt.days` для колонки.

## Частые ошибки {#mistakes}

Перевод в число без очистки текста:

```python wrong
raw["amount"].astype(float)
```

```python right
clean = raw["amount"].str.replace("₽", "").str.replace(" ", "").str.replace(",", ".")
pd.to_numeric(clean, errors="coerce")
```

dropna без subset удаляет лишнее:

```python wrong
customers = customers.dropna()
```

```python right
customers = customers.dropna(subset=["birth_year"])
```

contains без na=False на колонке с пропусками:

```python wrong
raw[raw["city"].str.contains("моск")]
```

```python right
raw[raw["city"].str.contains("моск", case=False, na=False)]
```

Метод очистки без присваивания:

```python wrong
raw["city"].str.strip()
```

```python right
raw["city"] = raw["city"].str.strip()
```

## Шпаргалка {#cheatsheet}

```python
df.isna().sum()  s.fillna("нет")  s.fillna(s.median())
df.dropna(subset=["a"])
pd.to_numeric(s, errors="coerce")  s.astype(float)  s.astype("Int64")
df.duplicated().sum()  df.drop_duplicates()  df.drop_duplicates(subset=["id"])
s.str.strip()  .str.lower()  .str.title()  .str.replace(",", ".")
s.str.contains("x", case=False, na=False)  s.str.split("@").str[1]
pd.to_datetime(s, format="mixed", dayfirst=True)
d.dt.year  d.dt.month  d.dt.dayofweek  d.dt.to_period("M")
d.dt.strftime("%Y-%m-%d")  (d2 - d1).dt.days
```
