const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Раздача статических файлов
app.use(express.static(path.join(__dirname)));

// Парсинг JSON тела запроса
app.use(express.json());

// API эндпоинт для чата
app.post('/api/chat', async (req, res) => {
    try {
        const { message, model, history } = req.body;
        
        // Здесь будет интеграция с OpenCode
        const response = await callOpenCodeAPI(message, model, history);
        
        res.json({ response });
    } catch (error) {
        console.error('Chat API error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// WebSocket для real-time общения
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('chat-message', async (data) => {
        try {
            const { message, model, history } = data;
            
            // Отправка индикатора набора текста
            socket.emit('typing', true);

            // Вызов OpenCode API
            const response = await callOpenCodeAPI(message, model, history);
            
            // Отправка ответа
            socket.emit('chat-response', {
                message: response,
                model: model
            });
            
            socket.emit('typing', false);
        } catch (error) {
            console.error('Socket chat error:', error);
            socket.emit('error', 'Failed to get response');
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Функция для вызова OpenCode API
async function callOpenCodeAPI(message, model, history) {
    try {
        // Здесь должна быть реальная интеграция с OpenCode
        // Это пример того, как можно структурировать запрос
        
        // Вариант 1: HTTP запрос к OpenCode API (если он есть)
        const response = await fetch('https://api.opencode.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPencode_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    ...history,
                    { role: 'user', content: message }
                ],
                max_tokens: 1000,
                temperature: 0.7
            })
        });

        if (response.ok) {
            const data = await response.json();
            return data.choices[0].message.content;
        }
        
        // Вариант 2: Использование OpenCode SDK (если доступен)
        // const opencode = require('opencode-sdk');
        // return await opencode.chat.completions.create({
        //     model: model,
        //     messages: [...history, { role: 'user', content: message }]
        // });

        // Вариант 3: Прямой вызов через subprocess (особенно для локальных моделей)
        // const { spawn } = require('child_process');
        // return new Promise((resolve, reject) => {
        //     const python = spawn('python', ['-c', `
        //         import sys
        //         sys.path.append('.')
        //         from opencode_integration import get_response
        //         print(get_response('${message}', '${model}'))
        //     `]);
        //     
        //     let output = '';
        //     python.stdout.on('data', (data) => {
        //         output += data.toString();
        //     });
        //     
        //     python.on('close', (code) => {
        //         if (code === 0) resolve(output.trim());
        //         else reject(new Error('Python script failed'));
        //     });
        // });

        // Заглушка для демонстрации
        return `Ответ от модели ${model} на сообщение: "${message}"\n\nДля полноценной интеграции с OpenCode нужно настроить API ключ и использовать реальный эндпоинт.`;
        
    } catch (error) {
        console.error('OpenCode API call failed:', error);
        throw error;
    }
}

// Запуск сервера
server.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
    console.log('Откройте http://localhost:3000 для доступа к чату');
    console.log('API эндпоинт: http://localhost:3000/api/chat');
});