# Правильный график

## Зачем это нужно {#why}

Один и тот же набор чисел можно показать десятком способов, и только один-два ответят на вопрос заказчика с первого взгляда. Хороший график начинается не с кода, а с вопроса: что сравниваем, во времени или между группами, важна ли форма распределения.

В этом уровне задачи сформулированы вопросом, а тип графика выбираешь сам. Проверка смотрит, подходит ли тип к вопросу, и сверяет данные. Работаем с событиями сайта `events.csv`, сессиями `sessions.csv` и пользователями `users.csv`.

## Вопрос → тип графика {#choose}

| Вопрос | График |
| --- | --- |
| Как менялось во времени? | Линия |
| Кто больше, кто меньше? | Столбцы, отсортированные |
| Из чего состоит целое? | Столбцы долей или составные столбцы |
| Как распределены значения? | Гистограмма, ящик с усами |
| Связаны ли две величины? | Точечный график |

```python run
import pandas as pd
import matplotlib.pyplot as plt

sessions = pd.read_csv("sessions.csv", parse_dates=["start_time"])
fig, axes = plt.subplots(1, 3, figsize=(12, 3))
sessions.resample("W", on="start_time").size().plot(ax=axes[0], title="Во времени: линия")
sessions["source"].value_counts().plot(kind="bar", ax=axes[1], title="Сравнение: столбцы")
axes[2].hist(sessions["duration_sec"] / 60, bins=40)
axes[2].set_title("Распределение: гистограмма")
fig.tight_layout()
```

## Время {#time}

Для времени — линия, время по оси X слева направо. Шумный дневной ряд сглаживают недельным или скользящим средним. Несколько линий на одних осях сравнивают тренды групп.

```python run
import pandas as pd
import matplotlib.pyplot as plt

events = pd.read_csv("events.csv", parse_dates=["event_time"])
dau = events.resample("D", on="event_time")["user_id"].nunique()
fig, ax = plt.subplots(figsize=(8, 3))
ax.plot(dau.index, dau.values, alpha=0.4, label="по дням")
ax.plot(dau.index, dau.rolling(7).mean().values, label="среднее за 7 дней")
ax.set_title("Активные пользователи")
ax.legend()
```

## Сравнение {#compare}

Для сравнения групп — столбцы, отсортированные по значению. Если групп больше 8–10, оставляют топ и, при необходимости, «прочее». Длинные подписи — горизонтальные столбцы.

```python run
import pandas as pd
import matplotlib.pyplot as plt

users = pd.read_csv("users.csv")
events = pd.read_csv("events.csv")
buyers = events.loc[events["event"] == "purchase", "user_id"].unique()
conv = users.assign(buyer=users["user_id"].isin(buyers)).groupby("source")["buyer"].mean().sort_values(ascending=False)
fig, ax = plt.subplots(figsize=(6, 3))
ax.bar(conv.index, conv.values * 100)
ax.set_title("Доля покупателей по источнику")
ax.set_ylabel("%")
print(conv.round(3))
```

Столбцы всегда начинаются с нуля: высота столбца — это величина. Обрезанная ось превращает разницу в 2% в «двукратный» разрыв.

## Части целого {#parts}

Круговая диаграмма плохо читается: глаз плохо сравнивает углы, особенно близкие. Те же доли понятнее столбцами, а изменение структуры во времени — составными столбцами.

```python run
import pandas as pd
import matplotlib.pyplot as plt

sessions = pd.read_csv("sessions.csv", parse_dates=["start_time"])
share = pd.crosstab(sessions["start_time"].dt.to_period("M"), sessions["platform"], normalize="index")
fig, ax = plt.subplots(figsize=(7, 3))
share.plot(kind="bar", stacked=True, ax=ax)
ax.set_title("Доля сессий по платформам")
ax.set_ylabel("доля")
print(share.round(3).tail(2))
```

## Распределения {#distribution}

Гистограмма показывает форму одного распределения, ящики с усами — сравнение нескольких. Для величин с длинным хвостом (длительность, выручка) удобно ограничить ось разумным квантилем или перейти к логарифму.

```python run
import pandas as pd
import matplotlib.pyplot as plt

sessions = pd.read_csv("sessions.csv")
d = sessions["duration_sec"] / 60
fig, axes = plt.subplots(1, 2, figsize=(9, 3))
axes[0].hist(d, bins=40)
axes[0].set_title("Длительность, мин")
axes[1].hist(d[d <= d.quantile(0.95)], bins=40)
axes[1].set_title("Без верхних 5%")
print(round(d.median(), 1), round(d.quantile(0.95), 1))
```

## Частые ошибки {#mistakes}

Круговая диаграмма для сравнения долей:

```python wrong
ax.pie(share.values, labels=share.index)
```

```python right
ax.bar(share.index, share.values)
```

Столбцы для динамики по дням — сотни узких столбцов вместо тренда:

```python wrong
ax.bar(dau.index, dau.values)
```

```python right
ax.plot(dau.index, dau.values)
```

Неотсортированные столбцы и все категории сразу:

```python wrong
s.plot(kind="bar")
```

```python right
s.nlargest(10).sort_values().plot(kind="barh")
```

## Шпаргалка {#cheatsheet}

```python
# время → линия           ax.plot(s.index, s.values); s.rolling(7).mean()
# сравнение → столбцы     s.sort_values(ascending=False).plot(kind="bar")
# много категорий → топ   s.nlargest(10).sort_values().plot(kind="barh")
# части целого → столбцы  pd.crosstab(a, b, normalize="index").plot(kind="bar", stacked=True)
# распределение           ax.hist(x, bins=40); sns.boxplot(...)
# связь                   ax.scatter(x, y, alpha=.4)
```
