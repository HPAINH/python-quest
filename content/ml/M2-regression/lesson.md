# Регрессии и метрики

## Зачем это нужно {#why}

Две главные задачи обучения с учителем: **регрессия** предсказывает число (сколько штук продадим завтра), **классификация** — класс (уйдёт клиент или нет). Для обеих есть простые и понятные линейные модели, с которых начинают любой проект, и свои метрики качества.

Регрессию разбираем на наборе ShopData demand — продажи товаров по дням с ценой, акциями, праздниками и погодой. Классификацию — на churn из уровня M1.

## Линейная регрессия {#linreg}

`LinearRegression` подбирает веса признаков так, чтобы сумма квадратов ошибок была минимальной: прогноз = b + w₁x₁ + w₂x₂ + …. Вес показывает, на сколько меняется прогноз при росте признака на единицу при прочих равных.

```python run
import pandas as pd
from sklearn.linear_model import LinearRegression

df = pd.read_csv("demand.csv", parse_dates=["date"])
cols = ["promo", "holiday", "temperature", "weekday"]
lr = LinearRegression().fit(df[cols], df["units"])
print(dict(zip(cols, lr.coef_.round(3))), round(lr.intercept_, 3))
print(lr.predict(df[cols].head(3)).round(2), df["units"].head(3).tolist())
```

Акция добавляет к прогнозу примерно столько штук, сколько показывает её вес. Вес температуры небольшой и положительный: летом холодные напитки и мороженое продаются лучше, а супы и чай — хуже, и в среднем эффекты почти гасят друг друга. Одна прямая на все категории этого не видит.

## Метрики регрессии {#reg-metrics}

- **MAE** — средняя абсолютная ошибка в единицах цели: «ошибаемся в среднем на 5 штук».
- **RMSE** — корень из средней квадратичной ошибки, сильнее штрафует большие промахи.
- **R²** — доля разброса цели, которую объясняет модель: 1 — идеально, 0 — не лучше среднего.

```python run
import numpy as np
import pandas as pd
from sklearn import metrics
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split

df = pd.read_csv("demand.csv")
cols = ["promo", "holiday", "temperature", "weekday"]
a, b, ya, yb = train_test_split(df[cols], df["units"], test_size=0.25, random_state=42)
pred = LinearRegression().fit(a, ya).predict(b)
print(round(metrics.mean_absolute_error(yb, pred), 3), round(np.sqrt(metrics.mean_squared_error(yb, pred)), 3), round(metrics.r2_score(yb, pred), 3))
print(round(metrics.mean_absolute_error(yb, np.full(len(yb), ya.mean())), 3))
```

Всегда сравнивай с простым бейзлайном — прогнозом средним. Модель, которая его не обыгрывает, бесполезна.

## Логистическая регрессия {#logreg}

`LogisticRegression` — линейная модель для классификации. Она считает взвешенную сумму признаков и пропускает её через сигмоиду, получая вероятность класса 1. `predict_proba` возвращает вероятности, `predict` — класс по порогу 0,5.

```python run
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

df = pd.read_csv("churn.csv")
X = df.drop(columns=["customer_id", "cancel_request", "churned"])
cat = ["city", "loyalty"]
num = [c for c in X.columns if c not in cat]
pre = ColumnTransformer([("num", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), num), ("cat", OneHotEncoder(handle_unknown="ignore"), cat)])
clf = make_pipeline(pre, LogisticRegression(max_iter=1000)).fit(X, df["churned"])
coef = pd.Series(clf[-1].coef_[0], index=pre.get_feature_names_out()).round(2)
print(coef.sort_values().head(3))
print(clf.predict_proba(X.head(3))[:, 1].round(3), clf.predict(X.head(3)))
```

Веса стандартизированных признаков можно сравнивать между собой: чем больше модуль, тем сильнее признак влияет на шанс ухода.

## Метрики классификации {#clf-metrics}

Матрица ошибок считает четыре исхода: верно найденные ушедшие (TP), ложные тревоги (FP), пропущенные (FN) и верно оставленные (TN).

- **precision** = TP / (TP + FP) — какая доля тревог настоящая;
- **recall** = TP / (TP + FN) — какую долю ушедших нашли;
- **F1** — гармоническое среднее precision и recall;
- **ROC-AUC** — вероятность, что случайный ушедший получит оценку выше случайного оставшегося; не зависит от порога.

```python run
import pandas as pd
from sklearn import metrics

y = pd.Series([1, 0, 1, 1, 0, 0, 0, 1])
p = pd.Series([0.9, 0.4, 0.35, 0.8, 0.1, 0.6, 0.2, 0.7])
pred = (p >= 0.5).astype(int)
print(metrics.confusion_matrix(y, pred).tolist())
print(metrics.precision_score(y, pred), metrics.recall_score(y, pred), round(metrics.f1_score(y, pred), 3))
print(metrics.roc_auc_score(y, p), metrics.accuracy_score(y, pred))
```

На несбалансированных данных accuracy обманчива: если уходит 16%, модель «никто не уйдёт» получает accuracy 84%.

## Порог {#threshold}

Порог 0,5 не обязателен. Ниже порог — больше recall и больше ложных тревог. Его выбирают под задачу: например, максимальный F1 или нужный recall.

```python run
import numpy as np
from sklearn.metrics import precision_recall_curve

y = np.array([1, 0, 1, 1, 0, 0, 0, 1])
p = np.array([0.9, 0.4, 0.35, 0.8, 0.1, 0.6, 0.2, 0.7])
prec, rec, thr = precision_recall_curve(y, p)
f1 = 2 * prec * rec / (prec + rec)
best = np.nanargmax(f1[:-1])
print(thr.round(2).tolist())
print(thr[best], round(f1[best], 3))
```

У `precision_recall_curve` массивов precision и recall на один элемент больше, чем порогов, — последний элемент отбрасывают.

## Частые ошибки {#mistakes}

ROC-AUC по меткам вместо вероятностей:

```python wrong
metrics.roc_auc_score(y_test, model.predict(X_test))
```

```python right
metrics.roc_auc_score(y_test, model.predict_proba(X_test)[:, 1])
```

Оценка качества на тех же данных, на которых учили:

```python wrong
model.fit(X, y); metrics.mean_absolute_error(y, model.predict(X))
```

```python right
model.fit(X_train, y_train); metrics.mean_absolute_error(y_test, model.predict(X_test))
```

Accuracy как главная метрика при редком классе:

```python wrong
metrics.accuracy_score(y_test, pred)
```

```python right
metrics.f1_score(y_test, pred), metrics.roc_auc_score(y_test, proba)
```

## Шпаргалка {#cheatsheet}

```python
LinearRegression().fit(X, y).coef_ / .intercept_
metrics.mean_absolute_error(y, p)   np.sqrt(metrics.mean_squared_error(y, p))   metrics.r2_score(y, p)
LogisticRegression(max_iter=1000)   model.predict_proba(X)[:, 1]   model.predict(X)
metrics.confusion_matrix(y, pred)   # [[TN, FP], [FN, TP]]
metrics.precision_score / recall_score / f1_score / roc_auc_score(y, proba)
prec, rec, thr = metrics.precision_recall_curve(y, proba)
```
