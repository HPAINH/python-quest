# Словари и множества

## Зачем это нужно {#why}

Аналитику постоянно нужно группировать: выручка по категориям, число заказов по клиентам, частота слов в отзывах. Списком это делать неудобно — нужна связь «ключ → значение». Её дают словари.

Множества отвечают на другие вопросы: сколько уникальных клиентов, кто покупал в обоих месяцах, какие товары есть только в одном каталоге.

Этот уровень — мост к pandas: `groupby`, `value_counts` и `merge` делают то же самое, что ты напишешь здесь вручную. Босс уровня — отчёт по корзинам ShopData.

## Словари {#dicts}

Словарь хранит пары «ключ: значение» в фигурных скобках. Значение достают по ключу, а не по номеру. Ключи уникальны, обычно это строки или числа.

```python run
prices = {"кофе": 990, "чай": 450}
print(prices["кофе"])
prices["сыр"] = 1290
prices["чай"] = 490
print(prices, len(prices))
```

Присваивание по новому ключу добавляет пару, по существующему — заменяет значение. Проверка `in` ищет среди ключей.

```python run
stock = {"кофе": 12, "чай": 0}
print("кофе" in stock, "мёд" in stock)
for name in stock:
    print(name, stock[name])
```

Обращение к несуществующему ключу `stock["мёд"]` вызывает `KeyError`. Как этого избежать — в следующем разделе.

## Методы словарей {#dict-methods}

`get(key, default)` возвращает значение или `default`, если ключа нет — без ошибки. `keys()`, `values()` и `items()` дают ключи, значения и пары.

```python run
stock = {"кофе": 12, "чай": 0}
print(stock.get("мёд", 0), stock.get("кофе", 0))
for name, qty in stock.items():
    print(f"{name}: {qty} шт.")
print(sum(stock.values()), list(stock.keys()))
```

`pop(key)` удаляет пару и возвращает значение. Словарь помнит порядок добавления, а отсортировать его можно через `sorted`.

```python run
revenue = {"чай": 4500, "кофе": 11880, "сыр": 5162}
for name, rev in sorted(revenue.items(), key=lambda p: -p[1]):
    print(name, rev)
```

`sorted(d.items(), ...)` даёт список пар, его удобно сортировать по значению.

## Подсчёт частот {#counting}

Главный приём со словарём — счётчик. Для каждого элемента увеличиваем значение по его ключу, а для нового ключа начинаем с нуля.

```python run
words = "кофе чай кофе сыр кофе чай".split()
freq = {}
for w in words:
    freq[w] = freq.get(w, 0) + 1
print(freq)
```

`freq.get(w, 0) + 1` работает и для первого появления слова, и для повторных. Тот же приём суммирует значения по группам.

```python run
orders = [("кофе", 990), ("чай", 450), ("кофе", 1290)]
by_name = {}
for name, amount in orders:
    by_name[name] = by_name.get(name, 0) + amount
print(by_name)
```

Самый частый элемент — ключ с наибольшим значением: `max(freq, key=freq.get)`.

## Множества {#sets}

Множество хранит только уникальные значения без порядка. Его создают через `set()` или фигурные скобки со значениями.

```python run
ids = [5, 3, 5, 1, 3]
unique = set(ids)
print(unique, len(unique), 3 in unique)
```

Проверка `in` по множеству работает быстро даже на миллионе элементов. Операции над множествами отвечают на вопросы о пересечениях групп.

```python run
september = {1, 2, 3, 4}
october = {3, 4, 5}
print(september & october)
print(september | october)
print(september - october)
print(september ^ october)
```

`&` — пересечение (покупали оба месяца), `|` — объединение, `-` — разность (ушли после сентября), `^` — только в одном из двух. Результат без порядка, поэтому для вывода его сортируют: `sorted(september & october)`.

## Вложенные структуры {#nested}

Значением словаря может быть список или другой словарь. Так хранят все оценки студента или все покупки клиента.

```python run
grades = {}
for name, g in [("Аня", 5), ("Борис", 4), ("Аня", 3)]:
    if name not in grades:
        grades[name] = []
    grades[name].append(g)
print(grades)
for name in sorted(grades):
    print(name, sum(grades[name]) / len(grades[name]))
```

Сначала создаём пустой список для нового ключа, потом добавляем в него. Короче то же делает `grades.setdefault(name, []).append(g)`.

```python run
user = {"id": 482, "orders": [{"sum": 990}, {"sum": 1290}]}
print(user["orders"][1]["sum"])
print(sum(o["sum"] for o in user["orders"]))
```

## Частые ошибки {#mistakes}

KeyError при подсчёте:

```python wrong
freq = {}
for w in words:
    freq[w] += 1
```

```python right
freq = {}
for w in words:
    freq[w] = freq.get(w, 0) + 1
```

Пустые фигурные скобки — это словарь, а не множество:

```python wrong
seen = {}
seen.add(5)
```

```python right
seen = set()
seen.add(5)
```

Список как ключ словаря:

```python wrong
d = {[1, 2]: "точка"}
```

```python right
d = {(1, 2): "точка"}
```

Ожидание порядка у множества:

```python wrong
print(set([3, 1, 2]))
```

```python right
print(sorted(set([3, 1, 2])))
```

## Шпаргалка {#cheatsheet}

```python
d = {"a": 1}; d["b"] = 2; d.get("x", 0); "a" in d
d.keys()  d.values()  d.items()  d.pop("a")
for k, v in d.items(): ...
freq[x] = freq.get(x, 0) + 1         # счётчик
max(freq, key=freq.get)              # самый частый
sorted(d.items(), key=lambda p: -p[1])
d.setdefault(k, []).append(v)        # группировка
s = set(); s.add(x); len(s); x in s
a & b   a | b   a - b   a ^ b
```
