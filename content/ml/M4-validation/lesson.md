# Валидация

## Зачем это нужно {#why}

Одно разбиение на train и test — это одна случайная оценка. Другое разбиение даст другое число, и сравнивать модели по одному числу рискованно. Кросс-валидация усредняет несколько оценок, подбор гиперпараметров опирается на неё, а правильная схема разбиения защищает от самообмана: подглядывания в будущее и утечек.

## Кросс-валидация {#cv}

`cross_val_score` делит данные на k частей (фолдов), k раз обучает модель на k − 1 частях и проверяет на оставшейся. Результат — k оценок; их среднее надёжнее одного разбиения, а разброс показывает, насколько оценка стабильна.

```python run
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

df = pd.read_csv("churn.csv")
X = df.drop(columns=["customer_id", "cancel_request", "churned"])
y = df["churned"]
cat = ["city", "loyalty"]
pre = ColumnTransformer([("num", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), [c for c in X.columns if c not in cat]), ("cat", OneHotEncoder(handle_unknown="ignore"), cat)])
scores = cross_val_score(make_pipeline(pre, LogisticRegression(max_iter=1000)), X, y, cv=5, scoring="roc_auc")
print(scores.round(4), round(scores.mean(), 4), round(scores.std(), 4))
```

Pipeline внутри кросс-валидации переобучает подготовку на каждом фолде заново — это защищает от утечки через scaler и encoder.

## Фолды {#kfold}

`KFold` режет данные на части, `StratifiedKFold` сохраняет долю классов в каждой части. С `shuffle=True` строки перемешиваются перед разбиением, `random_state` делает его воспроизводимым.

```python run
import pandas as pd
from sklearn.model_selection import KFold, StratifiedKFold

y = pd.read_csv("churn.csv")["churned"]
for cv in [KFold(5), StratifiedKFold(5, shuffle=True, random_state=0)]:
    print(type(cv).__name__, [round(y.iloc[test].mean(), 3) for _, test in cv.split(y, y)])
```

Для классификации `cross_val_score(cv=5)` уже использует стратификацию, но без перемешивания. Объект с `shuffle=True` надёжнее, если данные упорядочены.

## Подбор гиперпараметров {#grid}

Гиперпараметры — настройки модели, которые не учатся из данных: сила регуляризации, глубина деревьев. `GridSearchCV` перебирает сетку значений, для каждого считает кросс-валидацию и в конце переобучает лучшую модель на всех данных. Имя параметра внутри Pipeline — `имяшага__параметр`.

```python run
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GridSearchCV, StratifiedKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

df = pd.read_csv("churn.csv")
X = df.drop(columns=["customer_id", "cancel_request", "churned"])
y = df["churned"]
cat = ["city", "loyalty"]
pre = ColumnTransformer([("num", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), [c for c in X.columns if c not in cat]), ("cat", OneHotEncoder(handle_unknown="ignore"), cat)])
pipe = make_pipeline(pre, LogisticRegression(max_iter=1000))
print([k for k in pipe.get_params() if k.endswith("__C")])
g = GridSearchCV(pipe, {"logisticregression__C": [0.01, 0.1, 1]}, cv=StratifiedKFold(3, shuffle=True, random_state=0), scoring="roc_auc").fit(X, y)
print(g.best_params_, round(g.best_score_, 4))
```

`make_pipeline` называет шаги по классу в нижнем регистре: `logisticregression`, `columntransformer`. Обученный `GridSearchCV` сам ведёт себя как модель: у него есть `predict` и `predict_proba`.

## Время {#timesplit}

Если данные упорядочены во времени, случайное разбиение подглядывает в будущее: модель учится на завтрашних продажах, а проверяется на вчерашних. `TimeSeriesSplit` всегда обучает на прошлом и проверяет на следующем отрезке.

```python run
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.model_selection import KFold, TimeSeriesSplit, cross_val_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder

d = pd.read_csv("demand.csv", parse_dates=["date"])
d["month"] = d["date"].dt.month
Xd = d.drop(columns=["date", "product_id", "units"])
m = make_pipeline(ColumnTransformer([("cat", OneHotEncoder(handle_unknown="ignore"), ["category"])], remainder="passthrough"), HistGradientBoostingRegressor(max_iter=50, random_state=0))
for cv in [TimeSeriesSplit(4), KFold(4, shuffle=True, random_state=0)]:
    print(type(cv).__name__, (-cross_val_score(m, Xd, d["units"], cv=cv, scoring="neg_mean_absolute_error")).round(2))
```

Случайный KFold даёт оценку оптимистичнее, чем будет в работе. Метрики ошибок в sklearn передаются со знаком минус (`neg_...`), чтобы «больше» всегда значило «лучше».

## Утечка цели {#leaks}

Самая опасная утечка — признак, который содержит ответ, потому что заполняется после события. Её выдаёт подозрительно сильный признак: один он предсказывает цель почти так же хорошо, как вся модель.

```python run
import pandas as pd
from sklearn import metrics

df = pd.read_csv("churn.csv")
y = df["churned"]
for c in ["cancel_request", "days_since_last", "support_tickets", "orders_90d"]:
    auc = metrics.roc_auc_score(y, df[c].fillna(df[c].median()))
    print(c, round(max(auc, 1 - auc), 3))
```

Проверка у каждого признака: «известен ли он в момент, когда модель будет делать прогноз?». `cancel_request` появляется уже после ухода, поэтому при прогнозе для живых клиентов его нет.

## Частые ошибки {#mistakes}

Подбор параметров по тестовой выборке:

```python wrong
for C in [0.1, 1, 10]: score = roc_auc(y_test, fit(X_train, C).predict_proba(X_test))
```

```python right
GridSearchCV(pipe, {"logisticregression__C": [0.1, 1, 10]}, cv=5, scoring="roc_auc").fit(X_train, y_train)
```

Случайное разбиение временного ряда:

```python wrong
cross_val_score(model, Xd, yd, cv=KFold(5, shuffle=True))
```

```python right
cross_val_score(model, Xd, yd, cv=TimeSeriesSplit(5))
```

Признак из будущего в модели:

```python wrong
X = df.drop(columns=["churned"])
```

```python right
X = df.drop(columns=["churned", "customer_id", "cancel_request"])
```

## Шпаргалка {#cheatsheet}

```python
cross_val_score(model, X, y, cv=5, scoring="roc_auc")     .mean(), .std()
StratifiedKFold(5, shuffle=True, random_state=0)   KFold(5)   TimeSeriesSplit(5)
for train_idx, test_idx in cv.split(X, y): ...
pipe.get_params()       # имена параметров: шаг__параметр
g = GridSearchCV(pipe, {"logisticregression__C": [.1, 1]}, cv=cv, scoring="roc_auc").fit(X, y)
g.best_params_   g.best_score_   g.predict_proba(X_new)
scoring="neg_mean_absolute_error"     # ошибки со знаком минус
```
