# Финальный проект: отток

## Зачем это нужно {#why}

Этот уровень — полный цикл, как в тестовом задании на позицию junior DS: посмотреть на данные, придумать признаки, обучить и сравнить модели и перевести качество модели в деньги. Модель оттока сама по себе ничего не стоит — ценность появляется, когда по ней решают, кому отправить удерживающее предложение.

Данные — сырая таблица `churn.csv` целиком: с идентификатором, пропусками и утечкой `cancel_request`. В финальной модели всё это нужно учесть самому.

## Разведка данных {#eda}

Перед моделью смотрят на долю целевого события в разрезах: так появляются гипотезы для признаков и понимание, что модель должна найти.

```python run
import pandas as pd

df = pd.read_csv("churn.csv")
print(round(df["churned"].mean(), 3))
print(df.pivot_table(index="loyalty", columns="app_user", values="churned", aggfunc="mean").round(3))
print(df.groupby(pd.cut(df["days_since_last"], [0, 30, 60, 90, 180], include_lowest=True), observed=True)["churned"].mean().round(3))
```

Резкий скачок оттока после 60 дней без заказов — подсказка для признака-порога.

## Признаки {#features}

Хороший признак выражает гипотезу о поведении: «не заказывал больше двух месяцев», «новичок, который покупает только со скидкой». Линейная модель сама не найдёт порог и взаимодействие, а готовый признак даст их ей явно. Функцию признаков встраивают в Pipeline через `FunctionTransformer`, чтобы она применялась и к новым данным.

```python run
import pandas as pd
from sklearn.preprocessing import FunctionTransformer

def add_features(d):
    d = d.copy()
    d["inactive"] = (d["days_since_last"] > 60).astype(int)
    d["new_discount"] = d["discount_share"] * (d["tenure_months"] < 6)
    return d

df = pd.read_csv("churn.csv")
t = FunctionTransformer(add_features).fit_transform(df)
print(t.groupby("inactive")["churned"].mean().round(3).to_dict())
print(t.groupby(t["new_discount"] > 0.4)["churned"].mean().round(3).to_dict())
```

## Модель {#model}

Pipeline проекта: функция признаков → подготовка колонок → модель. Сравнение — кросс-валидацией, финальная проверка — на отложенных данных.

```python run
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import FunctionTransformer, OneHotEncoder, StandardScaler

def add_features(d):
    d = d.copy()
    d["inactive"] = (d["days_since_last"] > 60).astype(int)
    d["new_discount"] = d["discount_share"] * (d["tenure_months"] < 6)
    return d

df = pd.read_csv("churn.csv")
raw, y = df.drop(columns=["churned"]), df["churned"]
cat = ["city", "loyalty"]
base = [c for c in raw.columns if c not in cat + ["customer_id", "cancel_request"]]
cv = StratifiedKFold(3, shuffle=True, random_state=0)
for num, steps in [(base, []), (base + ["inactive", "new_discount"], [FunctionTransformer(add_features)])]:
    pre = ColumnTransformer([("num", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), num), ("cat", OneHotEncoder(handle_unknown="ignore"), cat)])
    print(len(num), round(cross_val_score(make_pipeline(*steps, pre, LogisticRegression(max_iter=1000)), raw, y, cv=cv, scoring="roc_auc").mean(), 4))
```

## Бизнес-метрика {#business}

Модель выдаёт вероятности, а решение — кому звонить — принимают по порогу. Порог подбирают под деньги: сколько стоит контакт, сколько приносит удержанный клиент и какая доля уходящих остаётся после предложения.

```python
profit = saved_share * value * TP - cost * contacted
```

```python run
import numpy as np

rng = np.random.default_rng(0)
y = rng.random(1000) < 0.16
proba = np.clip(0.16 + 0.5 * (y - 0.16) + rng.normal(0, 0.15, 1000), 0, 1)
for t in [0.2, 0.3, 0.5]:
    contact = proba >= t
    tp = (contact & y).sum()
    print(t, int(contact.sum()), int(tp), int(0.3 * 2500 * tp - 300 * contact.sum()))
```

Низкий порог ловит больше уходящих, но тратит деньги на тех, кто и так остался бы. Оптимум ищут перебором порогов на валидационных данных.

## Частые ошибки {#mistakes}

Признаки посчитаны вне Pipeline — на новых данных их не будет:

```python wrong
raw2 = add_features(raw)
model = make_pipeline(pre, LogisticRegression()).fit(raw2, y)
```

```python right
model = make_pipeline(FunctionTransformer(add_features), pre, LogisticRegression()).fit(raw, y)
```

Порог подобран на тех же данных, на которых училась модель:

```python wrong
proba = model.fit(X, y).predict_proba(X)[:, 1]
```

```python right
proba = model.fit(X_train, y_train).predict_proba(X_val)[:, 1]
```

Функция признаков меняет исходную таблицу:

```python wrong
def add_features(d):
    d["inactive"] = d["days_since_last"] > 60
    return d
```

```python right
def add_features(d):
    d = d.copy()
    d["inactive"] = (d["days_since_last"] > 60).astype(int)
    return d
```

## Шпаргалка {#cheatsheet}

```python
df.pivot_table(index="a", columns="b", values="churned", aggfunc="mean")
pd.cut(s, [0, 30, 60, 90, 180], include_lowest=True)
FunctionTransformer(add_features)       def add_features(d): d = d.copy(); ...; return d
make_pipeline(FunctionTransformer(add_features), pre, model)
prec, rec, thr = metrics.precision_recall_curve(y_val, proba)
profit = saved_share * value * tp - cost * contacted
```
