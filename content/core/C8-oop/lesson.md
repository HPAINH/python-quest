# ООП

## Зачем это нужно {#why}

Ты уже пользуешься объектами каждый день: строка, список, DataFrame. У них есть данные и методы — `s.upper()`, `df.groupby()`. Классы позволяют создавать свои такие объекты: «корзина» со списком товаров и методом `total()`, «счёт» с балансом и методом `withdraw()`.

Аналитику и ML-специалисту классы нужны, чтобы читать чужой код. Модели в scikit-learn — это классы с методами `fit` и `predict`, а нейросети в уровне D собираются из классов-слоёв. В этом уровне — классы, методы, специальные методы, `dataclass` и наследование. Босс — корзина ShopData.

## Классы и объекты {#classes}

Класс — шаблон, объект — экземпляр, созданный по шаблону. Метод `__init__` вызывается при создании объекта и заполняет его **атрибуты** — данные, которые хранит каждый объект.

```python run
class Product:
    def __init__(self, name, price):
        self.name = name
        self.price = price

tea = Product("Чай", 450)
coffee = Product("Кофе", 990)
print(tea.name, tea.price, coffee.price)
tea.price = 490
print(tea.price)
```

`self` — сам создаваемый объект. Запись `self.price = price` сохраняет значение внутри объекта. У каждого объекта свои атрибуты: изменение `tea.price` не влияет на `coffee`.

Атрибут, объявленный прямо в теле класса, общий для всех объектов. Его используют для констант, а изменяемые данные кладут в `__init__`.

## Методы {#methods}

Метод — функция внутри класса. Первый параметр всегда `self`: через него метод читает и меняет атрибуты своего объекта.

```python run
class Account:
    def __init__(self, owner, balance=0):
        self.owner = owner
        self.balance = balance

    def deposit(self, amount):
        if amount <= 0:
            raise ValueError("сумма должна быть больше нуля")
        self.balance += amount
        return self.balance

acc = Account("Аня")
acc.deposit(1000)
print(acc.deposit(250), acc.balance)
```

При вызове `acc.deposit(250)` Python сам подставляет `acc` в `self`, поэтому передаётся один аргумент. Метод может вернуть значение, изменить объект или сделать и то и другое.

## Специальные методы {#dunder}

Методы с двойными подчёркиваниями Python вызывает сам. `__str__` задаёт текст для `print` и `str()`, `__repr__` — вид объекта в списках и отладке, `__eq__` — сравнение `==`, `__lt__` — сравнение `<`, а значит и сортировку.

```python run
class Money:
    def __init__(self, amount):
        self.amount = amount

    def __str__(self):
        return f"{self.amount:,.2f} ₽".replace(",", " ")

    def __eq__(self, other):
        return self.amount == other.amount

    def __lt__(self, other):
        return self.amount < other.amount

prices = [Money(990), Money(45.5), Money(1290)]
print(min(prices), str(max(prices)))
print(Money(5) == Money(5))
```

Без `__eq__` два объекта с одинаковыми данными не равны: `==` сравнит, тот ли это самый объект. `__len__` позволяет вызывать `len(obj)`.

## dataclass {#dataclass}

Классы, которые в основном хранят данные, удобно объявлять через `@dataclass`. Он сам пишет `__init__`, `__repr__` и `__eq__` по списку полей.

```python run
from dataclasses import dataclass, field

@dataclass
class Item:
    name: str
    price: float
    qty: int = 1
    tags: list = field(default_factory=list)

    def total(self):
        return self.price * self.qty

a = Item("Чай", 450, 2)
print(a, a.total())
print(a == Item("Чай", 450, 2))
```

Поля перечисляют с аннотацией типа. Поле со значением по умолчанию идёт после обязательных. Для изменяемых значений по умолчанию нужен `field(default_factory=list)` — по той же причине, что и в функциях.

`@dataclass(order=True)` добавляет сравнение `<` по полям в порядке объявления.

## Наследование {#inheritance}

Класс может наследовать другой: дочерний класс получает все атрибуты и методы родителя и может переопределить нужные. `super()` вызывает метод родителя.

```python run
class Shape:
    def area(self):
        raise NotImplementedError

    def describe(self):
        return f"{type(self).__name__}: {self.area():.2f}"

class Rect(Shape):
    def __init__(self, w, h):
        self.w, self.h = w, h

    def area(self):
        return self.w * self.h

class Square(Rect):
    def __init__(self, side):
        super().__init__(side, side)

for s in [Rect(2, 3), Square(4)]:
    print(s.describe())
print(isinstance(Square(1), Rect))
```

`describe` написан один раз в `Shape`, но работает для всех фигур: он вызывает `area()` конкретного класса. Так устроены модели scikit-learn: у всех есть `fit` и `predict`, а внутри каждый класс считает по-своему.

## Частые ошибки {#mistakes}

Метод без self:

```python wrong
class Cart:
    def total():
        return sum(self.prices)
```

```python right
class Cart:
    def total(self):
        return sum(self.prices)
```

Атрибут не сохранён в self:

```python wrong
class User:
    def __init__(self, name):
        name = name
```

```python right
class User:
    def __init__(self, name):
        self.name = name
```

Опечатка в имени конструктора:

```python wrong
class Point:
    def _init_(self, x, y):
        self.x, self.y = x, y
```

```python right
class Point:
    def __init__(self, x, y):
        self.x, self.y = x, y
```

Изменяемый атрибут класса общий для всех объектов:

```python wrong
class Cart:
    items = []
```

```python right
class Cart:
    def __init__(self):
        self.items = []
```

## Шпаргалка {#cheatsheet}

```python
class Name:
    LIMIT = 10                    # атрибут класса
    def __init__(self, a, b=0):
        self.a, self.b = a, b     # атрибуты объекта
    def method(self, x):
        return self.a + x
    def __str__(self): return f"Name({self.a})"
    def __eq__(self, other): return self.a == other.a
    def __lt__(self, other): return self.a < other.a
obj = Name(1); obj.method(2)
from dataclasses import dataclass, field
@dataclass
class P:
    x: int
    tags: list = field(default_factory=list)
class Child(Name):
    def __init__(self, a):
        super().__init__(a)
isinstance(obj, Name)
```
