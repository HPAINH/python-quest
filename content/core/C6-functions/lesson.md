# Функции

## Зачем это нужно {#why}

В уровне C4 ты уже писал простые функции с `return`. Здесь разберём их как следует. Функции — способ не повторять код: правило расчёта скидки, очистку телефона или формат цены описывают один раз и вызывают где угодно. В аналитике из функций собирают конвейеры обработки данных, а в pandas их передают в `apply`, `agg` и `sort_values(key=...)`.

В этом уровне — аргументы со значениями по умолчанию и именованные аргументы, возврат нескольких значений, области видимости, `lambda`, `*args` и `**kwargs`, рекурсия. Босс уровня — калькулятор корзины из трёх функций.

## Параметры и аргументы {#params}

Параметры перечисляют в `def`, аргументы передают при вызове. Аргументы можно передавать по позиции или по имени. У параметра может быть значение по умолчанию — тогда аргумент необязателен.

```python run
def discount(price, percent=10):
    return price * (100 - percent) / 100

print(discount(1000))
print(discount(1000, 25))
print(discount(percent=5, price=200))
```

Параметры со значением по умолчанию идут после обязательных. Всё, что стоит после `*`, можно передать **только по имени**: так вызов читается однозначно.

```python run
def fmt(amount, *, currency="₽", decimals=2):
    return f"{amount:,.{decimals}f} {currency}".replace(",", " ")

print(fmt(1290.5))
print(fmt(99, decimals=0, currency="$"))
```

## return {#return}

`return` отдаёт значение и сразу завершает функцию. Функция без `return` возвращает `None`. Несколько значений через запятую возвращаются кортежем, его удобно распаковать.

```python run
def min_max(nums):
    if not nums:
        return None
    return min(nums), max(nums)

lo, hi = min_max([4, 9, 1])
print(lo, hi, min_max([]))
```

`return` в середине функции — обычный приём: сначала обрабатывают особые случаи и выходят, а основной расчёт пишут без лишней вложенности.

```python run
def grade(score):
    if score < 0 or score > 100:
        return "ошибка"
    if score >= 90:
        return "отлично"
    return "не отлично"

print(grade(95), grade(150), grade(40))
```

## Области видимости {#scope}

Переменные, созданные внутри функции, **локальные**: они живут только во время вызова и не видны снаружи. Функция может читать глобальные переменные, но присваивание внутри создаёт новую локальную.

```python run error
rate = 0.2

def tax(amount):
    total = amount * rate
    return total

print(tax(1000))
print(total)
```

Хорошая функция получает всё нужное через параметры и отдаёт результат через `return`, а не меняет глобальные переменные. Если вложенной функции нужно изменить переменную внешней функции, её объявляют `nonlocal`.

```python run
def make_counter():
    count = 0
    def step():
        nonlocal count
        count += 1
        return count
    return step

c = make_counter()
print(c(), c(), c())
```

## lambda и функции как значения {#lambda}

Функцию можно положить в переменную, передать в другую функцию и вернуть из функции. `lambda` создаёт короткую безымянную функцию в одно выражение.

```python run
items = [("сыр", 1290), ("чай", 450), ("кофе", 990)]
print(sorted(items, key=lambda it: it[1]))
print(max(items, key=lambda it: it[1])[0])
double = lambda x: x * 2
print(list(map(double, [1, 2, 3])))
```

`lambda` хороша для `key=` и коротких преобразований. Если логика длиннее одного выражения, пиши обычную функцию с понятным именем.

```python run
def apply_all(funcs, x):
    return [f(x) for f in funcs]

print(apply_all([abs, str, lambda v: v ** 2], -3))
```

## *args и **kwargs {#args-kwargs}

`*args` собирает лишние позиционные аргументы в кортеж, `**kwargs` — лишние именованные в словарь. Так пишут функции с произвольным числом аргументов.

```python run
def total(*nums):
    return sum(nums)

def describe(name, **info):
    parts = [f"{k}={v}" for k, v in sorted(info.items())]
    return name + ": " + ", ".join(parts)

print(total(), total(1, 2, 3))
print(describe("заказ", city="Казань", amount=990))
```

Звёздочки работают и при вызове: `*` раскладывает список в позиционные аргументы, `**` — словарь в именованные.

```python run
nums = [3, 7, 1]
opts = {"currency": "₽", "decimals": 0}
print(max(*nums))
print("{amount} {currency}".format(amount=990, **opts))
```

## Рекурсия {#recursion}

Рекурсивная функция вызывает сама себя на более простой версии задачи. В ней обязательно есть **базовый случай**, на котором вызовы прекращаются.

```python run
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

print(factorial(5))
```

Рекурсия удобна для вложенных структур: списков в списках, деревьев категорий, JSON. Каждый уровень вложенности обрабатывает тот же код.

```python run
def depth(x):
    if not isinstance(x, list):
        return 0
    return 1 + max((depth(i) for i in x), default=0)

print(depth([1, [2, [3, 4]], 5]))
```

Наивная рекурсия бывает очень медленной: `fib(n - 1) + fib(n - 2)` пересчитывает одно и то же миллионы раз. Там, где можно, используй цикл.

## Частые ошибки {#mistakes}

print вместо return:

```python wrong
def area(w, h):
    print(w * h)
```

```python right
def area(w, h):
    return w * h
```

Изменяемое значение по умолчанию копится между вызовами:

```python wrong
def add_tag(tag, tags=[]):
    tags.append(tag)
    return tags
```

```python right
def add_tag(tag, tags=None):
    if tags is None:
        tags = []
    tags.append(tag)
    return tags
```

Вызов без скобок возвращает саму функцию, а не результат:

```python wrong
total = sum_prices
```

```python right
total = sum_prices(prices)
```

Рекурсия без базового случая не останавливается:

```python wrong
def countdown(n):
    print(n)
    countdown(n - 1)
```

```python right
def countdown(n):
    if n < 0:
        return
    print(n)
    countdown(n - 1)
```

## Шпаргалка {#cheatsheet}

```python
def f(a, b=10, *, c=0):        # c — только по имени
    return a + b + c
f(1); f(1, 2); f(1, c=5)
def g(): return 1, 2           # кортеж
x, y = g()
lambda x: x * 2
sorted(items, key=lambda t: (-t[1], t[0]))
def h(*args, **kwargs): ...    # кортеж и словарь
h(*[1, 2], **{"k": 3})
nonlocal count                 # переменная внешней функции
def rec(n):
    if n == 0: return 0        # базовый случай
    return n + rec(n - 1)
```
