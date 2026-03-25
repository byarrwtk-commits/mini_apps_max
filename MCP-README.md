# n8n MCP Server

MCP сервер для интеграции с n8n - автоматизация рабочих процессов через Model Context Protocol.

## Установка

### 1. Установка зависимостей
```bash
npm install
```

### 2. Настройка API ключа n8n
```bash
cp .env.example .env
```

Отредактируйте `.env` файл:
```env
N8N_URL=http://localhost:5678
N8N_API_KEY=your-actual-api-key-here
```

### 3. Получение API ключа n8n
1. Откройте n8n веб-интерфейс
2. Перейдите в Настройки → API → Создать API ключ
3. Сохраните ключ в `.env` файл

### 4. Настройка MCP клиента

Добавьте в конфигурацию вашего MCP клиента:

```json
{
  "mcpServers": {
    "n8n-mcp": {
      "command": "node",
      "args": ["C:\\Users\\user\\Documents\\OPENCODE\\index.js"],
      "env": {
        "N8N_URL": "http://localhost:5678",
        "N8N_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Доступные инструменты

### 🔧 n8n_list_workflows
Получить список всех рабочих процессов
```javascript
await client.callTool('n8n_list_workflows', {
  limit: 50,
  offset: 0
});
```

### 🔧 n8n_get_workflow  
Получить детали рабочего процесса
```javascript
await client.callTool('n8n_get_workflow', {
  workflowId: 'workflow-id-here'
});
```

### 🔧 n8n_create_workflow
Создать новый рабочий процесс
```javascript
await client.callTool('n8n_create_workflow', {
  name: 'Новый рабочий процесс',
  description: 'Описание процесса',
  nodes: [],
  connections: {}
});
```

### 🔧 n8n_activate_workflow
Активировать рабочий процесс
```javascript
await client.callTool('n8n_activate_workflow', {
  workflowId: 'workflow-id-here'
});
```

### 🔧 n8n_execute_workflow
Выполнить рабочий процесс
```javascript
await client.callTool('n8n_execute_workflow', {
  workflowId: 'workflow-id-here',
  data: { key: 'value' }
});
```

### 🔧 n8n_get_executions
Получить историю выполнений
```javascript
await client.callTool('n8n_get_executions', {
  workflowId: 'workflow-id-here',
  limit: 20
});
```

### 🔧 n8n_import_workflow
Импортировать рабочий процесс из JSON
```javascript
await client.callTool('n8n_import_workflow', {
  workflowJson: './site-application-agent.json',
  name: 'Агент обработки заявок'
});
```

## Использование

### Запуск сервера
```bash
npm start
```

### Тестирование подключения
После настройки MCP клиента, проверьте инструменты:

```javascript
// Получить список рабочих процессов
const workflows = await client.callTool('n8n_list_workflows');
console.log(workflows);

// Импортировать агент обработки заявок
const importResult = await client.callTool('n8n_import_workflow', {
  workflowJson: './site-application-agent.json'
});

// Активировать импортированный рабочий процесс
const activateResult = await client.callTool('n8n_activate_workflow', {
  workflowId: importResult.workflowId
});
```

## Структура файлов

```
├── index.js          # Основной код MCP сервера
├── package.json      # Зависимости проекта
├── .env.example      # Пример конфигурации
├── .env             # Ваша конфигурация (не коммитить)
├── mcp-config.json  # Пример конфигурации MCP клиента
└── site-application-agent.json  # Агент обработки заявок
```

## API n8n

Сервер использует n8n API v1:
- Документация: https://docs.n8n.io/api/
- Требуется API ключ с правами на управление рабочими процессами

## Ошибки

### Общие ошибки
- `401 Unauthorized` - Проверьте API ключ в `.env`
- `404 Not Found` - Проверьте URL n8n в `.env`
- `Connection refused` - Убедитесь что n8n запущен

### MCP ошибки
- `InvalidParams` - Неверные параметры инструмента
- `InternalError` - Внутренняя ошибка сервера

## Разработка

### Добавление новых инструментов
В `index.js` добавьте новый инструмент в `ListToolsRequestSchema` и обработчик в `CallToolRequestSchema`.

### Тестирование
```bash
npm run dev
```

## Лицензия

MIT