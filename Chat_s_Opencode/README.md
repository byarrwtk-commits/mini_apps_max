# OpenCode Чат

Веб-интерфейс для общения с OpenCode с поддержкой разных моделей.

## Установка и запуск

1. Установите зависимости:
```bash
npm install
```

2. Создайте файл `.env` с настройками:
```env
OPencode_API_KEY=your_api_key_here
PORT=3000
```

3. Запустите сервер:
```bash
npm start
```

4. Откройте в браузере: `http://localhost:3000`

## Как подключить к OpenCode

### Вариант 1: Через HTTP API

Если у OpenCode есть REST API, отредактируйте функцию `callOpenCodeAPI()` в `server.js`:

```javascript
const response = await fetch('https://your-opencode-api-endpoint.com/v1/chat/completions', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${process.env.OPencode_API_KEY}`,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        model: model,
        messages: [...history, { role: 'user', content: message }]
    })
});
```

### Вариант 2: Через Python SDK

Если OpenCode предоставляет Python SDK:

```javascript
const { spawn } = require('child_process');

async function callOpenCodeAPI(message, model, history) {
    return new Promise((resolve, reject) => {
        const python = spawn('python', ['opencode_bridge.py', message, model]);
        
        let output = '';
        python.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        python.on('close', (code) => {
            if (code === 0) resolve(output.trim());
            else reject(new Error('Python script failed'));
        });
    });
}
```

### Вариант 3: Прямая интеграция

Если OpenCode работает как локальный сервис:

```javascript
// Для локальных моделей (Ollama, LM Studio и т.д.)
async function callOpenCodeAPI(message, model) {
    const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: model,
            prompt: message,
            stream: false
        })
    });
    
    const data = await response.json();
    return data.response;
}
```

## Особенности

- Выбор модели из выпадающего списка
- Сохранение истории чата
- Real-time общение через WebSocket
- Адаптивный дизайн
- Поддержка контекста диалога