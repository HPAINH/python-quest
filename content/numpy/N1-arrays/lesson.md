# Массивы NumPy

## Зачем это нужно {#why}

Списки Python медленные и неудобны для расчётов: чтобы умножить миллион цен на 1.2, нужен цикл. Массив NumPy делает то же одной операцией `prices * 1.2` — в десятки раз быстрее, потому что считает внутри скомпилированного кода. На NumPy построены pandas, scikit-learn и все нейросети, которые ты будешь писать в треке D.

В этом уровне — что такое массив, его тип и форма, как создавать массивы и менять их форму. Во всех задачах ответ записывается в переменную `result`, а проверка запускает код на трёх наборах данных: один ты видишь, два скрытых — нет.

## Массив {#arrays}

Массив создают из списка через `np.array`. Все элементы массива одного типа, а арифметика применяется **к каждому элементу** сразу.

```python run
import numpy as np

prices = np.array([450, 990, 1290])
print(prices * 1.2)
print(prices + 10, prices > 500)
print(prices.sum(), prices.mean(), prices.max())
```

Два массива одной длины складываются, умножаются и сравниваются поэлементно: первый с первым, второй со вторым.

```python run
import numpy as np

price = np.array([450.0, 990.0, 1290.0])
qty = np.array([2, 1, 3])
revenue = price * qty
print(revenue, revenue.sum())
```

Для списков `[1, 2] * 2` повторяет список, а для массивов умножает каждый элемент. Это главное отличие.

## Тип и форма {#dtype}

У массива есть `dtype` — тип элементов, `shape` — форма (размер по каждой оси), `ndim` — число осей и `size` — общее число элементов.

```python run
import numpy as np

a = np.array([1, 2, 3])
m = np.array([[1.5, 2.0, 3.0], [4.0, 5.0, 6.0]])
print(a.dtype, a.shape, a.ndim)
print(m.dtype, m.shape, m.ndim, m.size)
```

Основные типы: `int64` или `int32` — целые (в браузере NumPy по умолчанию берёт `int32`, на компьютере — `int64`), `float64` — дробные, `bool` — логические, `<U` — строки. Если в списке есть хоть одно дробное число, весь массив станет `float64`.

Тип меняют через `astype`. При переводе дробных в целые дробная часть отбрасывается, а строки с числами переводятся в числа.

```python run
import numpy as np

raw = np.array(["12", "7", "30"])
nums = raw.astype(int)
print(nums + 1, nums.dtype)
print(np.array([2.9, -1.7]).astype(int))
```

## Создание массивов {#create}

Массивы часто создают без списка: `np.arange` — диапазон с шагом (как `range`), `np.linspace` — заданное число точек между границами включительно, `np.zeros` и `np.ones` — массивы нулей и единиц, `np.full` — массив из одного значения.

```python run
import numpy as np

print(np.arange(0, 10, 3))
print(np.linspace(0, 1, 5))
print(np.zeros(3), np.ones((2, 3), dtype=int))
print(np.full(4, 99))
```

`np.arange` не включает правую границу, а `np.linspace` включает. Тип можно задать через `dtype=`: `np.zeros(3, dtype=int)` даёт целые нули вместо `0.`.

Форма передаётся кортежем: `np.zeros((2, 3))` — 2 строки и 3 столбца. Без скобок `np.zeros(2, 3)` — ошибка: второй аргумент считается типом.

## Форма и reshape {#reshape}

`reshape` раскладывает те же элементы в другую форму. Число элементов не меняется: 12 чисел можно разложить в `(3, 4)`, `(2, 6)` или `(4, 3)`, но не в `(5, 3)`. Одну ось можно указать как `-1`, тогда NumPy вычислит её сам.

```python run
import numpy as np

days = np.arange(1, 15)
weeks = days.reshape(2, 7)
print(weeks)
print(weeks.shape, days.reshape(-1, 2).shape)
print(weeks.ravel()[:5], weeks.T.shape)
```

Элементы раскладываются по строкам: сначала заполняется первая строка, потом вторая. `ravel()` возвращает массив обратно в одну линию, а `.T` транспонирует — меняет строки и столбцы местами.

Двумерный массив — это таблица: первая ось — строки, вторая — столбцы. Так хранят продажи «магазин × день» или пиксели картинки.

## Частые ошибки {#mistakes}

Форма без скобок:

```python wrong
m = np.zeros(2, 3)
```

```python right
m = np.zeros((2, 3))
```

reshape не сходится по числу элементов:

```python wrong
np.arange(12).reshape(5, 3)
```

```python right
np.arange(12).reshape(4, 3)
```

Список вместо массива — умножение повторяет список:

```python wrong
prices = [450, 990]
print(prices * 2)
```

```python right
prices = np.array([450, 990])
print(prices * 2)
```

Ответ не записан в result:

```python wrong
np.array(prices) * 1.2
```

```python right
result = np.array(prices) * 1.2
```

## Шпаргалка {#cheatsheet}

```python
import numpy as np
a = np.array([1, 2, 3])
a.dtype  a.shape  a.ndim  a.size
a * 2  a + b  a > 1  a.sum()  a.mean()  a.max()
a.astype(float)  a.astype(int)
np.arange(0, 10, 2)        # без правой границы
np.linspace(0, 1, 5)       # с правой границей
np.zeros((2, 3))  np.ones(3, dtype=int)  np.full(4, 7)
a.reshape(2, -1)  a.ravel()  m.T
result = ...               # ответ в задачах
```
