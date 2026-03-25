# СНТ Берёзка-4 — Мини-приложение MAX

## Структура

```
MINI_APPS/
├── index.html          # Главное меню
├── news.html           # Новости СНТ
├── cabinet.html        # Личный кабинет (участок + задолженность)
├── register.html       # Регистрация
├── css/style.css       # Стили
├── js/app.js           # Логика (API-запросы к n8n)
└── README.md
```

## n8n Workflow

**Название:** MINI_APP_ENGINE  
**ID:** scjuXWA1W93tIFCU  
**URL:** https://vibe.umnode.ru/workflow/scjuXWA1W93tIFCU  
**Webhook URL:** `https://vibe.umnode.ru/webhook/50ee1e3b-1132-4649-84a2-b25a92a0711c`

## API эндпоинты (POST на Webhook URL)

| action           | описание                            | параметры                                  |
|------------------|-------------------------------------|--------------------------------------------|
| `get_news`       | Новости из RSS sntberezka4.ru       | `user_id`                                  |
| `check_user`     | Проверка регистрации                | `user_id`                                  |
| `register`       | Регистрация пользователя            | `user_id`, `plot`, `surname`, `phone`      |
| `get_cabinet`    | Данные участка + задолженность      | `user_id`                                  |
| `get_payments`   | История платежей (лист Платежи)     | `user_id`                                  |
| `update_contact` | Обновление номера телефона          | `user_id`, `phone`                         |

## Google Sheets

ID задаётся через `SHEET_ID` в `.env` (см. `.env.example`).

| Лист              | Назначение                           |
|-------------------|--------------------------------------|
| `РеестрСНТ`       | Основной реестр (Участок, Фамилия)   |
| `РеестрТелеграм`  | Привязка MAX user_id к участку       |
| `Должники`        | Задолженности (Участок, Задолженность)|
| `Платежи`         | История платежей (Участок, Дата, Сумма, Описание) |

## Генерация workflow

```bash
# Создать/обновить MINI_APPS/mini_app_engine_v2.json
node generate_wf.js
```

Переменные окружения для кастомизации (в `.env`):
- `SHEET_ID` — ID Google Sheets
- `GOOGLE_CRED_ID` — ID credentials в n8n
- `RSS_URL` — URL RSS-ленты

## Подключение к боту MAX

В настройках бота MAX указать URL мини-приложения:
```
https://vibe.umnode.ru/webhook/50ee1e3b-1132-4649-84a2-b25a92a0711c
```

Или разместить HTML-файлы на веб-сервере и указать их URL.

## Флоу пользователя

```
Открывает мини-приложение
        ↓
check_user → зарегистрирован?
    ├─ НЕТ → register.html
    │         (участок + фамилия + телефон)
    │         register → ищет в РеестрСНТ
    │                  → записывает в РеестрТелеграм
    └─ ДА  → index.html
                ├─ [Новости] → RSS feed
                └─ [Мой участок] → РеестрТелеграм + Должники
```
