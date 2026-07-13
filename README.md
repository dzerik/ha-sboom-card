# SBoom Card

[![Validate](https://github.com/dzerik/ha-sboom-card/actions/workflows/validate.yml/badge.svg)](https://github.com/dzerik/ha-sboom-card/actions/workflows/validate.yml)
[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz)
[![GitHub Release](https://img.shields.io/github/v/release/dzerik/ha-sboom-card)](https://github.com/dzerik/ha-sboom-card/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Компактная **Lovelace-карточка** плеера [SberBoom](https://github.com/dzerik/sboom_ha)
для дашбордов Home Assistant: now-playing (обложка, метаданные, скраббер),
транспорт и раскрываемый drill-down каталог Звука (поиск → артист → альбом →
трек). No-build, на Lit.

> **Требуется интеграция [`sboom_ha`](https://github.com/dzerik/sboom_ha).**
> Карточка не дублирует код — она **переиспользует** её WebSocket-API и Lit-
> компоненты (наследует общий `SboomFeedBase`, импортирует модули из статики,
> которую раздаёт сама интеграция по `/sboom_panel/…`). Без установленной
> `sboom_ha` карточка работать не будет.

## Установка

### HACS (рекомендуется)
1. HACS → Frontend → ⋮ → Custom repositories → добавить
   `https://github.com/dzerik/ha-sboom-card`, категория **Lovelace**.
2. Установить «SBoom Card». Ресурс зарегистрируется автоматически.

### Вручную
1. Скопировать `sboom-card.js` (один файл — GUI-редактор инлайн) в
   `config/www/sboom-card/`.
2. Settings → Dashboards → ⋮ → Resources → Add:
   URL `/local/sboom-card/sboom-card.js`, тип **JavaScript Module**.

## Использование

«+ Добавить карточку» → **SBoom Card** (есть превью и GUI-редактор), либо YAML:

```yaml
type: custom:sboom-card
entry_id: <config_entry колонки>   # опционально; по умолчанию первая колонка
mode: compact                       # compact | full (full = сразу с каталогом)
show_browse: false                  # раскрыть поиск/очередь
```

| Опция | Тип | По умолчанию | Описание |
|---|---|---|---|
| `entry_id` | string | первая колонка | Какую колонку показывать (мультирум). GUI-редактор подставит из списка. |
| `mode` | `compact`/`full` | `compact` | `full` раскрывает каталог сразу. |
| `show_browse` | bool | `mode==full` | Показать drill-down поиск/очередь. |

Несколько карточек с разными `entry_id` — независимы (каждая своя колонка).

## Как устроен реюз

```
sboom_ha (интеграция, раздаёт www/ на /sboom_panel)
  └─ components/sboom-feed-base.js   ← общий data-feed (подписка/devices/state)
  └─ components/sboom-{controls,browse,nowplaying,…}.js
  └─ components/sboom-tokens.css.js  ← дизайн-токены --sb-*  (тема HA)
        ▲ import "/sboom_panel/…"  (в рантайме, один общий Lit)
ha-sboom-card
  └─ sboom-card.js         SboomCard extends SboomFeedBase  → компактная раскладка
  └─ sboom-card-editor.js  GUI-редактор конфига
```

Ноль дублирования: карточка и панель делят один `SboomFeedBase`, одни компоненты
и один `lit-base`. Версия компонентов всегда совпадает с установленной `sboom_ha`.

## Разработка

Для навигации по общим компонентам в IDE подключите репозиторий интеграции как
симлинк `dev/` (в `.gitignore`), `jsconfig.json` резолвит `/sboom_panel/*` в него:

```bash
ln -s ../sboom_ha dev
```

## Лицензия

MIT
