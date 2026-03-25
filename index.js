#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// n8n API Configuration
const N8N_URL = process.env.N8N_URL || 'http://localhost:5678';
const N8N_API_KEY = process.env.N8N_API_KEY;

if (!N8N_API_KEY) {
  console.error('Ошибка: N8N_API_KEY не установлен в .env файле');
  console.error('Скопируйте .env.example в .env и установите ваш API ключ');
  process.exit(1);
}

// Создаем экземпляр MCP сервера
const server = new Server(
  {
    name: 'n8n-mcp-client',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Вспомогательная функция для запросов к n8n API
async function n8nRequest(endpoint, options = {}) {
  const url = `${N8N_URL}/api/v1${endpoint}`;
  
  try {
    const response = await axios(url, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json',
      },
      ...options,
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `n8n API Error: ${error.response.status} ${JSON.stringify(error.response.data)}`
      );
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Network Error: ${error.message}`
    );
  }
}

// Определяем доступные инструменты
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'n8n_list_workflows',
        description: 'Получить список всех рабочих процессов n8n',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Максимальное количество рабочих процессов для возврата',
            },
            offset: {
              type: 'number', 
              description: 'Смещение для пагинации',
            },
          },
        },
      },
      {
        name: 'n8n_get_workflow',
        description: 'Получить детали конкретного рабочего процесса',
        inputSchema: {
          type: 'object',
          properties: {
            workflowId: {
              type: 'string',
              description: 'ID рабочего процесса',
            },
          },
          required: ['workflowId'],
        },
      },
      {
        name: 'n8n_create_workflow',
        description: 'Создать новый рабочий процесс в n8n',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Название рабочего процесса',
            },
            description: {
              type: 'string',
              description: 'Описание рабочего процесса',
            },
            nodes: {
              type: 'array',
              description: 'Массив узлов рабочего процесса',
            },
            connections: {
              type: 'object',
              description: 'Соединения между узлами',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'n8n_activate_workflow',
        description: 'Активировать рабочий процесс',
        inputSchema: {
          type: 'object',
          properties: {
            workflowId: {
              type: 'string',
              description: 'ID рабочего процесса для активации',
            },
          },
          required: ['workflowId'],
        },
      },
      {
        name: 'n8n_execute_workflow',
        description: 'Выполнить рабочий процесс',
        inputSchema: {
          type: 'object',
          properties: {
            workflowId: {
              type: 'string',
              description: 'ID рабочего процесса для выполнения',
            },
            data: {
              type: 'object',
              description: 'Данные для передачи в рабочий процесс',
            },
          },
          required: ['workflowId'],
        },
      },
      {
        name: 'n8n_get_executions',
        description: 'Получить историю выполнений',
        inputSchema: {
          type: 'object',
          properties: {
            workflowId: {
              type: 'string',
              description: 'ID рабочего процесса (опционально)',
            },
            limit: {
              type: 'number',
              description: 'Максимальное количество выполнений',
            },
          },
        },
      },
      {
        name: 'n8n_import_workflow',
        description: 'Импортировать рабочий процесс из JSON',
        inputSchema: {
          type: 'object',
          properties: {
            workflowJson: {
              type: 'string',
              description: 'JSON строка с рабочим процессом или путь к файлу',
            },
            name: {
              type: 'string',
              description: 'Название для импортируемого рабочего процесса (опционально)',
            },
          },
          required: ['workflowJson'],
        },
      },
    ],
  };
});

// Обработчики вызовов инструментов
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'n8n_list_workflows': {
        const params = new URLSearchParams();
        if (args.limit) params.append('limit', args.limit);
        if (args.offset) params.append('offset', args.offset);
        
        const workflows = await n8nRequest(`/workflows?${params}`);
        
        return {
          content: [
            {
              type: 'text',
              text: `Найдено рабочих процессов: ${workflows.data.length}\n\n` +
                workflows.data.map(w => 
                  `ID: ${w.id}\n` +
                  `Название: ${w.name}\n` +
                  `Статус: ${w.active ? 'Активен' : 'Неактивен'}\n` +
                  `Создан: ${new Date(w.createdAt).toLocaleDateString()}\n` +
                  `---`
                ).join('\n\n'),
            },
          ],
        };
      }

      case 'n8n_get_workflow': {
        const workflow = await n8nRequest(`/workflows/${args.workflowId}`);
        
        return {
          content: [
            {
              type: 'text',
              text: `Рабочий процесс: ${workflow.name} (ID: ${workflow.id})\n\n` +
                `Статус: ${workflow.active ? 'Активен' : 'Неактивен'}\n` +
                `Узлов: ${workflow.nodes.length}\n` +
                `Соединений: ${Object.keys(workflow.connections || {}).length}\n\n` +
                `Структура:\n${workflow.nodes.map(n => 
                  `- ${n.name} (${n.type})`
                ).join('\n')}`,
            },
          ],
        };
      }

      case 'n8n_create_workflow': {
        const workflowData = {
          name: args.name,
          description: args.description || '',
          nodes: args.nodes || [],
          connections: args.connections || {},
          active: false,
        };

        const workflow = await n8nRequest('/workflows', {
          method: 'POST',
          data: workflowData,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Рабочий процесс создан успешно!\n\n` +
                `ID: ${workflow.id}\n` +
                `Название: ${workflow.name}\n` +
                `URL: ${N8N_URL}/workflow/${workflow.id}`,
            },
          ],
        };
      }

      case 'n8n_activate_workflow': {
        await n8nRequest(`/workflows/${args.workflowId}/activate`, {
          method: 'PATCH',
        });

        return {
          content: [
            {
              type: 'text',
              text: `Рабочий процесс ${args.workflowId} успешно активирован`,
            },
          ],
        };
      }

      case 'n8n_execute_workflow': {
        const execution = await n8nRequest(`/workflows/${args.workflowId}/execute`, {
          method: 'POST',
          data: {
            data: args.data || {},
          },
        });

        return {
          content: [
            {
              type: 'text',
              text: `Рабочий процесс запущен!\n\n` +
                `ID выполнения: ${execution.data.executionId}\n` +
                `Статус: ${execution.data.finished ? 'Завершен' : 'В процессе'}`,
            },
          ],
        };
      }

      case 'n8n_get_executions': {
        const params = new URLSearchParams();
        if (args.workflowId) params.append('workflowId', args.workflowId);
        if (args.limit) params.append('limit', args.limit);

        const executions = await n8nRequest(`/executions?${params}`);
        
        return {
          content: [
            {
              type: 'text',
              text: `История выполнений (${executions.data.length}):\n\n` +
                executions.data.map(e => 
                  `ID: ${e.id}\n` +
                  `Рабочий процесс: ${e.workflowId}\n` +
                  `Статус: ${e.finished ? 'Завершен' : 'В процессе'}\n` +
                  `Начат: ${new Date(e.startedAt).toLocaleString()}\n` +
                  `---`
                ).join('\n\n'),
            },
          ],
        };
      }

      case 'n8n_import_workflow': {
        let workflowJson;
        
        // Если аргумент выглядит как путь к файлу
        if (args.workflowJson.startsWith('./') || args.workflowJson.startsWith('/') || args.workflowJson.endsWith('.json')) {
          const fs = await import('fs');
          const path = await import('path');
          
          const filePath = path.resolve(args.workflowJson);
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          workflowJson = JSON.parse(fileContent);
        } else {
          // Если это JSON строка
          workflowJson = JSON.parse(args.workflowJson);
        }

        // Если указано новое имя, обновляем его
        if (args.name) {
          workflowJson.name = args.name;
        }

        const workflow = await n8nRequest('/workflows', {
          method: 'POST',
          data: workflowJson,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Рабочий процесс импортирован успешно!\n\n` +
                `ID: ${workflow.id}\n` +
                `Название: ${workflow.name}\n` +
                `Узлов: ${workflow.nodes?.length || 0}\n` +
                `URL: ${N8N_URL}/workflow/${workflow.id}`,
            },
          ],
        };
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Неизвестный инструмент: ${name}`
        );
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Ошибка при выполнении ${name}: ${error.message}`
    );
  }
});

// Запускаем сервер
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('n8n MCP сервер запущен');
  console.error(`Подключен к n8n: ${N8N_URL}`);
}

main().catch((error) => {
  console.error('Ошибка запуска MCP сервера:', error);
  process.exit(1);
});