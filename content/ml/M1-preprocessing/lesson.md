# Подготовка данных

## Зачем это нужно {#why}

Модель машинного обучения учится на примерах с известным ответом и предсказывает ответ для новых. Чтобы она работала на новых клиентах, а не только на тех, что в таблице, данные делят на обучение и тест, категории переводят в числа, пропуски заполняют, а всё это собирают в Pipeline.

Весь трек ML работает с набором ShopData churn: признаки клиентов за 90 дней и метка `churned` — ушёл ли клиент. Уходит примерно каждый шестой. Проверка задач-моделей обучает твою модель и считает метрику на скрытой выборке других клиентов.

## train_test_split {#split}

Модель оценивают на данных, которых она не видела при обучении. `train_test_split` делит таблицу случайно; `stratify=y` сохраняет долю классов в обеих частях, `random_state` делает разбиение воспроизводимым.

```python run
import pandas as pd
from sklearn.model_selection import train_test_split

df = pd.read_csv("churn.csv")
X = df.drop(columns=["customer_id", "cancel_request", "churned"])
y = df["churned"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, stratify=y, random_state=42)
print(X_train.shape, X_test.shape)
print(round(y_train.mean(), 4), round(y_test.mean(), 4))
```

`customer_id` — не признак: номер клиента не говорит о поведении. `cancel_request` заполняется после ухода — это утечка, о ней в конце урока.

## Кодирование категорий {#encoding}

Модели sklearn работают только с числами. `OneHotEncoder` превращает категорию в набор колонок 0/1 — по одной на значение. `handle_unknown="ignore"` кодирует незнакомое значение нулями вместо ошибки.

```python run
import pandas as pd
from sklearn.preprocessing import OneHotEncoder

df = pd.read_csv("churn.csv")
enc = OneHotEncoder(handle_unknown="ignore")
codes = enc.fit_transform(df[["loyalty"]]).toarray()
print(enc.get_feature_names_out().tolist())
print(codes[:3])
print(enc.transform(pd.DataFrame({"loyalty": ["platinum"]})).toarray())
```

В скрытых данных этого трека есть города, которых нет в обучении. Без `handle_unknown="ignore"` модель упадёт на первом таком клиенте.

## Масштабирование {#scaling}

Признаки живут в разных масштабах: дни — до 180, доли — до 1, чек — тысячи рублей. Линейным моделям и методам на расстояниях это мешает. `StandardScaler` вычитает среднее и делит на стандартное отклонение. Его учат (`fit`) **только на train** и применяют (`transform`) к обеим частям.

```python run
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

df = pd.read_csv("churn.csv")
num = df[["days_since_last", "orders_90d", "discount_share"]]
a, b = train_test_split(num, test_size=0.25, random_state=42)
sc = StandardScaler().fit(a)
print(sc.mean_.round(2), sc.scale_.round(2))
print(sc.transform(a).mean(axis=0).round(3), sc.transform(b).mean(axis=0).round(3))
```

## Pipeline и ColumnTransformer {#pipeline}

`ColumnTransformer` применяет разные преобразования к разным колонкам, `SimpleImputer` заполняет пропуски, а `Pipeline` соединяет подготовку и модель в один объект. `fit` такого объекта учит всё сразу на train, а `predict_proba` сам подготовит новые данные теми же правилами.

```python run
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

df = pd.read_csv("churn.csv")
X = df.drop(columns=["customer_id", "cancel_request", "churned"])
y = df["churned"]
cat = ["city", "loyalty"]
num = [c for c in X.columns if c not in cat]
pre = ColumnTransformer([
    ("num", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), num),
    ("cat", OneHotEncoder(handle_unknown="ignore"), cat),
])
model = make_pipeline(pre, LogisticRegression(max_iter=1000)).fit(X, y)
print(pre.transform(X).shape, model.predict_proba(X.head(3))[:, 1].round(3))
```

## Утечки {#leaks}

Утечка — когда при обучении модель видит информацию, недоступную в момент прогноза. Две частые формы:

- **fit до разбиения**: scaler или encoder обучены на всех данных, включая тест, — оценка завышена;
- **признак из будущего**: `cancel_request` появляется после ухода клиента. На обучении он почти угадывает ответ, а при прогнозе для живых клиентов бесполезен.

```python run
import pandas as pd

df = pd.read_csv("churn.csv")
print(df.groupby("cancel_request")["churned"].mean().round(3))
```

Pipeline защищает от первой формы: всё внутри него учится только на тех данных, что переданы в `fit`.

## Частые ошибки {#mistakes}

Scaler обучен на всех данных до разбиения:

```python wrong
X_scaled = StandardScaler().fit_transform(X)
X_train, X_test, y_train, y_test = train_test_split(X_scaled, y)
```

```python right
X_train, X_test, y_train, y_test = train_test_split(X, y)
model = make_pipeline(StandardScaler(), LogisticRegression()).fit(X_train, y_train)
```

Encoder без защиты от новых категорий:

```python wrong
OneHotEncoder()
```

```python right
OneHotEncoder(handle_unknown="ignore")
```

Модель на сырой таблице с текстом и пропусками:

```python wrong
LogisticRegression().fit(X, y)
```

```python right
make_pipeline(pre, LogisticRegression(max_iter=1000)).fit(X, y)
```

## Шпаргалка {#cheatsheet}

```python
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=.25, stratify=y, random_state=42)
OneHotEncoder(handle_unknown="ignore")     enc.get_feature_names_out()
StandardScaler().fit(X_train)              sc.transform(X_test)
SimpleImputer(strategy="median")
pre = ColumnTransformer([("num", make_pipeline(SimpleImputer(), StandardScaler()), num),
                         ("cat", OneHotEncoder(handle_unknown="ignore"), cat)])
model = make_pipeline(pre, LogisticRegression(max_iter=1000)).fit(X_train, y_train)
model.predict_proba(X_test)[:, 1]
```
