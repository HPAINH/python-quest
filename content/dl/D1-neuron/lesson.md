# Нейрон и перцептрон

## Зачем это нужно {#why}

Нейросети кажутся магией, пока не напишешь одну руками. На деле это несколько матричных умножений, нелинейных функций и правило обновления весов. В треке D мы соберём сеть с нуля на NumPy — без PyTorch — и обучим её; так проще понять, что делают готовые библиотеки и почему они иногда ломаются.

В этом уровне — прямой проход: от одного нейрона до двухслойной сети, и простейшее обучение — перцептрон.

## Нейрон {#neuron}

Нейрон считает взвешенную сумму входов плюс сдвиг: `z = w·x + b`, и пропускает её через функцию активации. Веса `w` говорят, насколько важен каждый вход, сдвиг `b` — где проходит порог.

```python run
import numpy as np

x = np.array([2.0, 0.5, -1.0])
w = np.array([0.4, -0.2, 0.3])
b = 0.1
z = np.dot(x, w) + b
print(z, x @ w + b)
print(1 / (1 + np.exp(-z)))
```

`np.dot` и оператор `@` для векторов дают одно и то же — скалярное произведение.

## Активации {#activations}

Без нелинейной активации любая глубокая сеть сводится к одной линейной модели. Основные функции:

- **сигмоида** `1 / (1 + e^−z)` — сжимает в (0, 1), подходит для вероятности;
- **tanh** — сжимает в (−1, 1);
- **ReLU** `max(0, z)` — просто и быстро, стандарт для скрытых слоёв;
- **softmax** — превращает вектор в распределение вероятностей по классам.

```python run
import numpy as np

z = np.array([-2.0, 0.0, 3.0])
print((1 / (1 + np.exp(-z))).round(3), np.tanh(z).round(3), np.maximum(0, z))
e = np.exp(z - z.max())
print((e / e.sum()).round(3), (e / e.sum()).sum())
```

В softmax из всех значений вычитают максимум: результат тот же, а `np.exp(1000)` больше не переполняется.

## Слой {#layer}

Слой — много нейронов сразу. Если в строках `X` — объекты, а в колонках `W` — нейроны, то выход слоя для всех объектов: `Z = X @ W + b`. Форма: `X` — (n, входы), `W` — (входы, нейроны), `b` — (нейроны,), `Z` — (n, нейроны).

```python run
import numpy as np

rng = np.random.default_rng(0)
X = rng.normal(size=(4, 3))
W = rng.normal(size=(3, 2))
b = np.array([0.5, -0.5])
Z = X @ W + b
print(X.shape, W.shape, Z.shape)
print(Z.round(3))
```

Сдвиг `b` прибавляется к каждой строке благодаря broadcasting из уровня N3.

## Прямой проход {#forward}

Двухслойная сеть для классификации: скрытый слой с ReLU, затем выходной слой с softmax. Каждая строка результата — вероятности классов для одного объекта.

```python run
import numpy as np

def relu(z):
    return np.maximum(0, z)

def softmax(z):
    e = np.exp(z - z.max(axis=1, keepdims=True))
    return e / e.sum(axis=1, keepdims=True)

rng = np.random.default_rng(1)
X = rng.normal(size=(5, 4))
W1, b1 = rng.normal(size=(4, 8)), np.zeros(8)
W2, b2 = rng.normal(size=(8, 3)), np.zeros(3)
P = softmax(relu(X @ W1 + b1) @ W2 + b2)
print(P.round(3))
print(P.sum(axis=1), P.argmax(axis=1))
```

`keepdims=True` сохраняет ось, чтобы максимум и сумма вычитались и делились построчно.

## Перцептрон {#perceptron}

Перцептрон — первый обучаемый нейрон. Он предсказывает 1, если `w·x + b ≥ 0`. Правило обучения: идём по объектам по порядку, и при ошибке сдвигаем веса в сторону правильного ответа: `w += lr · (y − pred) · x`, `b += lr · (y − pred)`.

```python run
import numpy as np

X = np.array([[2.0, 1.0], [1.0, 3.0], [-1.0, -2.0], [-2.0, 1.0]])
y = np.array([1, 1, 0, 0])
w, b = np.zeros(2), 0.0
for epoch in range(5):
    errors = 0
    for xi, yi in zip(X, y):
        pred = int(xi @ w + b >= 0)
        w += (yi - pred) * xi
        b += (yi - pred)
        errors += int(pred != yi)
    print(epoch, w, b, errors)
```

Если классы можно разделить прямой, перцептрон за конечное число шагов найдёт разделяющую прямую.

## Частые ошибки {#mistakes}

Softmax без вычитания максимума:

```python wrong
e = np.exp(z)
```

```python right
e = np.exp(z - z.max(axis=1, keepdims=True))
```

Перепутанный порядок множителей слоя:

```python wrong
Z = W @ X + b
```

```python right
Z = X @ W + b
```

Нормировка softmax по всей матрице вместо строк:

```python wrong
e / e.sum()
```

```python right
e / e.sum(axis=1, keepdims=True)
```

## Шпаргалка {#cheatsheet}

```python
z = x @ w + b                    Z = X @ W + b        # (n, in) @ (in, out) + (out,)
sigmoid = 1 / (1 + np.exp(-z))   np.tanh(z)           np.maximum(0, z)
e = np.exp(Z - Z.max(axis=1, keepdims=True)); P = e / e.sum(axis=1, keepdims=True)
P.argmax(axis=1)                 # предсказанный класс
pred = int(x @ w + b >= 0); w += lr * (y - pred) * x; b += lr * (y - pred)
```
