class VirtualAssistantApp {
    constructor() {
        this.token = localStorage.getItem('token');
        this.user = null;
        this.currentSection = 'chat';
        this.isRecording = false;
        this.recognition = null;
        this.speechSynthesis = window.speechSynthesis;
        this.currentChatId = null;
        this.chatHistory = [];
        this.currentMessages = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        if (this.token) {
            this.validateToken();
        } else {
            this.showLogin();
        }
    }

    setupEventListeners() {
        // New Chat button
        document.getElementById('newChatBtn').addEventListener('click', () => {
            this.startNewChat();
        });

        // Khởi tạo Web Speech API
        if ('webkitSpeechRecognition' in window) {
            this.recognition = new webkitSpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.lang = 'vi-VN';
            
            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                document.getElementById('messageInput').value = transcript;
                this.isRecording = false;
                document.getElementById('micButton').classList.remove('bg-red-500');
            };
            
            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.isRecording = false;
                document.getElementById('micButton').classList.remove('bg-red-500');
            };
        }

        // Form switching
        const showLoginBtn = document.getElementById('showLoginBtn');
        const showRegisterBtn = document.getElementById('showRegisterBtn');
        const loginForm = document.getElementById('login');
        const registerForm = document.getElementById('register');

        // Mic button
        document.getElementById('micButton').addEventListener('click', () => {
            if (!this.isRecording) {
                this.startRecording();
            } else {
                this.stopRecording();
            }
        });

        showLoginBtn.addEventListener('click', () => {
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
            showLoginBtn.classList.add('text-blue-600', 'border-blue-600');
            showLoginBtn.classList.remove('text-gray-500', 'border-transparent');
            showRegisterBtn.classList.remove('text-blue-600', 'border-blue-600');
            showRegisterBtn.classList.add('text-gray-500', 'border-transparent');
        });

        showRegisterBtn.addEventListener('click', () => {
            registerForm.classList.remove('hidden');
            loginForm.classList.add('hidden');
            showRegisterBtn.classList.add('text-blue-600', 'border-blue-600');
            showRegisterBtn.classList.remove('text-gray-500', 'border-transparent');
            showLoginBtn.classList.remove('text-blue-600', 'border-blue-600');
            showLoginBtn.classList.add('text-gray-500', 'border-transparent');
        });

        // Login form
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        // Register form
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.register();
        });

        // Logout
        document.getElementById('logout').addEventListener('click', () => {
            this.logout();
        });

        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchSection(e.target.dataset.section);
            });
        });

        // Chat form
        document.getElementById('chatForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });

        // Document search
        document.getElementById('documentSearch').addEventListener('input', (e) => {
            this.searchDocuments(e.target.value);
        });
    }

    async login() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem('token', this.token);
                this.showApp();
            } else {
                alert(data.message || 'Đăng nhập thất bại');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Có lỗi xảy ra khi đăng nhập');
        }
    }

    async register() {
        const form = document.getElementById('register');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        // Validate department selection
        if (!data.department) {
            alert('Vui lòng chọn phòng ban');
            return;
        }

        try {
            console.log('Sending registration data:', data);
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const responseData = await response.json();
            console.log('Registration response:', responseData);

            if (response.ok) {
                alert('Đăng ký thành công! Vui lòng đăng nhập.');
                document.getElementById('showLoginBtn').click();
                form.reset();
            } else {
                alert(responseData.message || 'Đăng ký thất bại');
            }
        } catch (error) {
            console.error('Register error:', error);
            alert('Có lỗi xảy ra khi đăng ký');
        }
    }

    async validateToken() {
        try {
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.user = data.user;
                this.showApp();
            } else {
                this.logout();
            }
        } catch (error) {
            console.error('Token validation error:', error);
            this.logout();
        }
    }

    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('token');
        this.showLogin();
    }

    showLogin() {
        document.getElementById('loginForm').classList.remove('hidden');
        document.getElementById('app').classList.add('hidden');
        document.getElementById('login').classList.remove('hidden');
        document.getElementById('register').classList.add('hidden');
        document.getElementById('showLoginBtn').classList.add('text-blue-600', 'border-blue-600');
        document.getElementById('showRegisterBtn').classList.remove('text-blue-600', 'border-blue-600');
    }

    showApp() {
        document.getElementById('loginForm').classList.add('hidden');
        const appContainer = document.getElementById('app');
        appContainer.classList.remove('hidden');
        // Add chat-section-active class since chat is the default section
        appContainer.classList.add('chat-section-active');
        this.updateUserInfo();
        this.loadInitialData();
    }

    updateUserInfo() {
        const userInfo = document.getElementById('userInfo');
        userInfo.textContent = `${this.user.name} - ${this.user.department} (${this.user.role})`;
    }

    switchSection(section) {
        // Hide all sections
        document.querySelectorAll('.section-content').forEach(el => {
            el.classList.add('hidden');
        });

        // Show selected section
        document.getElementById(`${section}Section`).classList.remove('hidden');

        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('bg-blue-100', 'text-blue-700');
        });
        document.querySelector(`[data-section="${section}"]`).classList.add('bg-blue-100', 'text-blue-700');

        // Show/hide chat history sidebar based on section
        const appContainer = document.getElementById('app');
        if (section === 'chat') {
            appContainer.classList.add('chat-section-active');
        } else {
            appContainer.classList.remove('chat-section-active');
        }

        this.currentSection = section;

        // Load section data
        this.loadSectionData(section);
    }

    async loadInitialData() {
        await this.loadChatHistory();
        this.startNewChat();
        this.loadSectionData('chat');
    }

    async loadChatHistory() {
        try {
            const response = await fetch('/api/assistant-chat/history', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.chatHistory = data.history;
                this.updateChatHistoryList();
            }
        } catch (error) {
            console.error('Load chat history error:', error);
        }
    }

    updateChatHistoryList() {
        const container = document.getElementById('chatHistoryList');
        container.innerHTML = '';

        this.chatHistory.forEach(chat => {
            const chatElement = document.createElement('div');
            chatElement.className = `p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 ${
                chat.id === this.currentChatId ? 'bg-blue-50 dark:bg-gray-600' : ''
            }`;
            
            // Lấy tin nhắn đầu tiên làm tiêu đề
            const firstMessage = chat.messages[0]?.content || 'Cuộc trò chuyện mới';
            const preview = firstMessage.length > 50 ? firstMessage.substring(0, 50) + '...' : firstMessage;
            
            chatElement.innerHTML = `
                <div class="flex justify-between items-start">
                    <div class="flex-1 cursor-pointer">
                        <div class="text-sm font-medium text-gray-900 dark:text-white">${preview}</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">
                            ${new Date(chat.createdAt).toLocaleDateString()}
                        </div>
                    </div>
                    <button class="delete-chat-btn ml-2 p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                        </svg>
                    </button>
                </div>
            `;

            const deleteBtn = chatElement.querySelector('.delete-chat-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteChat(chat.id);
            });

            const chatContent = chatElement.querySelector('.flex-1');
            chatContent.addEventListener('click', () => this.loadChat(chat.id));
            
            container.appendChild(chatElement);
        });
    }

    async deleteChat(chatId) {
        if (!confirm('Bạn có chắc chắn muốn xóa cuộc trò chuyện này?')) {
            return;
        }

        try {
            const response = await fetch(`/api/assistant-chat/${chatId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                // Nếu xóa chat hiện tại, chuyển sang chat mới
                if (chatId === this.currentChatId) {
                    this.startNewChat();
                }
                // Cập nhật lại danh sách chat
                await this.loadChatHistory();
            } else {
                alert('Không thể xóa cuộc trò chuyện');
            }
        } catch (error) {
            console.error('Delete chat error:', error);
            alert('Có lỗi xảy ra khi xóa cuộc trò chuyện');
        }
    }

    async loadChat(chatId) {
        try {
            const response = await fetch(`/api/assistant-chat/${chatId}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.currentChatId = chatId;
                this.currentMessages = data.messages;
                this.displayMessages();
                this.updateChatHistoryList();
            }
        } catch (error) {
            console.error('Load chat error:', error);
        }
    }

    async startNewChat() {
        // Lưu chat hiện tại nếu có tin nhắn
        if (this.currentChatId && this.currentMessages.length > 0) {
            try {
                await fetch(`/api/assistant-chat/${this.currentChatId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.token}`
                    },
                    body: JSON.stringify({
                        messages: this.currentMessages
                    })
                });
            } catch (error) {
                console.error('Save chat error:', error);
            }
        }

        // Bắt đầu chat mới
        this.currentChatId = null;
        this.currentMessages = [];
        document.getElementById('chatMessages').innerHTML = '';
        this.addWelcomeMessage();
        await this.loadChatHistory();
    }

    addWelcomeMessage() {
        const messagesContainer = document.getElementById('chatMessages');
        const welcomeMessage = this.createMessageElement(
            `Xin chào ${this.user.name}! Tôi là trợ lý ảo của công ty Khải Đỗ. Tôi có thể giúp bạn:
            
            • Tìm kiếm tài liệu công ty
            • Quản lý lịch họp và công việc
            • Trả lời câu hỏi về chính sách công ty
            • Hỗ trợ các thủ tục nội bộ
            
            Bạn cần tôi giúp gì?`,
            'assistant'
        );
        messagesContainer.appendChild(welcomeMessage);
    }

    async sendMessage() {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();
        
        if (!message) return;

        // Add user message to UI
        this.addMessage(message, 'user');
        // Add to current messages array
        this.currentMessages.push({ content: message, sender: 'user' });
        input.value = '';

        try {
            const response = await fetch('/api/assistant/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ 
                    message,
                    chatId: this.currentChatId 
                })
            });

            const data = await response.json();

            if (response.ok) {
                // Add assistant response to UI
                this.addMessage(data.response, 'assistant');
                // Add to current messages array
                this.currentMessages.push({ content: data.response, sender: 'assistant' });

                if (!this.currentChatId) {
                    // If this is a new chat, create it
                    const createResponse = await fetch('/api/assistant-chat', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${this.token}`
                        }
                    });

                    if (createResponse.ok) {
                        const chatData = await createResponse.json();
                        this.currentChatId = chatData.id;
                    }
                }

                // Save the updated messages
                if (this.currentChatId) {
                    await fetch(`/api/assistant-chat/${this.currentChatId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${this.token}`
                        },
                        body: JSON.stringify({
                            messages: this.currentMessages
                        })
                    });
                }

                await this.loadChatHistory();
            } else {
                this.addMessage('Xin lỗi, tôi không thể xử lý yêu cầu của bạn lúc này.', 'assistant');
            }
        } catch (error) {
            console.error('Chat error:', error);
            this.addMessage('Có lỗi xảy ra khi gửi tin nhắn.', 'assistant');
        }
    }

    displayMessages() {
        const container = document.getElementById('chatMessages');
        container.innerHTML = '';
        
        this.currentMessages.forEach(msg => {
            this.addMessage(msg.content, msg.sender);
        });
    }

    addMessage(content, sender) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageElement = this.createMessageElement(content, sender);
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    createMessageElement(content, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `flex ${sender === 'user' ? 'justify-end' : 'justify-start'}`;

        const container = document.createElement('div');
        container.className = 'flex items-end space-x-2';

        const bubble = document.createElement('div');
        bubble.className = `max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
            sender === 'user' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
        }`;
        bubble.innerHTML = content.replace(/\n/g, '<br>');

        // Thêm nút phát âm thanh cho tin nhắn của assistant
        if (sender === 'assistant') {
            const speakButton = document.createElement('button');
            speakButton.className = 'p-1 rounded-full bg-gray-100 hover:bg-gray-200 focus:outline-none';
            speakButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.816L4.846 14H2a1 1 0 01-1-1V7a1 1 0 011-1h2.846l3.537-2.816a1 1 0 011.617.816zM16 10a3 3 0 01-3 3v-2a1 1 0 001-1 1 1 0 00-1-1v-2a3 3 0 013 3z" clip-rule="evenodd" />
                    <path d="M18 10a5 5 0 01-5 5v-2a3 3 0 003-3 3 3 0 00-3-3V5a5 5 0 015 5z" />
                </svg>
            `;
            speakButton.addEventListener('click', () => {
                this.speakText(content);
            });

            container.appendChild(bubble);
            container.appendChild(speakButton);
        } else {
            container.appendChild(bubble);
        }

        messageDiv.appendChild(container);
        return messageDiv;
    }

    // Phương thức bắt đầu ghi âm
    startRecording() {
        if (!this.recognition) {
            alert('Trình duyệt không hỗ trợ nhận dạng giọng nói');
            return;
        }

        this.isRecording = true;
        document.getElementById('micButton').classList.add('bg-red-500', 'text-white');
        this.recognition.start();
    }

    // Phương thức dừng ghi âm
    stopRecording() {
        if (this.recognition) {
            this.recognition.stop();
        }
        this.isRecording = false;
        document.getElementById('micButton').classList.remove('bg-red-500', 'text-white');
    }

    // Phương thức phát âm thanh
    speakText(text) {
        // Dừng tất cả âm thanh đang phát
        this.speechSynthesis.cancel();

        // Tạo utterance mới
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'vi-VN';
        utterance.rate = 0.9;
        utterance.pitch = 1;

        // Phát âm thanh
        this.speechSynthesis.speak(utterance);
    }

    async loadSectionData(section) {
        switch (section) {
            case 'documents':
                await this.loadDocuments();
                break;
            case 'meetings':
                await this.loadMeetings();
                break;
            case 'tasks':
                await this.loadTasks();
                break;
        }
    }

    async loadDocuments() {
        try {
            const response = await fetch('/api/documents', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                this.displayDocuments(data.documents);
            }
        } catch (error) {
            console.error('Load documents error:', error);
        }
    }

    displayDocuments(documents) {
        const container = document.getElementById('documentsList');
        container.innerHTML = '';

        documents.forEach(doc => {
            const docElement = document.createElement('div');
            docElement.className = 'border border-gray-200 dark:border-gray-700 rounded-lg p-4';
            docElement.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-semibold text-gray-900 dark:text-white">${doc.title}</h3>
                        <p class="text-sm text-gray-600 dark:text-gray-400">${doc.category} • ${doc.department}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            Cập nhật: ${new Date(doc.updatedAt).toLocaleDateString()}
                        </p>
                    </div>
                    <span class="px-2 py-1 text-xs rounded-full ${this.getAccessLevelColor(doc.accessLevel)}">
                        ${this.getAccessLevelText(doc.accessLevel)}
                    </span>
                </div>
            `;
            container.appendChild(docElement);
        });
    }

    getAccessLevelColor(level) {
        const colors = {
            'public': 'bg-green-100 text-green-800',
            'department': 'bg-blue-100 text-blue-800',
            'management': 'bg-yellow-100 text-yellow-800',
            'confidential': 'bg-red-100 text-red-800'
        };
        return colors[level] || 'bg-gray-100 text-gray-800';
    }

    getAccessLevelText(level) {
        const texts = {
            'public': 'Công khai',
            'department': 'Phòng ban',
            'management': 'Quản lý',
            'confidential': 'Bí mật'
        };
        return texts[level] || level;
    }

    async searchDocuments(query) {
        if (!query.trim()) {
            this.loadDocuments();
            return;
        }

        try {
            const response = await fetch(`/api/assistant/search?query=${encodeURIComponent(query)}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                this.displaySearchResults(data.results);
            }
        } catch (error) {
            console.error('Search error:', error);
        }
    }

    displaySearchResults(results) {
        const container = document.getElementById('documentsList');
        container.innerHTML = '';

        if (results.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8">Không tìm thấy tài liệu nào</p>';
            return;
        }

        results.forEach(result => {
            const resultElement = document.createElement('div');
            resultElement.className = 'border border-gray-200 dark:border-gray-700 rounded-lg p-4';
            resultElement.innerHTML = `
                <h3 class="font-semibold text-gray-900 dark:text-white">${result.title}</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">${result.category}</p>
                <p class="text-sm text-gray-700 dark:text-gray-300 mt-2">${result.preview}</p>
                <div class="mt-2">
                    <span class="text-xs text-blue-600">Độ liên quan: ${result.relevance}</span>
                </div>
            `;
            container.appendChild(resultElement);
        });
    }

    async loadMeetings() {
        // Placeholder for meetings functionality
        const container = document.getElementById('meetingsList');
        container.innerHTML = '<p class="text-gray-500 text-center py-8">Chức năng đang được phát triển</p>';
    }

    async loadTasks() {
        // Placeholder for tasks functionality
        const container = document.getElementById('tasksList');
        container.innerHTML = '<p class="text-gray-500 text-center py-8">Chức năng đang được phát triển</p>';
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new VirtualAssistantApp();
});
