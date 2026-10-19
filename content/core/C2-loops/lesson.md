# Циклы

## Зачем это нужно {#why}

Аналитик редко работает с одним числом. Выручка за каждый день месяца, оценки сотен клиентов, тысячи строк лога — всё это обрабатывается в цикле: одно и то же действие повторяется для каждого значения.

В этом уровне — цикл `for` с `range`, накопление сумм и счётчиков, цикл `while`, досрочный выход через `break` и вложенные циклы. Босс уровня — найти лучший и худший день продаж и самую длинную серию роста.

## for и range {#for-range}

`for` повторяет блок для каждого значения последовательности. `range(n)` даёт числа от 0 до `n - 1`, `range(a, b)` — от `a` до `b - 1`, `range(a, b, step)` — с шагом.

```python run
for i in range(3):
    print("шаг", i)
for i in range(2, 11, 4):
    print(i)
```

Правая граница `range` **не включается**. Чтобы пройти от 1 до `n` включительно, пиши `range(1, n + 1)`.

```python run stdin="5"
n = int(input())
for i in range(1, n + 1):
    print(i, i * i)
```

Шаг может быть отрицательным: `range(10, 0, -1)` — обратный отсчёт от 10 до 1.

## Накопители и счётчики {#accumulators}

Сумма, количество, произведение считаются одним приёмом: заводим переменную **до** цикла и обновляем её **внутри**.

```python run stdin="4\n10\n25\n7\n3"
n = int(input())
total = 0
count_big = 0
for i in range(n):
    x = int(input())
    total += x
    if x > 9:
        count_big += 1
print(total, count_big)
```

Для произведения начальное значение 1, а не 0. Для поиска максимума удобно взять первое значение как стартовое и сравнивать с ним остальные.

```python run stdin="3\n-5\n-2\n-9"
n = int(input())
best = int(input())
for i in range(n - 1):
    x = int(input())
    if x > best:
        best = x
print(best)
```

Если начать максимум с нуля, на одних отрицательных числах ответ будет неверным.

## Цикл while {#while}

`while` повторяет блок, пока условие истинно. Он нужен, когда заранее неизвестно, сколько будет шагов: читать числа до нуля, делить, пока число не кончится.

```python run
n = 4721
digits = 0
while n > 0:
    n //= 10
    digits += 1
print(digits)
```

Внутри цикла что-то обязано менять условие. Если забыть `n //= 10`, условие никогда не станет ложным, и программа зависнет — это бесконечный цикл.

```python run stdin="5\n8\n0"
total = 0
x = int(input())
while x != 0:
    total += x
    x = int(input())
print(total)
```

Здесь первое число читается до цикла, а следующее — в конце каждого шага.

## break и continue {#break-continue}

`break` немедленно завершает цикл. `continue` пропускает остаток текущего шага и переходит к следующему.

```python run
for i in range(1, 10):
    if i % 2 == 0:
        continue
    if i > 7:
        break
    print(i)
```

С `break` удобно искать: как только нашли, дальше проверять не нужно. Проверка числа на простоту — классический пример.

```python run stdin="91"
n = int(input())
is_prime = n > 1
d = 2
while d * d <= n:
    if n % d == 0:
        is_prime = False
        break
    d += 1
print(is_prime)
```

Делители достаточно проверять до корня из `n`: если у числа есть делитель больше корня, то парный ему меньше корня.

## Вложенные циклы {#nested-loops}

Внутри цикла может быть ещё один цикл. Внутренний проходит полностью на каждом шаге внешнего: для таблицы 3 на 4 тело выполнится 12 раз.

```python run
for row in range(1, 4):
    for col in range(1, 5):
        print(row * col, end=" ")
    print()
```

`print()` без аргументов печатает перевод строки — им заканчивают ряд. Строку можно повторить умножением, это часто проще внутреннего цикла.

```python run stdin="4"
n = int(input())
for i in range(1, n + 1):
    print("*" * i)
```

## Частые ошибки {#mistakes}

Граница `range` не включается:

```python wrong
for i in range(1, n):
    total += i
```

```python right
for i in range(1, n + 1):
    total += i
```

Сумма обнуляется на каждом шаге:

```python wrong
for i in range(n):
    total = 0
    total += int(input())
```

```python right
total = 0
for i in range(n):
    total += int(input())
```

Бесконечный цикл — переменная условия не меняется:

```python wrong
i = 1
while i <= n:
    total += i
```

```python right
i = 1
while i <= n:
    total += i
    i += 1
```

Максимум начинается с нуля:

```python wrong
best = 0
for i in range(n):
    best = max(best, int(input()))
```

```python right
best = int(input())
for i in range(n - 1):
    best = max(best, int(input()))
```

## Шпаргалка {#cheatsheet}

```python
for i in range(n): ...            # 0 .. n-1
for i in range(1, n + 1): ...     # 1 .. n
for i in range(10, 0, -1): ...    # 10 .. 1
total = 0; total += x             # сумма
count = 0; count += 1             # счётчик
while cond:                       # пока условие истинно
    ...
break      # выйти из цикла
continue   # к следующему шагу
print(x, end=" ")   # без перевода строки
print()             # перевод строки
"*" * 5             # *****
```
