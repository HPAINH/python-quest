# Обучение без учителя

## Зачем это нужно {#why}

Не у всех задач есть правильный ответ. Маркетингу нужны сегменты клиентов, чтобы говорить с ними по-разному, а аналитику — понять, сколько на самом деле независимых направлений в двадцати признаках. Кластеризация группирует похожие объекты, метод главных компонент (PCA) сжимает признаки до нескольких главных осей.

## KMeans {#kmeans}

KMeans ищет k центров так, чтобы сумма квадратов расстояний от точек до ближайшего центра (инерция) была минимальной. Алгоритм чередует два шага: отнести каждую точку к ближайшему центру и сдвинуть центр в среднее своих точек.

```python run
import numpy as np
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs

X, true = make_blobs(n_samples=300, centers=3, cluster_std=1.0, random_state=7)
km = KMeans(n_clusters=3, n_init=10, random_state=0).fit(X)
print(np.bincount(km.labels_), km.cluster_centers_.round(2).tolist())
print(round(km.inertia_, 1), km.predict([[0, 0]]))
```

Номера кластеров случайны: «кластер 0» в одном запуске может стать «кластером 2» в другом. `n_init` — сколько раз запустить алгоритм с разных стартов и выбрать лучший результат.

## Масштаб {#scaling}

KMeans работает с расстояниями, поэтому признак с большим разбросом подавляет остальные. Чек в тысячах рублей перевесит число заказов, и кластеры получатся просто по чеку. Перед кластеризацией признаки стандартизируют.

```python run
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

df = pd.read_csv("churn.csv")
cols = ["orders_90d", "avg_check", "days_since_last"]
X = df[cols].fillna(df[cols].median())
for name, data in [("raw", X.to_numpy()), ("scaled", StandardScaler().fit_transform(X))]:
    lab = KMeans(3, n_init=10, random_state=0).fit_predict(data)
    print(name, df.assign(c=lab).groupby("c")[cols].mean().round(1).to_dict("list"))
```

Без масштаба кластеры различаются почти только чеком; после стандартизации в игру вступают активность и давность заказов.

## Выбор числа кластеров {#choose-k}

Инерция всегда падает с ростом k, поэтому ищут «локоть» — место, где падение замедляется. Второй способ — силуэт: для каждой точки сравнивается расстояние до своего кластера и до ближайшего чужого; среднее от −1 до 1, чем больше, тем лучше разделены кластеры.

```python run
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs
from sklearn.metrics import silhouette_score

X, _ = make_blobs(n_samples=400, centers=4, cluster_std=1.2, random_state=3)
for k in range(2, 7):
    km = KMeans(k, n_init=10, random_state=0).fit(X)
    print(k, round(km.inertia_, 1), round(silhouette_score(X, km.labels_), 3))
```

Силуэт считается за квадрат от числа точек; на больших данных передают `sample_size`.

## PCA {#pca}

PCA находит новые оси — главные компоненты — вдоль которых данные меняются сильнее всего. Первая компонента объясняет наибольшую долю дисперсии, вторая — наибольшую из оставшегося, и так далее. Перед PCA признаки тоже стандартизируют.

```python run
import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

df = pd.read_csv("churn.csv")
cols = ["tenure_months", "orders_90d", "avg_check", "days_since_last", "support_tickets", "discount_share", "returns_share", "app_user", "email_opens_30d"]
Z = StandardScaler().fit_transform(df[cols].fillna(df[cols].median()))
p = PCA().fit(Z)
print(p.explained_variance_ratio_.round(3))
print(np.cumsum(p.explained_variance_ratio_).round(3))
print(PCA(2).fit_transform(Z)[:2].round(2))
```

Если доли почти равные, признаки мало связаны друг с другом и сжать их без потерь не получится — как здесь.

## Сегменты {#segments}

Кластеры полезны, когда их можно описать словами. Для этого смотрят на средние признаков в каждом кластере и на долю целевого события, например оттока.

```python run
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

df = pd.read_csv("churn.csv")
seg = ["orders_90d", "avg_check", "days_since_last", "discount_share"]
Z = StandardScaler().fit_transform(df[seg].fillna(df[seg].median()))
df["cluster"] = KMeans(4, n_init=10, random_state=0).fit_predict(Z)
profile = df.groupby("cluster").agg(size=("customer_id", "count"), days=("days_since_last", "mean"), orders=("orders_90d", "mean"), churn=("churned", "mean")).round(2)
profile.sort_values("days")
```

Так находятся «спящие» клиенты с высоким оттоком и активные покупатели — им нужны разные предложения.

## Частые ошибки {#mistakes}

KMeans без масштабирования:

```python wrong
KMeans(4).fit(df[["orders_90d", "avg_check"]])
```

```python right
KMeans(4).fit(StandardScaler().fit_transform(df[["orders_90d", "avg_check"]]))
```

Выбор k по минимальной инерции:

```python wrong
best_k = min(range(1, 10), key=lambda k: KMeans(k).fit(X).inertia_)
```

```python right
best_k = max(range(2, 10), key=lambda k: silhouette_score(X, KMeans(k).fit_predict(X)))
```

Номер кластера как смысловая метка:

```python wrong
sleeping = df[df["cluster"] == 3]
```

```python right
sleeping_id = df.groupby("cluster")["days_since_last"].mean().idxmax()
sleeping = df[df["cluster"] == sleeping_id]
```

## Шпаргалка {#cheatsheet}

```python
KMeans(n_clusters=k, n_init=10, random_state=0).fit(Z)   .labels_  .cluster_centers_  .inertia_
km.fit_predict(Z)   km.predict(new)
silhouette_score(Z, labels, sample_size=2000, random_state=0)
PCA().fit(Z).explained_variance_ratio_    np.cumsum(...)
PCA(2).fit_transform(Z)
Z = StandardScaler().fit_transform(X.fillna(X.median()))
```
