class ChatApp {
    constructor() {
        this.ws = null;
        this.sessionId = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        this.initElements();
        this.initEventListeners();
        this.connect();
    }

    initElements() {
        this.messagesContainer = document.getElementById('messages');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.statusElement = document.getElementById('status');
        this.sessionIdElement = document.getElementById('sessionId');
    }

    initEventListeners() {
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });
    }

    connect() {
        const wsUrl = `ws://localhost:3002`;
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.updateConnectionStatus(true);
                this.reconnectAttempts = 0;
                this.enableChat();
            };
            
            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            };
            
            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.updateConnectionStatus(false);
                this.disableChat();
                this.attemptReconnect();
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.showError('Ошибка соединения');
            };
        } catch (error) {
            console.error('Failed to connect:', error);
            this.showError('Не удалось подключиться к серверу');
        }
    }

    handleMessage(data) {
        switch (data.type) {
            case 'connected':
                this.sessionId = data.sessionId;
                this.sessionIdElement.textContent = this.sessionId;
                console.log('Session ID:', this.sessionId);
                break;
                
            case 'message':
                this.addMessage(data.userMessage, 'user');
                this.addMessage(data.aiResponse, 'ai');
                break;
                
            default:
                console.log('Unknown message type:', data.type);
        }
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();
        
        if (!message) return;
        
        // Добавляем сообщение пользователя в интерфейс сразу
        this.addMessage(message, 'user');
        this.messageInput.value = '';
        this.sendButton.disabled = true;
        
        try {
            // Отправляем через WebSocket
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'message',
                    message: message
                }));
            }
            
            // И также через API как fallback
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    sessionId: this.sessionId
                })
            });
            
            const data = await response.json();
            
            if (data.response) {
                this.addMessage(data.response, 'ai');
            }
            
        } catch (error) {
            console.error('Error sending message:', error);
            this.showError('Ошибка отправки сообщения');
        } finally {
            this.sendButton.disabled = false;
            this.messageInput.focus();
        }
    }

    addMessage(content, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = content;
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = new Date().toLocaleTimeString();
        
        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(timeDiv);
        
        // Удаляем приветственное сообщение при первом сообщении
        const welcomeMessage = this.messagesContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }
        
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    updateConnectionStatus(connected) {
        if (connected) {
            this.statusElement.textContent = 'Connected';
            this.statusElement.parentElement.classList.add('connected');
        } else {
            this.statusElement.textContent = 'Disconnected';
            this.statusElement.parentElement.classList.remove('connected');
        }
    }

    enableChat() {
        this.messageInput.disabled = false;
        this.sendButton.disabled = false;
        this.messageInput.focus();
    }

    disableChat() {
        this.messageInput.disabled = true;
        this.sendButton.disabled = true;
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Reconnection attempt ${this.reconnectAttempts}`);
            
            setTimeout(() => {
                this.connect();
            }, 3000 * this.reconnectAttempts);
        } else {
            this.showError('Не удалось подключиться к серверу. Попробуйте обновить страницу.');
        }
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 1000;
            animation: fadeIn 0.3s ease-in;
        `;
        errorDiv.textContent = message;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
}

// Запускаем приложение при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});