# Деревья и ансамбли

## Зачем это нужно {#why}

Линейная модель проводит одну плоскость. Но отток устроен сложнее: «давно не заходил» опасно само по себе, а «новичок со скидками» — только в сочетании. Деревья решений находят такие пороги и взаимодействия сами, а ансамбли из сотен деревьев — случайный лес и градиентный бустинг — остаются самыми сильными моделями для табличных данных.

Деревьям не нужно масштабирование: им важен порядок значений, а не масштаб. Категории по-прежнему кодируют, пропуски — заполняют.

## Дерево решений {#tree}

Дерево задаёт вопросы вида «days_since_last ≤ 60?» и в каждом листе выдаёт долю класса. `max_depth` ограничивает глубину, `min_samples_leaf` — минимальный размер листа. Без ограничений дерево запоминает обучающие данные и плохо работает на новых.

```python run
import pandas as pd
from sklearn import metrics
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier, export_text

df = pd.read_csv("churn.csv")
cols = ["days_since_last", "orders_90d", "support_tickets", "tenure_months"]
a, b, ya, yb = train_test_split(df[cols], df["churned"], test_size=0.25, stratify=df["churned"], random_state=42)
for depth in [2, 5, None]:
    t = DecisionTreeClassifier(max_depth=depth, random_state=0).fit(a, ya)
    print(depth, round(metrics.roc_auc_score(ya, t.predict_proba(a)[:, 1]), 3), round(metrics.roc_auc_score(yb, t.predict_proba(b)[:, 1]), 3))
print(export_text(DecisionTreeClassifier(max_depth=2).fit(a, ya), feature_names=cols))
```

Разрыв между качеством на train и на test — главный признак переобучения.

## Случайный лес {#forest}

Лес обучает сотни деревьев на случайных подвыборках строк и признаков и усредняет их прогнозы. Отдельное дерево ошибается, но ошибки разных деревьев взаимно гасятся.

```python run
import pandas as pd
from sklearn import metrics
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder

df = pd.read_csv("churn.csv")
X = df.drop(columns=["customer_id", "cancel_request", "churned"])
y = df["churned"]
cat = ["city", "loyalty"]
pre = ColumnTransformer([("num", SimpleImputer(strategy="median"), [c for c in X.columns if c not in cat]), ("cat", OneHotEncoder(handle_unknown="ignore"), cat)])
a, b, ya, yb = train_test_split(X, y, test_size=0.25, stratify=y, random_state=42)
rf = make_pipeline(pre, RandomForestClassifier(n_estimators=100, min_samples_leaf=5, random_state=0)).fit(a, ya)
print(round(metrics.roc_auc_score(yb, rf.predict_proba(b)[:, 1]), 4))
```

Главные параметры: `n_estimators` — число деревьев (больше — стабильнее, но медленнее), `min_samples_leaf` и `max_features` — насколько «шумное» каждое дерево.

## Градиентный бустинг {#boosting}

Бустинг строит деревья по очереди: каждое следующее исправляет ошибки суммы предыдущих. `HistGradientBoostingClassifier` — быстрая реализация в sklearn, которая сама работает с пропусками.

```python run
import pandas as pd
from sklearn import metrics
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder

df = pd.read_csv("churn.csv")
X = df.drop(columns=["customer_id", "cancel_request", "churned"])
y = df["churned"]
pre = ColumnTransformer([("cat", OneHotEncoder(handle_unknown="ignore"), ["city", "loyalty"])], remainder="passthrough")
a, b, ya, yb = train_test_split(X, y, test_size=0.25, stratify=y, random_state=42)
for lr, it, d in [(0.1, 100, None), (0.05, 300, 3)]:
    m = make_pipeline(pre, HistGradientBoostingClassifier(learning_rate=lr, max_iter=it, max_depth=d, random_state=0)).fit(a, ya)
    print(lr, it, d, round(metrics.roc_auc_score(yb, m.predict_proba(b)[:, 1]), 4))
```

Меньше `learning_rate` и неглубокие деревья с бо́льшим числом итераций — классический способ сделать бустинг аккуратнее.

## Важность признаков {#importance}

`feature_importances_` у деревьев показывает, насколько признак уменьшал неоднородность в разбиениях. Более честный способ — `permutation_importance`: перемешать один признак и посмотреть, насколько упадёт метрика.

```python run
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.inspection import permutation_importance

df = pd.read_csv("churn.csv")
cols = ["days_since_last", "orders_90d", "support_tickets", "returns_share", "tenure_months", "discount_share"]
rf = RandomForestClassifier(n_estimators=60, min_samples_leaf=5, random_state=0).fit(df[cols], df["churned"])
print(pd.Series(rf.feature_importances_, index=cols).round(3).sort_values(ascending=False).to_dict())
pi = permutation_importance(rf, df[cols].head(1500), df["churned"].head(1500), n_repeats=3, random_state=0, scoring="roc_auc")
print(pd.Series(pi.importances_mean, index=cols).round(4).sort_values(ascending=False).head(3).to_dict())
```

Важность — не причинность: она говорит, на что опирается модель, а не почему клиенты уходят.

## Частые ошибки {#mistakes}

Дерево без ограничений:

```python wrong
DecisionTreeClassifier()
```

```python right
DecisionTreeClassifier(max_depth=6, min_samples_leaf=50)
```

Масштабирование «для деревьев» вместо кодирования категорий:

```python wrong
make_pipeline(StandardScaler(), RandomForestClassifier()).fit(X, y)
```

```python right
make_pipeline(pre, RandomForestClassifier()).fit(X, y)
```

Оценка переобучения по train:

```python wrong
metrics.roc_auc_score(y_train, model.predict_proba(X_train)[:, 1])
```

```python right
metrics.roc_auc_score(y_test, model.predict_proba(X_test)[:, 1])
```

## Шпаргалка {#cheatsheet}

```python
DecisionTreeClassifier(max_depth=6, min_samples_leaf=50, random_state=0)
RandomForestClassifier(n_estimators=100, min_samples_leaf=5, random_state=0)
HistGradientBoostingClassifier(learning_rate=0.05, max_iter=300, max_depth=3, random_state=0)
HistGradientBoostingRegressor(random_state=0)
model[-1].feature_importances_    model[0].get_feature_names_out()
permutation_importance(model, X, y, n_repeats=3, random_state=0, scoring="roc_auc")
export_text(tree, feature_names=cols)
```
