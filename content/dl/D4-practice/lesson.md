# Практика нейросетей

## Зачем это нужно {#why}

Сеть из уровня D3 учится на игрушечных данных, но на реальных таблицах её подстерегают три проблемы: веса стартуют неудачно и обучение глохнет, сеть переобучается, обычный спуск идёт медленно. Против каждой есть стандартный приём: инициализация He, регуляризация и dropout, оптимизатор Adam. В конце уровня — сравнение своей сети с `MLPClassifier` из sklearn на данных оттока.

## Инициализация {#init}

Если веса слишком большие, сигналы и градиенты растут от слоя к слою; если слишком маленькие — затухают. Инициализация He для ReLU берёт веса из нормального распределения со стандартным отклонением `√(2 / n_in)`, Xavier для tanh — `√(1 / n_in)`.

```python run
import numpy as np

rng = np.random.default_rng(0)
x = rng.normal(size=(500, 256))
for name, scale in [("0.01", 0.01), ("He", np.sqrt(2 / 256)), ("1.0", 1.0)]:
    h = x
    for _ in range(5):
        h = np.maximum(0, h @ (rng.normal(size=(256, 256)) * scale))
    print(name, round(float(h.std()), 4))
```

С He разброс сигнала после пяти слоёв остаётся порядка единицы, а с 0.01 он почти ноль — градиенты тоже исчезнут.

## Регуляризация L2 {#regularization}

L2-регуляризация добавляет к потере штраф `λ/2 · Σ W²` — большие веса становятся невыгодными, модель получается глаже и меньше переобучается. К градиенту каждого веса прибавляется `λ · W`. Сдвиги `b` обычно не штрафуют.

```python run
import numpy as np

W = np.array([[1.0, -2.0], [0.5, 3.0]])
lam = 0.1
penalty = lam / 2 * (W ** 2).sum()
grad = lam * W
print(penalty, grad.tolist())
```

В sklearn за L2 отвечает `alpha` у `MLPClassifier` и `C` у логистической регрессии (там обратная сила).

## Dropout {#dropout}

Dropout на обучении случайно выключает долю `p` нейронов, заставляя сеть не полагаться на отдельные нейроны. В варианте inverted dropout оставшиеся значения делят на `1 − p`, чтобы среднее не менялось, — тогда на прогнозе dropout просто не применяют.

```python run
import numpy as np

rng = np.random.default_rng(0)
A = np.ones((2, 6))
p = 0.5
mask = rng.random(A.shape) >= p
out = A * mask / (1 - p)
print(mask.astype(int).tolist())
print(out.tolist(), out.mean())
```

Здесь среднее вышло 1.33, а не 1: выключилось 4 нейрона из 12 вместо 6. Деление на `1 − p` сохраняет среднее в ожидании, а на больших слоях случайный разброс мал.

## Adam {#adam}

Adam хранит для каждого веса скользящее среднее градиента `m` и его квадрата `v` и делит шаг на `√v`: редкие и шумные направления получают адекватный шаг. На шаге t средние поправляют на смещение от нулевого старта.

```python run
import numpy as np

def adam_step(w, g, m, v, t, lr=0.1, b1=0.9, b2=0.999, eps=1e-8):
    m = b1 * m + (1 - b1) * g
    v = b2 * v + (1 - b2) * g ** 2
    m_hat, v_hat = m / (1 - b1 ** t), v / (1 - b2 ** t)
    return w - lr * m_hat / (np.sqrt(v_hat) + eps), m, v

w, m, v = np.array([5.0, -3.0]), np.zeros(2), np.zeros(2)
for t in range(1, 101):
    w, m, v = adam_step(w, 2 * w, m, v, t)
print(w.round(4))
```

Первый шаг Adam по модулю почти ровно `lr` для любого градиента — поэтому `lr` у Adam задают маленьким: 0.001–0.01.

## MLPClassifier {#sklearn}

В sklearn есть готовый многослойный перцептрон: ReLU, Adam, L2 через `alpha`, ранняя остановка по валидации. Для таблиц он редко лучше бустинга, но это честный бейзлайн для своей сети.

```python run
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

df = pd.read_csv("churn.csv")
X = df.drop(columns=["customer_id", "cancel_request", "churned"])
y = df["churned"]
cat = ["city", "loyalty"]
pre = ColumnTransformer([("num", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), [c for c in X.columns if c not in cat]), ("cat", OneHotEncoder(handle_unknown="ignore"), cat)])
mlp = make_pipeline(pre, MLPClassifier(hidden_layer_sizes=(32,), alpha=1e-3, max_iter=200, early_stopping=True, random_state=0))
X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.25, stratify=y, random_state=0)
mlp.fit(X_tr, y_tr)
print(round(roc_auc_score(y_te, mlp.predict_proba(X_te)[:, 1]), 4))
```

Нейросетям масштабирование обязательно: без него градиенты по признакам с большим разбросом доминируют.

## Частые ошибки {#mistakes}

Все веса стартуют с нуля:

```python wrong
W1 = np.zeros((n_in, n_hidden))
```

```python right
W1 = rng.normal(0, np.sqrt(2 / n_in), (n_in, n_hidden))
```

Dropout без деления на 1 − p:

```python wrong
A = A * mask
```

```python right
A = A * mask / (1 - p)
```

Adam без поправки смещения на первых шагах:

```python wrong
w -= lr * m / (np.sqrt(v) + eps)
```

```python right
w -= lr * (m / (1 - b1 ** t)) / (np.sqrt(v / (1 - b2 ** t)) + eps)
```

## Шпаргалка {#cheatsheet}

```python
W = rng.normal(0, np.sqrt(2 / n_in), (n_in, n_out))          # He
penalty = lam / 2 * (W ** 2).sum(); dW += lam * W              # L2
mask = rng.random(A.shape) >= p; A = A * mask / (1 - p)        # inverted dropout
m = b1*m + (1-b1)*g; v = b2*v + (1-b2)*g**2; w -= lr * (m/(1-b1**t)) / (np.sqrt(v/(1-b2**t)) + eps)
MLPClassifier(hidden_layer_sizes=(32,), alpha=1e-3, early_stopping=True, random_state=0)
```
