# Списки и кортежи

## Зачем это нужно {#why}

До этого уровня мы обрабатывали данные на лету и сразу их забывали. Но часто нужно сохранить все значения: посчитать среднее и потом найти, кто выше среднего, отсортировать товары по выручке, убрать дубликаты. Для этого есть списки.

В этом уровне — списки и их методы, сортировка, генераторы списков, кортежи и первые собственные функции: в части задач ответ нужно будет вернуть из функции через `return`. Босс уровня — топ-3 товаров по выручке.

## Списки {#lists}

Список хранит упорядоченный набор значений в квадратных скобках. Индексы и срезы работают как у строк, а `len` даёт длину.

```python run
prices = [990, 1290, 450, 3100]
print(prices[0], prices[-1], prices[1:3], len(prices))
print(sum(prices), max(prices), min(prices))
```

В отличие от строк, список **изменяемый**: элемент можно заменить по индексу. По списку проходят циклом `for`.

```python run
prices = [990, 1290, 450]
prices[2] = 500
for p in prices:
    print(p, "->", p * 0.9)
```

Список из ввода собирают так: `nums = list(map(int, input().split()))`. Здесь `map` переводит каждую часть в число, а `list` превращает результат в список.

```python run stdin="3 -1 5 0"
nums = list(map(int, input().split()))
print(nums, len(nums))
```

## Методы списков {#list-methods}

`append` добавляет элемент в конец, `insert` — на позицию, `pop` удаляет и возвращает элемент, `remove` удаляет первое найденное значение. `index` ищет позицию, `count` считает вхождения.

```python run
cart = ["хлеб", "молоко"]
cart.append("сыр")
cart.insert(0, "кофе")
last = cart.pop()
print(cart, last, cart.index("молоко"))
```

Методы, которые меняют список, возвращают `None`. Поэтому `cart = cart.append(x)` теряет список — пиши просто `cart.append(x)`.

Новый список удобно строить в цикле: начинаем с пустого `[]` и добавляем подходящие элементы.

```python run
nums = [3, -1, 5, 0, -2, 7]
positive = []
for x in nums:
    if x > 0:
        positive.append(x)
print(positive, positive[::-1])
```

## Сортировка {#sorting}

`sorted(xs)` возвращает новый отсортированный список, а `xs.sort()` сортирует сам список на месте. Параметр `reverse=True` сортирует по убыванию.

```python run
nums = [5, 2, 9, 1]
print(sorted(nums), sorted(nums, reverse=True), nums)
nums.sort()
print(nums)
```

Параметр `key` задаёт, по чему сортировать: функция применяется к каждому элементу. `key=len` сортирует слова по длине.

```python run
words = ["pandas", "sql", "python", "ml"]
print(sorted(words, key=len))
print(sorted(words, key=lambda w: (-len(w), w)))
```

`lambda w: ...` — короткая функция в одну строку. Если ключ — кортеж, сортировка идёт по первому полю, а при равенстве — по второму. Минус перед длиной даёт убывание по длине.

## Генераторы списков {#comprehension}

Генератор списка (list comprehension) строит список в одну строку: `[выражение for x in последовательность if условие]`.

```python run
nums = [3, -1, 5, 0, -2, 7]
print([x * x for x in nums])
print([x for x in nums if x > 0])
print([str(x) for x in nums if x % 2 != 0])
```

Это то же самое, что цикл с `append`, только короче. Генератор хорош, когда логика простая. Если внутри нужно несколько шагов, понятнее обычный цикл.

```python run stdin="10 20 30 40"
nums = [int(x) for x in input().split()]
avg = sum(nums) / len(nums)
print(avg, [x for x in nums if x > avg])
```

## Кортежи {#tuples}

Кортеж — неизменяемый список в круглых скобках: `point = (3, 4)`. Его используют для значений, которые всегда идут вместе: координаты, пара «товар — цена».

```python run
point = (3, 4)
x, y = point
print(x, y, point[0])
pairs = [("сыр", 450), ("кофе", 990)]
for name, price in pairs:
    print(name, price)
```

Распаковка `x, y = point` раскладывает кортеж по переменным. Кортежи сравниваются поэлементно, поэтому список кортежей сортируется по первому полю, а при равенстве — по второму.

```python run
items = [(3, "b"), (1, "z"), (3, "a")]
print(sorted(items))
```

## Функции: def и return {#def-basics}

Функция — именованный кусок кода. Она получает аргументы и **возвращает** результат через `return`. Подробно функции разберём в уровне C6, а сейчас нужно только это.

```python run
def average(nums):
    return sum(nums) / len(nums)

print(average([2, 4, 9]))
result = average([10, 20])
print(result * 2)
```

`print` внутри функции только показывает значение, а `return` отдаёт его наружу — в переменную или в проверку. В задачах типа «Функция» проверка вызывает твою функцию и сравнивает то, что она вернула.

```python run
def is_even(n):
    return n % 2 == 0

print(is_even(4), is_even(7))
```

Код после `return` не выполняется: функция сразу завершается.

## Частые ошибки {#mistakes}

Метод списка возвращает None:

```python wrong
nums = nums.sort()
```

```python right
nums.sort()
```

print вместо return:

```python wrong
def double(x):
    print(x * 2)
```

```python right
def double(x):
    return x * 2
```

Удаление из списка во время обхода пропускает элементы:

```python wrong
for x in nums:
    if x < 0:
        nums.remove(x)
```

```python right
nums = [x for x in nums if x >= 0]
```

Переменная с именем встроенной функции:

```python wrong
list = [1, 2, 3]
sum = 0
```

```python right
nums = [1, 2, 3]
total = 0
```

Изменяемое значение по умолчанию:

```python wrong
def add(x, items=[]):
    items.append(x)
    return items
```

```python right
def add(x, items=None):
    if items is None:
        items = []
    items.append(x)
    return items
```

## Шпаргалка {#cheatsheet}

```python
nums = list(map(int, input().split()))
nums[0]  nums[-1]  nums[1:3]  len(nums)
sum(nums)  max(nums)  min(nums)
nums.append(x)  nums.insert(i, x)  nums.pop()  nums.remove(x)
sorted(nums)  sorted(nums, reverse=True)  nums.sort()
sorted(words, key=len)  sorted(items, key=lambda t: (-t[1], t[0]))
[x * 2 for x in nums if x > 0]
point = (3, 4); x, y = point
def f(a, b):
    return a + b
```
