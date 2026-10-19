# Обратное распространение

## Зачем это нужно {#why}

Чтобы обучить сеть, нужно знать, как изменение каждого веса влияет на ошибку, — то есть градиент функции потерь по всем весам. Обратное распространение (backpropagation) считает его за один проход от выхода ко входу, переиспользуя промежуточные результаты прямого прохода. Это всего лишь цепное правило из математического анализа, применённое к слоям.

## Цепное правило {#chain}

Если `L = f(g(x))`, то `dL/dx = f'(g(x)) · g'(x)`. В сети каждый слой — звено цепочки: градиент, пришедший сверху, умножается на локальную производную слоя и передаётся вниз.

```python run
import numpy as np

x = 1.5
g = x ** 2
L = np.sin(g)
dL_dg = np.cos(g)
dg_dx = 2 * x
print(dL_dg * dg_dx)
eps = 1e-6
print((np.sin((x + eps) ** 2) - np.sin((x - eps) ** 2)) / (2 * eps))
```

Последняя строка — численная проверка: изменили вход на крошечное eps и посмотрели, как изменился выход. Совпадение с аналитическим градиентом — признак, что производная выведена верно.

## Производные активаций {#activation-grads}

Активации применяются поэлементно, поэтому их производные — тоже поэлементные множители:

- сигмоида: `σ'(z) = σ(z) · (1 − σ(z))`;
- tanh: `1 − tanh²(z)`;
- ReLU: 1, где `z > 0`, иначе 0.

```python run
import numpy as np

z = np.array([-2.0, 0.0, 3.0])
s = 1 / (1 + np.exp(-z))
print((s * (1 - s)).round(4))
print((1 - np.tanh(z) ** 2).round(4))
print((z > 0).astype(float))
```

При обратном проходе через активацию градиент сверху умножается на производную поэлементно: `dZ = dA * f'(Z)`.

## Градиенты слоя {#layer-grads}

Для слоя `Z = X @ W + b` при известном `dZ = dL/dZ` формы (n, нейроны):

- `dW = X.T @ dZ` — форма как у W;
- `db = dZ.sum(axis=0)` — форма как у b;
- `dX = dZ @ W.T` — градиент, который уходит в предыдущий слой.

```python run
import numpy as np

rng = np.random.default_rng(0)
X, W = rng.normal(size=(4, 3)), rng.normal(size=(3, 2))
dZ = rng.normal(size=(4, 2))
dW, db, dX = X.T @ dZ, dZ.sum(axis=0), dZ @ W.T
print(dW.shape, db.shape, dX.shape)
```

Правило форм помогает не ошибиться: градиент по массиву всегда имеет форму самого массива.

## Градиенты потерь {#loss-grads}

Для среднеквадратичной ошибки `L = mean((p − y)²)` градиент по прогнозам — `2(p − y) / n`. Для softmax вместе с кросс-энтропией формула особенно простая: `dZ = (P − Y) / n`, где `Y` — one-hot метки.

```python run
import numpy as np

Z = np.array([[2.0, 1.0, 0.1], [0.5, 2.5, 0.3]])
y = np.array([0, 1])
e = np.exp(Z - Z.max(axis=1, keepdims=True))
P = e / e.sum(axis=1, keepdims=True)
Y = np.eye(3)[y]
loss = -np.log(P[np.arange(2), y]).mean()
print(round(loss, 4))
print(((P - Y) / 2).round(4))
```

`np.eye(k)[y]` — быстрый способ получить one-hot матрицу: строка i единичной матрицы для класса i.

## Численная проверка {#numeric}

Аналитический градиент сверяют с численным: для каждого элемента x сдвигают его на ±eps и считают `(f(x + eps) − f(x − eps)) / (2·eps)`. Если расхождение больше 1e−5 — в формуле ошибка.

```python run
import numpy as np

def f(w):
    return (np.tanh(w) ** 2).sum()

w = np.array([0.3, -1.2, 2.0])
analytic = 2 * np.tanh(w) * (1 - np.tanh(w) ** 2)
numeric = np.zeros_like(w)
for i in range(w.size):
    d = np.zeros_like(w)
    d[i] = 1e-5
    numeric[i] = (f(w + d) - f(w - d)) / 2e-5
print(analytic.round(6), np.abs(analytic - numeric).max() < 1e-8)
```

Численный градиент медленный — по два прохода на каждый вес, — поэтому им только проверяют, а не обучают.

## Частые ошибки {#mistakes}

Градиент по W с неверным порядком множителей:

```python wrong
dW = dZ @ X
```

```python right
dW = X.T @ dZ
```

Градиент по сдвигу без суммирования по объектам:

```python wrong
db = dZ
```

```python right
db = dZ.sum(axis=0)
```

Производная ReLU по выходу вместо входа:

```python wrong
dZ = dA * (np.maximum(0, Z) > 1)
```

```python right
dZ = dA * (Z > 0)
```

## Шпаргалка {#cheatsheet}

```python
s = sigmoid(z); ds = s * (1 - s)      1 - np.tanh(z) ** 2      (z > 0).astype(float)
dZ = dA * f_prime(Z)
dW = X.T @ dZ    db = dZ.sum(axis=0)    dX = dZ @ W.T
mse: L = ((p - y) ** 2).mean();  dL/dp = 2 * (p - y) / n
softmax + CE: dZ = (P - np.eye(k)[y]) / n
numeric: (f(x + eps) - f(x - eps)) / (2 * eps)
```
