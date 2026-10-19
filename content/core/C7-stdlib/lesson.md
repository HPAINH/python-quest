# Исключения и стандартная библиотека

## Зачем это нужно {#why}

Реальные данные ломают программы: в поле с ценой оказывается «н/д», файл не находится, дата записана в другом формате. Аналитик не может позволить скрипту упасть на 9 999-й строке из 10 000. Исключения позволяют поймать ошибку, обработать её и продолжить.

Вторая половина уровня — стандартная библиотека Python: файлы, `collections`, `datetime`, `itertools` и `math`. Эти модули есть в любой установке Python, и они закрывают половину повседневных задач без pandas. Босс уровня — разбор лога приложения.

## try и except {#exceptions}

Код, который может упасть, оборачивают в `try`. Если внутри возникло исключение указанного типа, выполняется блок `except`, и программа продолжает работу.

```python run
def safe_int(text):
    try:
        return int(text)
    except ValueError:
        return None

print(safe_int("42"), safe_int("н/д"), safe_int(" 7 "))
```

Ловить нужно **конкретный** тип ошибки. Голый `except:` прячет все ошибки подряд, включая опечатки в твоём же коде. Несколько типов перечисляют кортежем, объект ошибки получают через `as`.

```python run
for a, b in [(10, 2), (1, 0), ("5", 1)]:
    try:
        print(a / b)
    except ZeroDivisionError:
        print("делить на ноль нельзя")
    except (TypeError, ValueError) as e:
        print("плохие данные:", type(e).__name__)
```

`else` выполняется, если ошибки не было, а `finally` — всегда, даже после `return`.

## raise {#raise}

Свои ошибки выбрасывают через `raise`. Так функция сообщает, что её вызвали с неправильными данными, вместо того чтобы молча вернуть мусор.

```python run error
def parse_age(text):
    age = int(text)
    if age < 0 or age > 120:
        raise ValueError(f"возраст вне диапазона: {age}")
    return age

print(parse_age("30"))
print(parse_age("250"))
```

Выбирай тип по смыслу: `ValueError` — значение правильного типа, но недопустимое; `TypeError` — не тот тип; `KeyError` — нет ключа. Вызывающий код решает, что делать с ошибкой.

```python run
def parse_age(text):
    age = int(text)
    if age < 0 or age > 120:
        raise ValueError("возраст вне диапазона")
    return age

for t in ["30", "-1", "abc"]:
    try:
        print(parse_age(t))
    except ValueError as e:
        print("пропускаю:", t, "-", e)
```

## Файлы {#files}

Файл открывают через `with open(...)`. Блок `with` сам закроет файл, даже если внутри случится ошибка. Режим `"r"` — чтение, `"w"` — запись с нуля, `"a"` — дописывание.

```python run
with open("sales.txt", "w", encoding="utf-8") as f:
    f.write("1290.50\n990\n\n450\n")

total = 0
with open("sales.txt", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if line:
            total += float(line)
print(total)
```

Цикл `for line in f` читает файл построчно и не загружает его в память целиком. У каждой строки есть символ перевода `\n` в конце — его убирают через `strip()`.

`f.read()` возвращает весь текст строкой, а `f.readlines()` — список строк. В задачах файлы открываются по имени из рабочей папки.

## collections {#collections}

Модуль `collections` содержит словари для частых задач. `Counter` считает частоты, `defaultdict` создаёт значение для нового ключа сам.

```python
from collections import Counter, defaultdict
```

```python run
from collections import Counter, defaultdict

words = "кофе чай кофе сыр кофе чай".split()
freq = Counter(words)
print(freq.most_common(2), freq["мёд"])

by_city = defaultdict(list)
for city, amount in [("Казань", 990), ("Москва", 450), ("Казань", 120)]:
    by_city[city].append(amount)
print(dict(by_city))
```

`Counter` возвращает 0 для отсутствующего ключа, а `most_common(n)` даёт n самых частых пар. `defaultdict(int)` — готовый счётчик, `defaultdict(list)` — готовая группировка: никаких `get` и `setdefault`.

## datetime {#datetime}

Даты хранят объектами `date` и `datetime`, а не строками: так их можно сравнивать, вычитать и форматировать. `strptime` разбирает строку по формату, `strftime` превращает дату обратно в строку.

```python run
from datetime import datetime, timedelta

d = datetime.strptime("17.10.2026", "%d.%m.%Y")
print(d.strftime("%Y-%m-%d"), d.weekday())
print((d + timedelta(days=30)).date())
diff = datetime(2026, 12, 31) - d
print(diff.days)
```

Коды формата: `%Y` — год, `%m` — месяц, `%d` — день, `%H:%M` — время. `weekday()` возвращает 0 для понедельника и 6 для воскресенья. Разность двух дат — `timedelta`, число дней в ней лежит в `.days`.

Если строка не подходит под формат, `strptime` выбрасывает `ValueError`.

## itertools и math {#itertools-math}

`itertools` перебирает комбинации без вложенных циклов. `combinations(items, 2)` даёт все пары без повторов, `product` — все сочетания из нескольких списков.

```python run
from itertools import combinations, product
import math

prices = [450, 990, 1290]
print([a + b for a, b in combinations(prices, 2)])
print(list(product(["S", "M"], ["red", "blue"])))
print(math.sqrt(16), math.ceil(2.1), math.floor(2.9))
print(round(math.dist((0, 0), (3, 4)), 1), math.isclose(0.1 + 0.2, 0.3))
```

`math` хранит математические функции и константы: `math.pi`, `math.sqrt`, `math.radians`, `math.log`. `math.isclose` правильно сравнивает дробные числа, вместо `==`.

## Частые ошибки {#mistakes}

Голый except прячет любую ошибку:

```python wrong
try:
    total = sum(prices) / count
except:
    total = 0
```

```python right
try:
    total = sum(prices) / count
except ZeroDivisionError:
    total = 0
```

Файл без with остаётся открытым при ошибке:

```python wrong
f = open("data.txt")
lines = f.readlines()
```

```python right
with open("data.txt") as f:
    lines = f.readlines()
```

Даты сравниваются как строки:

```python wrong
if "17.10.2026" > "01.12.2025":
    print("позже")
```

```python right
from datetime import datetime
fmt = "%d.%m.%Y"
if datetime.strptime("17.10.2026", fmt) > datetime.strptime("01.12.2025", fmt):
    print("позже")
```

Модуль используют без import:

```python wrong
c = Counter(words)
```

```python right
from collections import Counter
c = Counter(words)
```

## Шпаргалка {#cheatsheet}

```python
try:
    x = int(s)
except ValueError as e:
    x = None
else: ...       # если ошибки не было
finally: ...    # всегда
raise ValueError("сообщение")
with open("f.txt", encoding="utf-8") as f:
    for line in f: line.strip()
from collections import Counter, defaultdict
Counter(xs).most_common(3); defaultdict(list)
from datetime import datetime, date, timedelta
datetime.strptime("17.10.2026", "%d.%m.%Y").strftime("%Y-%m-%d")
(d2 - d1).days; d + timedelta(days=7); d.weekday()
from itertools import combinations, product
import math; math.sqrt(x); math.isclose(a, b)
```
