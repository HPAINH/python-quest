# Продуктовая аналитика

## Зачем это нужно {#why}

Продуктового аналитика спрашивают не «сколько заказов», а «где мы теряем пользователей», «возвращаются ли новички» и «сколько приносит один пользователь». Ответы — воронка, когорты, retention и ARPU. Это стандарт тестовых заданий на позицию аналитика.

Работаем с набором ShopData events: `users.csv` — кто и откуда пришёл, `sessions.csv` — визиты, `events.csv` — просмотры, корзина, оформление и покупки с марта по сентябрь 2026 года.

## Воронка {#funnel}

Воронка — сколько **уникальных пользователей** дошло до каждого шага. Шаги идут по порядку: `view` → `add_to_cart` → `checkout` → `purchase`.

```python run
import pandas as pd

events = pd.read_csv("events.csv")
steps = ["view", "add_to_cart", "checkout", "purchase"]
funnel = events.groupby("event")["user_id"].nunique().reindex(steps)
print(funnel)
print((funnel / funnel.iloc[0]).round(3).tolist())
```

`reindex(steps)` расставляет шаги в порядке воронки, а не по алфавиту. Считать нужно людей (`nunique`), а не события: один пользователь мог десять раз посмотреть товар.

## Конверсия {#conversion}

Конверсия шага — доля дошедших от предыдущего шага, общая — от первого. Конверсию считают и для сессий: доля сессий, в которых была покупка.

```python run
import pandas as pd

events = pd.read_csv("events.csv")
sessions = pd.read_csv("sessions.csv")
steps = ["view", "add_to_cart", "checkout", "purchase"]
funnel = events.groupby("event")["user_id"].nunique().reindex(steps)
print((funnel / funnel.shift(1)).round(3).tolist())
bought = events.loc[events["event"] == "purchase", "session_id"].unique()
sessions["bought"] = sessions["session_id"].isin(bought)
sessions.groupby("platform")["bought"].mean().round(4)
```

Среднее булевой колонки — доля `True`, это самый короткий способ посчитать конверсию по сегментам.

## Когорты {#cohorts}

Когорта — группа пользователей, пришедших в один период, например зарегистрировавшихся в марте. Когорты сравнивают между собой: удерживаются ли июльские пользователи лучше мартовских.

```python run
import pandas as pd

users = pd.read_csv("users.csv", parse_dates=["signup_date"])
sessions = pd.read_csv("sessions.csv", parse_dates=["start_time"])
users["cohort"] = users["signup_date"].dt.to_period("M")
print(users["cohort"].value_counts().sort_index())
s = sessions.merge(users[["user_id", "cohort"]], on="user_id")
s["month"] = s["start_time"].dt.to_period("M")
s["offset"] = (s["month"] - s["cohort"]).apply(lambda d: d.n)
s[["user_id", "cohort", "month", "offset"]].head(4)
```

Разность двух периодов-месяцев — это смещение; его число месяцев лежит в атрибуте `.n`. Смещение 0 — месяц регистрации, 1 — следующий месяц и так далее.

## Retention {#retention}

Retention месяца k — доля пользователей когорты, которые были активны через k месяцев после регистрации. Таблица когорт: строки — когорты, колонки — смещения.

```python run
import pandas as pd

users = pd.read_csv("users.csv", parse_dates=["signup_date"])
sessions = pd.read_csv("sessions.csv", parse_dates=["start_time"])
users["cohort"] = users["signup_date"].dt.to_period("M")
s = sessions.merge(users[["user_id", "cohort"]], on="user_id")
s["offset"] = (s["start_time"].dt.to_period("M") - s["cohort"]).apply(lambda d: d.n)
active = s.groupby(["cohort", "offset"])["user_id"].nunique().unstack(fill_value=0)
size = users.groupby("cohort")["user_id"].nunique()
active.div(size, axis=0).round(3)
```

`unstack` разворачивает второй уровень ключа в колонки. `div(size, axis=0)` делит каждую строку на размер своей когорты. Правый нижний угол таблицы пустой: у свежих когорт ещё не прошло столько месяцев.

## ARPU и ARPPU {#arpu}

ARPU — средняя выручка на пользователя (Average Revenue Per User): вся выручка, делённая на **всех** пользователей. ARPPU — на **платящих**. Доля платящих связывает их: ARPU = ARPPU × доля платящих.

```python run
import pandas as pd

users = pd.read_csv("users.csv")
events = pd.read_csv("events.csv")
buys = events[events["event"] == "purchase"]
revenue = buys["revenue"].sum()
payers = buys["user_id"].nunique()
arpu = revenue / users["user_id"].nunique()
arppu = revenue / payers
print(round(arpu, 2), round(arppu, 2), round(payers / len(users), 4))
by_source = buys.merge(users, on="user_id").groupby("source")["revenue"].sum() / users.groupby("source").size()
by_source.round(2).sort_values(ascending=False)
```

В разрезе сегментов знаменатель — все пользователи сегмента, включая тех, кто ничего не купил. Если взять только покупателей, получится ARPPU.

## Частые ошибки {#mistakes}

События вместо уникальных людей:

```python wrong
events.groupby("event")["user_id"].count()
```

```python right
events.groupby("event")["user_id"].nunique()
```

Шаги воронки по алфавиту:

```python wrong
events.groupby("event")["user_id"].nunique()
```

```python right
events.groupby("event")["user_id"].nunique().reindex(["view", "add_to_cart", "checkout", "purchase"])
```

ARPU по покупателям вместо всех пользователей:

```python wrong
buys["revenue"].sum() / buys["user_id"].nunique()
```

```python right
buys["revenue"].sum() / users["user_id"].nunique()
```

## Шпаргалка {#cheatsheet}

```python
events.groupby("event")["user_id"].nunique().reindex(steps)   # воронка
funnel / funnel.shift(1)    funnel / funnel.iloc[0]           # конверсии
df.groupby("seg")["bought"].mean()                             # доля True
users["signup_date"].dt.to_period("M")                         # когорта
(month - cohort).apply(lambda d: d.n)                          # смещение
t.groupby(["cohort", "offset"])["user_id"].nunique().unstack(fill_value=0)
active.div(size, axis=0)                                       # retention
revenue / n_users  # ARPU      revenue / n_payers  # ARPPU
```
