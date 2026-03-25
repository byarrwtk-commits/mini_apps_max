# AI Chat Bridge

Веб-приложение с чат-интерфейсом для общения с AI ассистентом через webhook и API.

## Установка и запуск

1. Установите зависимости:
```bash
npm install
```

2. Запустите сервер:
```bash
npm start
```
 Или для разработки:
```bash
npm run dev
```

3. Откройте браузер по адресу:
- Чат-интерфейс: http://localhost:3001
- API endpoint: http://localhost:3001/api/chat
- Webhook endpoint: http://localhost:3001/webhook
- WebSocket: ws://localhost:3002

## API Эндпоинты

### POST /api/chat
Отправка сообщения в чат

Request:
```json
{
  "message": "Ваше сообщение",
  "sessionId": "session_id"
}
```

Response:
```json
{
  "response": "Ответ AI",
  "sessionId": "session_id"
}
```

### POST /webhook
Webhook для внешних систем

Request:
```json
{
  "message": "Ваше сообщение",
  "sessionId": "session_id"
}
```

### GET /api/messages/:sessionId
Получение истории сообщений сессии

Response:
```json
{
  "messages": [
    {
      "userMessage": "Сообщение пользователя",
      "aiResponse": "Ответ AI",
      "timestamp": "2024-01-01T12:00:00.000Z"
    }
  ]
}
```

## Интеграция с AI

В файле `server.js` функция `processMessage()` должна быть дополнена для интеграции с реальным AI API.

```javascript
async function processMessage(message, sessionId) {
  // Здесь добавьте интеграцию с вашим AI провайдером
  const response = await callYourAI(message);
  return response;
}
```

## Структура проекта

```
├── server.js          # Основной сервер Express
├── public/
│   ├── index.html     # Чат-интерфейс
│   ├── style.css      # Стилизация
│   └── app.js         # Клиентский JavaScript
└── README.md          # Документация
```

## Особенности

- ✅ Real-time общение через WebSocket
- ✅ Webhook для внешних интеграций
- ✅ REST API для отправки сообщений
- ✅ Сессионное управление
- ✅ История сообщений
- ✅ Автоматическое переподключение
- ✅ Адаптивный дизайн