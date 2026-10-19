# Строки

## Зачем это нужно {#why}

Большая часть сырых данных — текст: имена клиентов, адреса, письма, строки логов, коды товаров. Прежде чем считать, текст приходится чистить, резать на части и проверять.

В этом уровне ты научишься доставать символы по индексу, вырезать куски срезами, пользоваться методами строк, делить строку на слова и собирать обратно. Босс уровня — разобрать строки лога ShopData и посчитать покупки.

## Индексы {#indexes}

Строка — последовательность символов. Каждый символ имеет индекс, счёт идёт с нуля. Отрицательный индекс считает с конца: `-1` — последний символ.

```python run
s = "Python"
print(s[0], s[1], s[-1], s[-2])
print(len(s))
```

Последний индекс равен `len(s) - 1`. Обращение за пределы строки даёт `IndexError`.

Строки **неизменяемы**: `s[0] = "J"` вызовет ошибку. Чтобы «изменить» строку, собирают новую.

```python run
s = "python"
s = s[0].upper() + s[1:]
print(s)
```

Оператор `in` проверяет, есть ли подстрока внутри строки: `"th" in "Python"` — `True`.

## Срезы {#slices}

Срез `s[start:stop:step]` вырезает часть строки. `stop` не включается — как в `range`. Любую часть можно опустить: тогда берётся начало, конец или шаг 1.

```python run
s = "ShopData"
print(s[0:4], s[4:], s[:4], s[-4:])
print(s[::2], s[::-1])
```

`s[::-1]` — строка задом наперёд. Срезы никогда не выходят за границы: `s[2:100]` просто вернёт хвост строки без ошибки.

```python run
code = "SKU-2026-00417"
print(code[4:8], code[-5:])
print(code[100:], "|")
```

Палиндром — строка, которая читается одинаково в обе стороны. Проверить это легко: `s == s[::-1]`.

## Методы строк {#methods}

Метод вызывается через точку и возвращает **новую** строку, не меняя исходную.

```python run
s = "  Hello, World  "
print(s.strip(), s.lower(), s.upper(), sep="|")
print(s.strip().replace("World", "ShopData"))
```

Полезные проверки и поиск: `count` считает вхождения, `find` возвращает индекс или `-1`, `startswith` и `endswith` проверяют начало и конец.

```python run
email = "anna.k@shop.ru"
print(email.count("a"), email.find("@"), email.find("#"))
print(email.endswith(".ru"), "7".isdigit(), "Ab".isalpha())
```

Методы `isdigit`, `isalpha`, `isupper`, `islower` возвращают `True` или `False` и удобны для проверки символов по одному.

## split и join {#split-join}

`split()` делит строку по пробелам и возвращает список частей. С аргументом делит по указанному разделителю. Обратная операция — `join`: разделитель соединяет части.

```python run
line = "2026-10-17 | user=482 | event=purchase"
parts = line.split(" | ")
print(parts)
print(parts[2].split("="))
```

Количество слов — это длина результата `split()`. Несколько пробелов подряд `split()` без аргумента считает одним.

```python run
words = "  мама   мыла раму ".split()
print(len(words), words)
print("-".join(words))
print(", ".join(["a", "b", "c"]))
```

`join` склеивает только строки: числа сначала переводят через `str`.

## Обход строки {#iterate}

Цикл `for` проходит по строке символ за символом. Так считают буквы определённого вида или собирают новую строку.

```python run
s = "Data Science 2026"
digits = 0
caps = ""
for ch in s:
    if ch.isdigit():
        digits += 1
    if ch.isupper():
        caps += ch
print(digits, caps)
```

Если нужен ещё и номер символа, пройди по индексам: `for i in range(len(s))`. Тогда доступны и `s[i]`, и соседний `s[i + 1]`.

```python run
s = "aaabccdd"
pairs = 0
for i in range(len(s) - 1):
    if s[i] == s[i + 1]:
        pairs += 1
print(pairs)
```

Граница `len(s) - 1` нужна, чтобы `s[i + 1]` не вышел за конец строки.

## Частые ошибки {#mistakes}

Попытка изменить символ строки:

```python wrong
s = "cat"
s[0] = "b"
```

```python right
s = "cat"
s = "b" + s[1:]
```

Метод не меняет строку, результат потерян:

```python wrong
name = "  anna "
name.strip()
print(name)
```

```python right
name = "  anna "
name = name.strip()
print(name)
```

Выход за конец строки при сравнении соседей:

```python wrong
for i in range(len(s)):
    if s[i] == s[i + 1]:
        print(i)
```

```python right
for i in range(len(s) - 1):
    if s[i] == s[i + 1]:
        print(i)
```

join со списком чисел:

```python wrong
print(" ".join([1, 2, 3]))
```

```python right
print(" ".join(["1", "2", "3"]))
```

## Шпаргалка {#cheatsheet}

```python
s[0]  s[-1]  len(s)          # символ, последний, длина
s[a:b]  s[:3]  s[-3:]  s[::-1]
s.lower()  s.upper()  s.strip()  s.replace(a, b)
s.count(x)  s.find(x)  x in s
s.startswith(x)  s.endswith(x)
ch.isdigit()  ch.isalpha()  ch.isupper()
s.split()  s.split(",")      # строка -> список
" ".join(parts)              # список -> строка
for ch in s: ...
for i in range(len(s)): ...
```
