# Обучение MLP

## Зачем это нужно {#why}

Прямой проход и градиенты готовы — осталось соединить их в цикл обучения. Многослойный перцептрон (MLP) учится градиентным спуском: считает потерю, градиенты и сдвигает веса против градиента. Повторить много раз — и сеть научится разделять классы, которые прямой не разделить.

## Функции потерь {#losses}

Для двух классов используют бинарную кросс-энтропию: `BCE = −mean(y·log p + (1 − y)·log(1 − p))`, для нескольких — кросс-энтропию с softmax из уровня D2. Вероятности обрезают от 0 и 1, иначе `log(0)` даст бесконечность.

```python run
import numpy as np

y = np.array([1, 0, 1, 1])
p = np.array([0.9, 0.2, 0.6, 0.99])
eps = 1e-12
pc = np.clip(p, eps, 1 - eps)
print(round(-np.mean(y * np.log(pc) + (1 - y) * np.log(1 - pc)), 4))
print(round(-np.mean(y * np.log(np.clip(np.array([1.0, 0.0, 0.0, 1.0]), eps, 1 - eps))), 2))
```

Уверенная ошибка стоит очень дорого: предсказать 0 для настоящей единицы — потеря около 28 при eps = 1e−12.

## Градиентный спуск {#sgd}

Шаг обучения: `w ← w − lr · dL/dw`. Скорость обучения `lr` — главный гиперпараметр: слишком маленькая — обучение ползёт, слишком большая — потеря скачет или растёт.

```python run
import numpy as np

def loss(w):
    return (w - 3) ** 2

for lr in [0.01, 0.4, 1.1]:
    w = 0.0
    for _ in range(20):
        w -= lr * 2 * (w - 3)
    print(lr, round(w, 4), round(loss(w), 4))
```

При lr = 1.1 шаг перепрыгивает минимум всё дальше — спуск расходится.

## Мини-батчи {#minibatch}

Считать градиент по всем данным дорого. Стохастический градиентный спуск берёт небольшие случайные пакеты (мини-батчи): за эпоху данные перемешиваются и проходятся пакетами по `batch_size` объектов.

```python run
import numpy as np

rng = np.random.default_rng(0)
idx = rng.permutation(10)
batches = [idx[i:i + 4] for i in range(0, 10, 4)]
print(idx.tolist())
print([b.tolist() for b in batches])
```

Последний пакет может быть короче. Шум мини-батчей помогает выбираться из плохих локальных минимумов и ускоряет обучение на больших данных.

## Цикл обучения {#loop}

Цикл: прямой проход → потеря → градиенты → шаг. Потерю записывают по эпохам, чтобы видеть, учится ли сеть.

```python run
import numpy as np

rng = np.random.default_rng(0)
X = rng.normal(size=(200, 2))
y = (X[:, 0] ** 2 + X[:, 1] ** 2 < 1).astype(int)
W1, b1 = rng.normal(0, 1, (2, 16)), np.zeros(16)
W2, b2 = rng.normal(0, 0.25, (16, 2)), np.zeros(2)
Y = np.eye(2)[y]
for epoch in range(301):
    Z1 = X @ W1 + b1
    H = np.maximum(0, Z1)
    Z2 = H @ W2 + b2
    P = np.exp(Z2 - Z2.max(1, keepdims=True))
    P /= P.sum(1, keepdims=True)
    dZ2 = (P - Y) / len(X)
    dZ1 = (dZ2 @ W2.T) * (Z1 > 0)
    W2 -= 1.0 * H.T @ dZ2
    b2 -= 1.0 * dZ2.sum(0)
    W1 -= 1.0 * X.T @ dZ1
    b1 -= 1.0 * dZ1.sum(0)
    if epoch % 100 == 0:
        print(epoch, round(-np.log(P[np.arange(len(y)), y]).mean(), 4), (P.argmax(1) == y).mean())
```

Круг внутри квадрата не разделить прямой, но сеть со скрытым слоем справляется за пару сотен шагов.

## Частые ошибки {#mistakes}

log от вероятности без обрезки:

```python wrong
-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p))
```

```python right
p = np.clip(p, 1e-12, 1 - 1e-12)
-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p))
```

Шаг в сторону градиента вместо антиградиента:

```python wrong
w += lr * grad
```

```python right
w -= lr * grad
```

Мини-батчи без перемешивания на каждой эпохе:

```python wrong
idx = np.arange(n)
```

```python right
idx = rng.permutation(n)
```

## Шпаргалка {#cheatsheet}

```python
p = np.clip(p, 1e-12, 1 - 1e-12); bce = -np.mean(y * np.log(p) + (1 - y) * np.log(1 - p))
Y = np.eye(k)[y]
idx = rng.permutation(n); batches = [idx[i:i + bs] for i in range(0, n, bs)]
for epoch in range(E): forward → loss → backward → W -= lr * dW
logreg: p = sigmoid(X @ w + b); dw = X.T @ (p - y) / n; db = (p - y).mean()
```
