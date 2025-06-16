 document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    if (token) {
        showMainApp();
        return;
    }

    // Form elements
    const loginForm = document.getElementById('login');
    const registerForm = document.getElementById('register');
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    const deleteAccountForm = document.getElementById('deleteAccountForm');
    const verificationCodeSection = document.getElementById('verificationCodeSection');
    const newPasswordSection = document.getElementById('newPasswordSection');

    // Button elements
    const showLoginBtn = document.getElementById('showLoginBtn');
    const showRegisterBtn = document.getElementById('showRegisterBtn');
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    const backToLoginBtn = document.getElementById('backToLoginBtn');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const sendCodeBtn = document.getElementById('sendCodeBtn');

    // Show/Hide form functions
    const showForm = (formToShow, ...formsToHide) => {
        formToShow.classList.remove('hidden');
        formsToHide.forEach(form => form.classList.add('hidden'));
    };

    // Function to show main app
    function showMainApp() {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        loadUserInfo();
        initializeMainApp();
    }

    // Function to load user info
    async function loadUserInfo() {
        try {
            const response = await fetch('/api/company/info', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                document.getElementById('userInfo').textContent = `Chào mừng đến với ${data.name}`;
            }
        } catch (error) {
            console.error('Error loading user info:', error);
        }
    }

    // Function to initialize main app functionality
    function initializeMainApp() {
        // Navigation
        const navButtons = document.querySelectorAll('.nav-btn');
        const sections = document.querySelectorAll('.section-content');

        navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetSection = btn.dataset.section;
                
                // Update active nav button
                navButtons.forEach(b => b.classList.remove('bg-blue-100', 'text-blue-700'));
                btn.classList.add('bg-blue-100', 'text-blue-700');
                
                // Show target section
                sections.forEach(section => section.classList.add('hidden'));
                const targetSectionElement = document.getElementById(targetSection + 'Section');
                targetSectionElement.classList.remove('hidden');
                
                // Add/remove chat-section-active class to control sidebar visibility
                document.body.classList.remove('chat-section-active');
                if (targetSection === 'chat') {
                    document.body.classList.add('chat-section-active');
                    loadChatHistory(); // Load chat history when switching to chat section
                }
            });
        });

        // Logout functionality
        document.getElementById('logout').addEventListener('click', () => {
            localStorage.removeItem('token');
            window.location.reload();
        });

        // Initialize functionalities
        initializeChat();
        initializeMailbox();
        initializeDocuments();
        initializeUsers();
        initializeMeetings();
        
        // Set default active section
        document.querySelector('[data-section="chat"]').click();

        // Users Management
        function initializeUsers() {
            const usersSection = document.getElementById('usersSection');
            const userSearch = document.getElementById('userSearch');
            const refreshUsers = document.getElementById('refreshUsers');
            const accessDeniedMessage = document.getElementById('accessDeniedMessage');
            
            // Check if user has IT department access
            fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.department !== 'IT') {
                    accessDeniedMessage.classList.remove('hidden');
                    document.getElementById('usersTableContainer').classList.add('hidden');
                    userSearch.disabled = true;
                    refreshUsers.disabled = true;
                } else {
                    loadUsers();
                }
            })
            .catch(error => {
                console.error('Error checking user access:', error);
            });

            // Load users function
            async function loadUsers(searchQuery = '') {
                try {
                    let url = '/api/users';
                    if (searchQuery) {
                        url += `?search=${encodeURIComponent(searchQuery)}`;
                    }

                    const response = await fetch(url, {
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        }
                    });

                    if (response.ok) {
                        const { users } = await response.json();
                        displayUsers(users);
                    }
                } catch (error) {
                    console.error('Error loading users:', error);
                }
            }

            // Display users function
            function displayUsers(users) {
                const tbody = document.getElementById('usersTableBody');
                const loadingMessage = document.getElementById('usersLoadingMessage');
                const emptyMessage = document.getElementById('usersEmptyMessage');

                loadingMessage.classList.add('hidden');

                if (!users || users.length === 0) {
                    tbody.innerHTML = '';
                    emptyMessage.classList.remove('hidden');
                    return;
                }

                emptyMessage.classList.add('hidden');
                tbody.innerHTML = users.map(user => `
                    <tr>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            ${user.name}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            ${user.email}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            ${user.department}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            ${user.position}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            ${user.role || 'User'}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            ${user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Chưa đăng nhập'}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            ${new Date(user.createdAt).toLocaleDateString()}
                        </td>
                    </tr>
                `).join('');
            }

            // Search functionality
            let searchTimeout;
            userSearch.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    loadUsers(userSearch.value);
                }, 300);
            });

            // Refresh functionality
            refreshUsers.addEventListener('click', () => {
                userSearch.value = '';
                loadUsers();
            });
        }
    }

    // Chat functionality
    let currentChatId = null;
    let messageCount = 0;
    const MESSAGE_LIMIT = 10;
    let recognition = null;

    // Helper function to format timestamps
    function formatTimestamp(date) {
        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 7) {
            return date.toLocaleDateString('vi-VN');
        } else if (days > 0) {
            return `${days} ngày trước`;
        } else if (hours > 0) {
            return `${hours} giờ trước`;
        } else if (minutes > 0) {
            return `${minutes} phút trước`;
        } else {
            return 'Vừa xong';
        }
    }

    function initializeChat() {
        const chatForm = document.getElementById('chatForm');
        const messageInput = document.getElementById('messageInput');
        const chatMessages = document.getElementById('chatMessages');
        const newChatBtn = document.getElementById('newChatBtn');
        const sendButton = document.getElementById('sendButton');
        const micButton = document.getElementById('micButton');
        const chatContainer = document.getElementById('chatContainer');

        // Show loading state
        chatMessages.innerHTML = `
            <div class="flex items-center justify-center h-full">
                <div class="text-center p-4">
                    <div class="flex justify-center space-x-2 mb-4">
                        <div class="w-3 h-3 bg-blue-600 rounded-full animate-bounce"></div>
                        <div class="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                        <div class="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
                    </div>
                    <p class="text-gray-500">Đang tải cuộc trò chuyện...</p>
                </div>
            </div>
        `;

        // Disable inputs while loading
        if (messageInput) messageInput.disabled = true;
        if (sendButton) sendButton.disabled = true;
        if (newChatBtn) newChatBtn.disabled = true;

        // Initialize speech recognition if available
        if ('webkitSpeechRecognition' in window && micButton) {
            recognition = new webkitSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'vi-VN';

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                messageInput.value = transcript;
                micButton.classList.remove('bg-red-100');
                micButton.classList.add('bg-gray-100');
            };

            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                micButton.classList.remove('bg-red-100');
                micButton.classList.add('bg-gray-100');
            };

            recognition.onend = () => {
                micButton.classList.remove('bg-red-100');
                micButton.classList.add('bg-gray-100');
            };

            // Mic button click handler
            micButton.addEventListener('click', () => {
                if (recognition.started) {
                    recognition.stop();
                    micButton.classList.remove('bg-red-100');
                    micButton.classList.add('bg-gray-100');
                } else {
                    recognition.start();
                    micButton.classList.remove('bg-gray-100');
                    micButton.classList.add('bg-red-100');
                }
            });
        } else {
            micButton.style.display = 'none';
        }
        
        // Initialize chat state
        const initializeState = async () => {
            try {
                // Create new chat if no active chat exists
                const activeChat = await loadActiveChat();
                if (!activeChat) {
                    await createNewChat();
                }
                await loadChatHistory();
            } catch (error) {
                console.error('Error initializing chat:', error);
                // Show error message to user
                const chatMessages = document.getElementById('chatMessages');
                chatMessages.innerHTML = `
                    <div class="text-center p-4 text-gray-500">
                        <p>Không thể tải tin nhắn. Vui lòng thử lại.</p>
                        <button onclick="initializeState()" class="mt-2 px-4 py-2 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200">
                            Tải lại
                        </button>
                    </div>
                `;
            }
        };

        // Initialize chat state when chat section is shown
        document.querySelector('[data-section="chat"]').addEventListener('click', () => {
            initializeState();
        });

        // Also initialize on first load
        initializeState();
        
        // New chat button
        if (newChatBtn) {
            newChatBtn.addEventListener('click', async () => {
                try {
                    await createNewChat();
                } catch (error) {
                    console.error('Error creating new chat:', error);
                    alert('Không thể tạo cuộc trò chuyện mới. Vui lòng thử lại.');
                }
            });
        }
        
        // Company question buttons - wait for DOM to be ready
        setTimeout(() => {
            const companyQuestionBtns = document.querySelectorAll('.company-question-btn');
            companyQuestionBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const question = btn.dataset.question;
                    if (question) {
                        messageInput.value = question;
                        sendMessage();
                    }
                });
            });
        }, 100);

        // Handle chat form submission
        function sendMessage() {
            const message = messageInput.value.trim();
            if (!message) return;

            // Check message limit
            if (messageCount >= MESSAGE_LIMIT) {
                alert(`Bạn đã đạt giới hạn ${MESSAGE_LIMIT} tin nhắn. Vui lòng tạo cuộc trò chuyện mới.`);
                return;
            }

            // Disable send button temporarily
            if (sendButton) {
                sendButton.disabled = true;
                sendButton.textContent = 'Đang gửi...';
            }

            // Get current timestamp
            const timestamp = new Date();

            // Add user message to chat
            addMessageToChat('user', message, timestamp);
            messageInput.value = '';
            
            // Update message count
            messageCount++;
            updateMessageCounter();

            // Show loading indicator
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'flex justify-start mb-4';
            loadingDiv.innerHTML = `
                <div class="flex flex-col max-w-xs lg:max-w-2xl">
                    <div class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white mr-auto rounded-r-lg rounded-bl-lg shadow-sm">
                        <div class="flex items-center space-x-2">
                            <div class="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                            <div class="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                            <div class="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
                        </div>
                    </div>
                </div>
            `;
            chatMessages.appendChild(loadingDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            // Send message to server
            fetch('/api/assistant/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ 
                    message,
                    chatId: currentChatId 
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.response) {
                    addMessageToChat('assistant', data.response);
                }
                if (data.chat) {
                    currentChatId = data.chat._id;
                    // Update message count based on actual messages
                    messageCount = data.chat.messages.filter(msg => msg.sender === 'user').length;
                    updateMessageCounter();
                }
                loadChatHistory(); // Refresh chat history
            })
            .catch(error => {
                console.error('Chat error:', error);
                // Remove loading indicator
                loadingDiv.remove();
                // Show error message
                addMessageToChat('assistant', 'Có lỗi xảy ra khi kết nối với trợ lý. Vui lòng thử lại sau.', new Date());
            })
            .finally(() => {
                // Remove loading indicator
                loadingDiv.remove();
                
                // Re-enable send button
                if (sendButton) {
                    sendButton.disabled = false;
                    sendButton.textContent = 'Gửi';
                }
                
                // Disable input and button if limit reached
                if (messageCount >= MESSAGE_LIMIT) {
                    messageInput.disabled = true;
                    if (sendButton) {
                        sendButton.disabled = true;
                    }
                    messageInput.placeholder = 'Đã đạt giới hạn tin nhắn. Tạo cuộc trò chuyện mới để tiếp tục.';
                }

                // Scroll to bottom
                chatMessages.scrollTop = chatMessages.scrollHeight;
            });
        }
        
        // Form submit event
        if (chatForm) {
            chatForm.addEventListener('submit', (e) => {
                e.preventDefault();
                sendMessage();
            });
        }
        
        // Send button click event
        if (sendButton) {
            sendButton.addEventListener('click', (e) => {
                e.preventDefault();
                sendMessage();
            });
        }
        
        // Enter key press event
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
        }
    }

    function updateMessageCounter() {
        const messageCountElement = document.getElementById('messageCount');
        const messageLimitIndicator = document.getElementById('messageLimitIndicator');
        
        if (messageCountElement) {
            messageCountElement.textContent = messageCount;
        }
        
        // Update indicator color based on usage
        if (messageCount >= MESSAGE_LIMIT) {
            messageLimitIndicator.className = 'px-4 py-2 bg-red-50 border-t border-red-200 text-sm text-red-800';
        } else if (messageCount >= MESSAGE_LIMIT * 0.8) {
            messageLimitIndicator.className = 'px-4 py-2 bg-orange-50 border-t border-orange-200 text-sm text-orange-800';
        } else {
            messageLimitIndicator.className = 'px-4 py-2 bg-yellow-50 border-t border-yellow-200 text-sm text-yellow-800';
        }
    }

    async function loadActiveChat() {
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');
        const newChatBtn = document.getElementById('newChatBtn');
        const chatMessages = document.getElementById('chatMessages');

        try {
            const response = await fetch('/api/assistant/active', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.chat) {
                    currentChatId = data.chat._id;
                    // Reset message count based on existing messages
                    messageCount = data.chat.messages.filter(msg => msg.sender === 'user').length;
                    updateMessageCounter();
                    displayChatMessages(data.chat.messages);
                    
                    // Enable/disable input based on message count
                    if (messageCount >= MESSAGE_LIMIT) {
                        if (messageInput) {
                            messageInput.disabled = true;
                            messageInput.placeholder = 'Đã đạt giới hạn tin nhắn. Tạo cuộc trò chuyện mới để tiếp tục.';
                        }
                        if (sendButton) sendButton.disabled = true;
                    } else {
                        if (messageInput) {
                            messageInput.disabled = false;
                            messageInput.placeholder = 'Nhập tin nhắn...';
                        }
                        if (sendButton) sendButton.disabled = false;
                    }

                    // Re-enable the new chat button
                    if (newChatBtn) newChatBtn.disabled = false;

                    return data.chat; // Return the active chat
                }
            }
            return null; // Return null if no active chat found
        } catch (error) {
            console.error('Error loading active chat:', error);
            chatMessages.innerHTML = `
                <div class="flex items-center justify-center h-full">
                    <div class="text-center p-4">
                        <p class="text-gray-500 mb-4">Không thể tải cuộc trò chuyện. Vui lòng thử lại.</p>
                        <button onclick="initializeState()" 
                                class="px-4 py-2 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200">
                            Tải lại
                        </button>
                    </div>
                </div>
            `;
            return null;
        }
    }
    async function createNewChat() {
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');
        const newChatBtn = document.getElementById('newChatBtn');
        const chatMessages = document.getElementById('chatMessages');

        // Show loading state
        chatMessages.innerHTML = `
            <div class="flex items-center justify-center h-full">
                <div class="text-center p-4">
                    <div class="flex justify-center space-x-2 mb-4">
                        <div class="w-3 h-3 bg-blue-600 rounded-full animate-bounce"></div>
                        <div class="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                        <div class="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
                    </div>
                    <p class="text-gray-500">Đang tạo cuộc trò chuyện mới...</p>
                </div>
            </div>
        `;

        // Disable inputs while creating
        if (messageInput) messageInput.disabled = true;
        if (sendButton) sendButton.disabled = true;
        if (newChatBtn) newChatBtn.disabled = true;

        try {
            const response = await fetch('/api/assistant/new', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                currentChatId = data.chat._id;
                
                // Reset message count
                messageCount = 0;
                updateMessageCounter();
                
                // Display welcome message
                displayChatMessages(data.chat.messages);
                
                // Enable inputs
                if (messageInput) {
                    messageInput.disabled = false;
                    messageInput.placeholder = 'Nhập tin nhắn...';
                    messageInput.focus();
                }
                if (sendButton) sendButton.disabled = false;
                
                // Refresh chat history
                await loadChatHistory();
            } else {
                throw new Error('Failed to create new chat');
            }
        } catch (error) {
            console.error('Error creating new chat:', error);
            chatMessages.innerHTML = `
                <div class="flex items-center justify-center h-full">
                    <div class="text-center p-4">
                        <p class="text-gray-500 mb-4">Không thể tạo cuộc trò chuyện mới. Vui lòng thử lại.</p>
                        <button onclick="createNewChat()" 
                                class="px-4 py-2 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200">
                            Thử lại
                        </button>
                    </div>
                </div>
            `;
        } finally {
            // Always re-enable the new chat button
            if (newChatBtn) newChatBtn.disabled = false;
        }
    }

    function displayChatMessages(messages) {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = '';
        
        // Count user messages to update the counter
        messageCount = messages.filter(msg => msg.sender === 'user').length;
        updateMessageCounter();
        
        // Check if limit reached and disable input accordingly
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');
        
        if (messageCount >= MESSAGE_LIMIT) {
            messageInput.disabled = true;
            sendButton.disabled = true;
            messageInput.placeholder = 'Đã đạt giới hạn tin nhắn. Tạo cuộc trò chuyện mới để tiếp tục.';
        } else {
            messageInput.disabled = false;
            sendButton.disabled = false;
            messageInput.placeholder = 'Nhập tin nhắn...';
        }
        
        messages.forEach(message => {
            addMessageToChat(message.sender, message.content, message.timestamp);
        });
        
        // Scroll to bottom after loading messages
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function addMessageToChat(sender, message, timestamp = new Date()) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `flex ${sender === 'user' ? 'justify-end' : 'justify-start'} mb-4`;
        
        const speakButtonHtml = sender === 'assistant' ? `
            <button class="speak-btn ml-2 p-1 text-gray-500 hover:text-blue-600 transition-colors" 
                    onclick="speakText('${message.replace(/'/g, "\\'")}')">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 14.142M9 9a3 3 0 000 6h3v2a1 1 0 001 1h1a1 1 0 001-1v-2h3a3 3 0 000-6H9z" />
                </svg>
            </button>
        ` : '';

        const bubbleClass = sender === 'user' 
            ? 'bg-blue-600 text-white ml-auto rounded-l-lg rounded-br-lg' 
            : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white mr-auto rounded-r-lg rounded-bl-lg';
        
        messageDiv.innerHTML = `
            <div class="flex flex-col max-w-xs lg:max-w-2xl">
                <div class="px-4 py-2 ${bubbleClass} shadow-sm">
                    <div class="flex items-start justify-between">
                        <p class="text-sm flex-1 whitespace-pre-wrap">${message}</p>
                        ${speakButtonHtml}
                    </div>
                </div>
                <span class="text-xs text-gray-500 dark:text-gray-400 mt-1 ${
                    sender === 'user' ? 'text-right' : 'text-left'
                }">${formatTimestamp(new Date(timestamp))}</span>
            </div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    async function loadChatHistory() {
        const chatHistoryList = document.getElementById('chatHistoryList');
        
        // Show loading state
        chatHistoryList.innerHTML = `
            <div class="p-4">
                <div class="flex justify-center space-x-2 mb-2">
                    <div class="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                    <div class="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                    <div class="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
                </div>
                <p class="text-sm text-center text-gray-500">Đang tải lịch sử...</p>
            </div>
        `;

        try {
            const response = await fetch('/api/assistant/history', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                displayChatHistory(data.chats);
            } else {
                throw new Error('Failed to load chat history');
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
            chatHistoryList.innerHTML = `
                <div class="p-4 text-center">
                    <p class="text-sm text-gray-500 mb-2">Lỗi khi tải lịch sử chat</p>
                    <button onclick="loadChatHistory()" 
                            class="text-sm px-3 py-1 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200">
                        Thử lại
                    </button>
                </div>
            `;
        }
    }

    function displayChatHistory(chats) {
        const chatHistoryList = document.getElementById('chatHistoryList');
        
        if (!chats || chats.length === 0) {
            chatHistoryList.innerHTML = '<p class="text-sm text-gray-500 p-3">Chưa có lịch sử chat</p>';
            return;
        }

        chatHistoryList.innerHTML = chats.map(chat => {
            // Get first and last message for title and preview
            const firstMessage = chat.messages[0];
            const lastMessage = chat.messages[chat.messages.length - 1];
            
            // Generate title from first assistant message or use default
            const title = chat.title || (firstMessage && firstMessage.sender === 'assistant' ? 
                (firstMessage.content.length > 50 ? firstMessage.content.substring(0, 50) + '...' : firstMessage.content) : 
                'Cuộc trò chuyện mới');
            
            // Create preview from last message
            const lastMessagePreview = lastMessage ? 
                `<p class="text-xs text-gray-600 dark:text-gray-300 mt-1 truncate">
                    ${lastMessage.sender === 'user' ? 'Bạn: ' : 'Trợ lý: '}${lastMessage.content}
                </p>` : '';

            // Format timestamp
            const timestamp = lastMessage ? new Date(lastMessage.timestamp) : new Date(chat.createdAt);
            const timeString = formatTimestamp(timestamp);

            return `
                <div class="chat-history-item p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 ${
                    chat._id === currentChatId ? 'bg-blue-100 dark:bg-blue-900' : ''
                }" data-chat-id="${chat._id}">
                    <div class="flex justify-between items-start">
                        <h4 class="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">
                            ${title}
                        </h4>
                        <div class="flex items-center space-x-2">
                            <span class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                ${timeString}
                            </span>
                            <button class="delete-chat-btn text-xs text-red-600 hover:text-red-800" data-chat-id="${chat._id}">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    ${lastMessagePreview}
                    <div class="flex justify-between items-center mt-1">
                        <span class="text-xs text-gray-400">
                            ${chat.messages.length} tin nhắn
                        </span>
                        ${chat.isActive ? 
                            '<span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Đang hoạt động</span>' 
                            : ''}
                    </div>
                </div>
            `;
        }).join('');

        // Add click event listeners to chat history items and delete buttons
        document.querySelectorAll('.chat-history-item').forEach(item => {
            // Chat item click
            item.addEventListener('click', (e) => {
                // Don't trigger if clicking delete button
                if (!e.target.closest('.delete-chat-btn')) {
                    const chatId = item.dataset.chatId;
                    resumeChat(chatId);
                }
            });
        });

        // Delete chat buttons
        document.querySelectorAll('.delete-chat-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent chat selection
                const chatId = btn.dataset.chatId;
                if (confirm('Bạn có chắc chắn muốn xóa đoạn chat này?')) {
                    try {
                        const response = await fetch(`/api/assistant/chat/${chatId}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('token')}`
                            }
                        });

                        if (response.ok) {
                            // If deleting current chat, create new one
                            if (chatId === currentChatId) {
                                createNewChat();
                            }
                            loadChatHistory(); // Refresh list
                        }
                    } catch (error) {
                        console.error('Error deleting chat:', error);
                        alert('Không thể xóa đoạn chat');
                    }
                }
            });
        });
    }

    async function resumeChat(chatId) {
        if (!chatId) return;

        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');
        const chatMessages = document.getElementById('chatMessages');
        const newChatBtn = document.getElementById('newChatBtn');

        // Show loading state
        chatMessages.innerHTML = `
            <div class="flex items-center justify-center h-full">
                <div class="text-center p-4">
                    <div class="flex justify-center space-x-2 mb-4">
                        <div class="w-3 h-3 bg-blue-600 rounded-full animate-bounce"></div>
                        <div class="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                        <div class="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
                    </div>
                    <p class="text-gray-500">Đang tải cuộc trò chuyện...</p>
                </div>
            </div>
        `;

        // Disable all inputs while loading
        if (messageInput) messageInput.disabled = true;
        if (sendButton) sendButton.disabled = true;
        if (newChatBtn) newChatBtn.disabled = true;

        try {
            const response = await fetch(`/api/assistant/resume/${chatId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to resume chat');
            }

            const data = await response.json();
            if (!data.chat) {
                throw new Error('No chat data received');
            }

            currentChatId = data.chat._id;
            
            // Reset message count based on chat messages
            messageCount = data.chat.messages.filter(msg => msg.sender === 'user').length;
            updateMessageCounter();
            
            // Display messages
            displayChatMessages(data.chat.messages);
            
            // Enable/disable inputs based on message count
            if (messageInput) {
                messageInput.disabled = messageCount >= MESSAGE_LIMIT;
                messageInput.placeholder = messageCount >= MESSAGE_LIMIT ? 
                    'Đã đạt giới hạn tin nhắn. Tạo cuộc trò chuyện mới để tiếp tục.' : 
                    'Nhập tin nhắn...';
                if (!messageInput.disabled) messageInput.focus();
            }
            if (sendButton) sendButton.disabled = messageCount >= MESSAGE_LIMIT;
            
            // Refresh chat history to update active state
            await loadChatHistory();

        } catch (error) {
            console.error('Error resuming chat:', error);
            chatMessages.innerHTML = `
                <div class="flex items-center justify-center h-full">
                    <div class="text-center p-4">
                        <p class="text-gray-500 mb-4">Không thể tải cuộc trò chuyện. Vui lòng thử lại.</p>
                        <button onclick="initializeState()" 
                                class="px-4 py-2 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200">
                            Tải lại
                        </button>
                    </div>
                </div>
            `;
        } finally {
            // Always re-enable the new chat button
            if (newChatBtn) newChatBtn.disabled = false;
        }
    }

    // Mailbox Management
    function initializeMailbox() {
        const messageFilter = document.getElementById('messageFilter');
        const labelFilter = document.getElementById('labelFilter');
        const markAllReadBtn = document.getElementById('markAllRead');
        const messagesList = document.getElementById('messagesList');

        // Load messages when mailbox section is accessed
        loadMessages();

        // Filter event listeners
        messageFilter.addEventListener('change', () => {
            loadMessages(messageFilter.value, labelFilter.value);
        });

        labelFilter.addEventListener('change', () => {
            loadMessages(messageFilter.value, labelFilter.value);
        });

        // Mark all as read
        markAllReadBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/mailbox/mark-all-read', {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });

                if (response.ok) {
                    loadMessages(); // Refresh messages
                    updateMailboxBadge(); // Update badge
                }
            } catch (error) {
                console.error('Error marking all messages as read:', error);
            }
        });

        // Load messages function
        async function loadMessages(type = '', label = '') {
            try {
                let url = '/api/mailbox';
                const params = new URLSearchParams();
                if (type) params.append('type', type);
                if (label) params.append('label', label);
                if (params.toString()) url += '?' + params.toString();

                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });

                if (response.ok) {
                    const { messages } = await response.json();
                    displayMessages(messages);
                    updateMailboxBadge(); // Update badge count
                }
            } catch (error) {
                console.error('Error loading messages:', error);
                messagesList.innerHTML = '<p class="text-gray-500 text-center">Lỗi khi tải tin nhắn</p>';
            }
        }

        // Display messages function
        function displayMessages(messages) {
            if (!messages || messages.length === 0) {
                messagesList.innerHTML = '<p class="text-gray-500 text-center py-8">Không có tin nhắn nào</p>';
                return;
            }

            messagesList.innerHTML = messages.map(message => {
                const typeIcon = getTypeIcon(message.type);
                const labelColor = getLabelColor(message.label);
                
                return `
                    <div class="message-item bg-white dark:bg-gray-700 p-4 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer ${
                        !message.isRead ? 'border-l-4 border-blue-500' : ''
                    }" data-message-id="${message._id}">
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <div class="flex items-center space-x-2 mb-2">
                                    <span class="text-lg">${typeIcon}</span>
                                    <h3 class="text-lg font-medium text-gray-900 dark:text-white ${
                                        !message.isRead ? 'font-bold' : ''
                                    }">${message.title}</h3>
                                    ${!message.isRead ? '<span class="w-2 h-2 bg-blue-500 rounded-full"></span>' : ''}
                                </div>
                                <p class="text-sm text-gray-600 dark:text-gray-300 mb-2">${message.content}</p>
                                <div class="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                                    <span>Từ: ${message.sender?.name || 'Hệ thống'}</span>
                                    <span>${new Date(message.createdAt).toLocaleString('vi-VN')}</span>
                                    ${message.label ? `<span class="px-2 py-1 rounded-full ${labelColor}">${getLabelText(message.label)}</span>` : ''}
                                </div>
                            </div>
                            <div class="flex items-center space-x-2">
                                <button class="mark-read-btn text-sm px-3 py-1 ${
                                    message.isRead ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-600'
                                } rounded-md hover:bg-opacity-80" data-message-id="${message._id}">
                                    ${message.isRead ? 'Đã đọc' : 'Đánh dấu đã đọc'}
                                </button>
                                <button class="delete-message-btn text-sm px-3 py-1 bg-red-100 text-red-600 rounded-md hover:bg-red-200" data-message-id="${message._id}">
                                    Xóa
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // Add event listeners to message items
            document.querySelectorAll('.message-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    if (!e.target.closest('button')) {
                        const messageId = item.dataset.messageId;
                        markMessageAsRead(messageId);
                    }
                });
            });

            // Add event listeners to mark as read buttons
            document.querySelectorAll('.mark-read-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const messageId = btn.dataset.messageId;
                    markMessageAsRead(messageId);
                });
            });

            // Add event listeners to delete buttons
            document.querySelectorAll('.delete-message-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const messageId = btn.dataset.messageId;
                    if (confirm('Bạn có chắc chắn muốn xóa tin nhắn này?')) {
                        deleteMessage(messageId);
                    }
                });
            });
        }

        // Mark message as read
        async function markMessageAsRead(messageId) {
            try {
                const response = await fetch(`/api/mailbox/${messageId}/read`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });

                if (response.ok) {
                    loadMessages(); // Refresh messages
                    updateMailboxBadge(); // Update badge
                }
            } catch (error) {
                console.error('Error marking message as read:', error);
            }
        }

        // Delete message
        async function deleteMessage(messageId) {
            try {
                const response = await fetch(`/api/mailbox/${messageId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });

                if (response.ok) {
                    loadMessages(); // Refresh messages
                    updateMailboxBadge(); // Update badge
                }
            } catch (error) {
                console.error('Error deleting message:', error);
                alert('Không thể xóa tin nhắn');
            }
        }

        // Update mailbox badge
        async function updateMailboxBadge() {
            try {
                const response = await fetch('/api/mailbox/unread-count', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });

                if (response.ok) {
                    const { count } = await response.json();
                    const badge = document.getElementById('mailboxBadge');
                    if (count > 0) {
                        badge.textContent = count;
                        badge.classList.remove('hidden');
                    } else {
                        badge.classList.add('hidden');
                    }
                }
            } catch (error) {
                console.error('Error updating mailbox badge:', error);
            }
        }

        // Helper functions
        function getTypeIcon(type) {
            const icons = {
                'meeting': '📅',
                'task': '✅',
                'document': '📄',
                'notification': '🔔'
            };
            return icons[type] || '📧';
        }

        function getLabelColor(label) {
            const colors = {
                'urgent': 'bg-red-100 text-red-800',
                'important': 'bg-orange-100 text-orange-800',
                'follow-up': 'bg-yellow-100 text-yellow-800',
                'work': 'bg-blue-100 text-blue-800',
                'personal': 'bg-green-100 text-green-800'
            };
            return colors[label] || 'bg-gray-100 text-gray-800';
        }

        function getLabelText(label) {
            const texts = {
                'urgent': 'Khẩn cấp',
                'important': 'Quan trọng',
                'follow-up': 'Theo dõi',
                'work': 'Công việc',
                'personal': 'Cá nhân'
            };
            return texts[label] || label;
        }

        // Initialize badge on load
        updateMailboxBadge();
    }

    // Document Management
    function initializeDocuments() {
        const addDocumentBtn = document.getElementById('addDocument');
        const documentModal = document.getElementById('documentModal');
        const closeModalBtn = document.getElementById('closeModal');
        const cancelDocumentBtn = document.getElementById('cancelDocument');
        const documentForm = document.getElementById('documentForm');
        const categoryFilter = document.getElementById('categoryFilter');
        const documentSearch = document.getElementById('documentSearch');

        // Show modal
        addDocumentBtn.addEventListener('click', () => {
            documentModal.classList.remove('hidden');
        });

        // Hide modal
        const hideModal = () => {
            documentModal.classList.add('hidden');
            documentForm.reset();
        };

        closeModalBtn.addEventListener('click', hideModal);
        cancelDocumentBtn.addEventListener('click', hideModal);

        // Handle form submission
        documentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                title: document.getElementById('docTitle').value,
                category: document.getElementById('docCategory').value,
                department: document.getElementById('docDepartment').value,
                accessLevel: document.getElementById('docAccessLevel').value,
                content: document.getElementById('docContent').value,
                tags: document.getElementById('docTags').value.split(',').map(tag => tag.trim()).filter(tag => tag),
                status: document.getElementById('docStatus').value
            };

            try {
                const response = await fetch('/api/documents', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(formData)
                });

                if (response.ok) {
                    hideModal();
                    loadDocuments(); // Refresh documents list
                } else {
                    const data = await response.json();
                    alert(data.message || 'Không thể tạo tài liệu');
                }
            } catch (error) {
                console.error('Error creating document:', error);
                alert('Có lỗi xảy ra khi tạo tài liệu');
            }
        });

        // Load and filter documents
        async function loadDocuments(category = '', searchQuery = '') {
            try {
                let url = '/api/documents';
                const params = new URLSearchParams();
                if (category) params.append('category', category);
                if (searchQuery) params.append('search', searchQuery);
                if (params.toString()) url += '?' + params.toString();

                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });

                if (response.ok) {
                    const { documents } = await response.json();
                    displayDocuments(documents);
                }
            } catch (error) {
                console.error('Error loading documents:', error);
            }
        }

        function displayDocuments(documents) {
            const documentsList = document.getElementById('documentsList');
            if (!documents.length) {
                documentsList.innerHTML = '<p class="text-gray-500 text-center">Không có tài liệu nào</p>';
                return;
            }

            documentsList.innerHTML = documents.map(doc => `
                <div class="bg-white dark:bg-gray-700 p-4 rounded-lg shadow">
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="text-lg font-medium text-gray-900 dark:text-white">${doc.title}</h3>
                            <p class="text-sm text-gray-500 dark:text-gray-300">
                                ${doc.category} • ${doc.department} • ${doc.accessLevel}
                            </p>
                            <div class="mt-2 flex flex-wrap gap-2">
                                ${doc.tags.map(tag => 
                                    `<span class="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">${tag}</span>`
                                ).join('')}
                            </div>
                        </div>
                        <span class="px-2 py-1 text-xs ${
                            doc.status === 'published' ? 'bg-green-100 text-green-800' :
                            doc.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                        } rounded-full">${doc.status}</span>
                    </div>
                    <p class="mt-2 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">${doc.content}</p>
                    <div class="mt-4 text-xs text-gray-500 dark:text-gray-400">
                        Tạo bởi ${doc.author?.name || 'Unknown'} • ${new Date(doc.createdAt).toLocaleDateString()}
                    </div>
                </div>
            `).join('');
        }

        // Event listeners for filtering
        categoryFilter.addEventListener('change', () => {
            loadDocuments(categoryFilter.value, documentSearch.value);
        });

        let searchTimeout;
        documentSearch.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadDocuments(categoryFilter.value, documentSearch.value);
            }, 300);
        });

        // Initial load
        loadDocuments();
    }

    // Meeting Management
    function initializeMeetings() {
        const createMeetingBtn = document.getElementById('createMeetingBtn');
        const meetingModal = document.getElementById('meetingModal');
        const closeMeetingModalBtn = document.getElementById('closeMeetingModal');
        const cancelMeetingBtn = document.getElementById('cancelMeeting');
        const meetingForm = document.getElementById('meetingForm');
        const meetingsList = document.getElementById('meetingsList');

        // Check if user is Operations to show/hide create button
        checkOperationsAccess();

        // Show modal
        if (createMeetingBtn) {
            createMeetingBtn.addEventListener('click', () => {
                meetingModal.classList.remove('hidden');
                loadUsersForMeeting();
            });
        }

        // Hide modal
        const hideModal = () => {
            meetingModal.classList.add('hidden');
            meetingForm.reset();
        };

        if (closeMeetingModalBtn) {
            closeMeetingModalBtn.addEventListener('click', hideModal);
        }
        if (cancelMeetingBtn) {
            cancelMeetingBtn.addEventListener('click', hideModal);
        }

        // Handle form submission
        if (meetingForm) {
            meetingForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = {
                    title: document.getElementById('meetingTitle').value,
                    description: document.getElementById('meetingDescription').value,
                    startTime: document.getElementById('meetingStartTime').value,
                    endTime: document.getElementById('meetingEndTime').value,
                    location: document.getElementById('meetingLocation').value,
                    meetingType: document.getElementById('meetingType').value,
                    onlineMeetingLink: document.getElementById('onlineMeetingLink').value,
                    participants: Array.from(document.getElementById('meetingParticipants').selectedOptions).map(option => option.value)
                };

                try {
                    const response = await fetch('/api/meetings', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        },
                        body: JSON.stringify(formData)
                    });

                    const data = await response.json();
                    if (response.ok) {
                        hideModal();
                        loadMeetings(); // Refresh meetings list
                        alert('Cuộc họp đã được tạo thành công và thông báo đã được gửi đến hộp thư của các thành viên!');
                    } else {
                        alert(data.message || 'Không thể tạo cuộc họp');
                    }
                } catch (error) {
                    console.error('Error creating meeting:', error);
                    alert('Có lỗi xảy ra khi tạo cuộc họp');
                }
            });
        }

        // Check Operations access
        async function checkOperationsAccess() {
            try {
                const response = await fetch('/api/auth/me', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.department !== 'Operations') {
                        if (createMeetingBtn) {
                            createMeetingBtn.style.display = 'none';
                        }
                        const accessMessage = document.getElementById('meetingAccessMessage');
                        if (accessMessage) {
                            accessMessage.classList.remove('hidden');
                        }
                    }
                }
            } catch (error) {
                console.error('Error checking user access:', error);
            }
        }

        // Load users for meeting participants
        async function loadUsersForMeeting() {
            try {
                const response = await fetch('/api/users', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });

                if (response.ok) {
                    const { users } = await response.json();
                    const participantsSelect = document.getElementById('meetingParticipants');
                    if (participantsSelect) {
                        participantsSelect.innerHTML = users.map(user => 
                            `<option value="${user._id}">${user.name} (${user.department})</option>`
                        ).join('');
                    }
                }
            } catch (error) {
                console.error('Error loading users:', error);
            }
        }

        // Load meetings
        async function loadMeetings() {
            try {
                const response = await fetch('/api/meetings', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });

                if (response.ok) {
                    const { meetings } = await response.json();
                    displayMeetings(meetings);
                }
            } catch (error) {
                console.error('Error loading meetings:', error);
                if (meetingsList) {
                    meetingsList.innerHTML = '<p class="text-gray-500 text-center">Lỗi khi tải cuộc họp</p>';
                }
            }
        }

        // Display meetings
        function displayMeetings(meetings) {
            if (!meetingsList) return;

            if (!meetings || meetings.length === 0) {
                meetingsList.innerHTML = '<p class="text-gray-500 text-center py-8">Không có cuộc họp nào</p>';
                return;
            }

            meetingsList.innerHTML = meetings.map(meeting => {
                const startTime = new Date(meeting.startTime);
                const endTime = new Date(meeting.endTime);
                const isUpcoming = startTime > new Date();
                const statusColor = getStatusColor(meeting.status);
                const typeIcon = getMeetingTypeIcon(meeting.meetingType);

                return `
                    <div class="meeting-item bg-white dark:bg-gray-700 p-4 rounded-lg shadow hover:shadow-md transition-shadow">
                        <div class="flex justify-between items-start mb-3">
                            <div class="flex-1">
                                <div class="flex items-center space-x-2 mb-2">
                                    <span class="text-lg">${typeIcon}</span>
                                    <h3 class="text-lg font-medium text-gray-900 dark:text-white">${meeting.title}</h3>
                                    <span class="px-2 py-1 text-xs rounded-full ${statusColor}">${getStatusText(meeting.status)}</span>
                                </div>
                                <p class="text-sm text-gray-600 dark:text-gray-300 mb-2">${meeting.description}</p>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-300">
                            <div>
                                <p><strong>Thời gian:</strong> ${startTime.toLocaleString('vi-VN')}</p>
                                <p><strong>Đến:</strong> ${endTime.toLocaleString('vi-VN')}</p>
                                <p><strong>Địa điểm:</strong> ${meeting.location}</p>
                                ${meeting.onlineMeetingLink ? `<p><strong>Link:</strong> <a href="${meeting.onlineMeetingLink}" target="_blank" class="text-blue-600 hover:underline">Tham gia</a></p>` : ''}
                            </div>
                            <div>
                                <p><strong>Người tổ chức:</strong> ${meeting.organizer?.name || 'Unknown'}</p>
                                <p><strong>Số người tham gia:</strong> ${meeting.participants?.length || 0}</p>
                                <div class="mt-2">
                                    <p><strong>Thành viên:</strong></p>
                                    <div class="flex flex-wrap gap-1 mt-1">
                                        ${meeting.participants?.map(p => 
                                            `<span class="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">${p.user?.name || 'Unknown'}</span>`
                                        ).join('') || ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        ${isUpcoming ? `
                            <div class="mt-4 flex space-x-2">
                                <button class="accept-meeting-btn px-3 py-1 text-sm bg-green-100 text-green-700 rounded-md hover:bg-green-200" data-meeting-id="${meeting._id}">
                                    Chấp nhận
                                </button>
                                <button class="decline-meeting-btn px-3 py-1 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200" data-meeting-id="${meeting._id}">
                                    Từ chối
                                </button>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');

            // Add event listeners for accept/decline buttons
            document.querySelectorAll('.accept-meeting-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const meetingId = btn.dataset.meetingId;
                    updateMeetingStatus(meetingId, 'accepted');
                });
            });

            document.querySelectorAll('.decline-meeting-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const meetingId = btn.dataset.meetingId;
                    updateMeetingStatus(meetingId, 'declined');
                });
            });
        }

        // Update meeting participant status
        async function updateMeetingStatus(meetingId, status) {
            try {
                const response = await fetch(`/api/meetings/${meetingId}/participants/status`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({ status })
                });

                if (response.ok) {
                    loadMeetings(); // Refresh meetings
                    alert(`Đã ${status === 'accepted' ? 'chấp nhận' : 'từ chối'} cuộc họp`);
                } else {
                    const data = await response.json();
                    alert(data.message || 'Không thể cập nhật trạng thái');
                }
            } catch (error) {
                console.error('Error updating meeting status:', error);
                alert('Có lỗi xảy ra khi cập nhật trạng thái');
            }
        }

        // Helper functions
        function getStatusColor(status) {
            const colors = {
                'scheduled': 'bg-blue-100 text-blue-800',
                'in-progress': 'bg-yellow-100 text-yellow-800',
                'completed': 'bg-green-100 text-green-800',
                'cancelled': 'bg-red-100 text-red-800'
            };
            return colors[status] || 'bg-gray-100 text-gray-800';
        }

        function getStatusText(status) {
            const texts = {
                'scheduled': 'Đã lên lịch',
                'in-progress': 'Đang diễn ra',
                'completed': 'Hoàn thành',
                'cancelled': 'Đã hủy'
            };
            return texts[status] || status;
        }

        function getMeetingTypeIcon(type) {
            const icons = {
                'in-person': '🏢',
                'online': '💻',
                'hybrid': '🔄'
            };
            return icons[type] || '📅';
        }

        // Show/hide online meeting link field based on meeting type
        const meetingTypeSelect = document.getElementById('meetingType');
        const onlineLinkField = document.getElementById('onlineLinkField');
        
        if (meetingTypeSelect && onlineLinkField) {
            meetingTypeSelect.addEventListener('change', () => {
                if (meetingTypeSelect.value === 'online' || meetingTypeSelect.value === 'hybrid') {
                    onlineLinkField.classList.remove('hidden');
                } else {
                    onlineLinkField.classList.add('hidden');
                }
            });
        }

        // Initial load
        loadMeetings();
    }

    // Handle login form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('token', data.token);
                showMainApp();
            } else {
                alert(data.message || 'Đăng nhập thất bại');
            }
        } catch (error) {
            alert('Lỗi kết nối: ' + error.message);
        }
    });

    // Handle register form submission
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = {
            email: document.getElementById('registerEmail').value,
            password: document.getElementById('registerPassword').value,
            name: document.getElementById('registerName').value,
            department: document.getElementById('registerDepartment').value,
            position: document.getElementById('registerPosition').value
        };

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('token', data.token);
                showMainApp();
            } else {
                alert(data.message || 'Đăng ký thất bại');
            }
        } catch (error) {
            alert('Lỗi kết nối: ' + error.message);
        }
    });

    // Event Listeners for form switching
    showLoginBtn.addEventListener('click', () => {
        showLoginBtn.classList.add('text-blue-600', 'border-blue-600');
        showRegisterBtn.classList.remove('text-blue-600', 'border-blue-600');
        showForm(loginForm, registerForm, resetPasswordForm, deleteAccountForm);
    });

    showRegisterBtn.addEventListener('click', () => {
        showRegisterBtn.classList.add('text-blue-600', 'border-blue-600');
        showLoginBtn.classList.remove('text-blue-600', 'border-blue-600');
        showForm(registerForm, loginForm, resetPasswordForm, deleteAccountForm);
    });

    forgotPasswordBtn.addEventListener('click', () => {
        showForm(resetPasswordForm, loginForm, registerForm, deleteAccountForm);
        verificationCodeSection.classList.add('hidden');
        newPasswordSection.classList.add('hidden');
    });

    deleteAccountBtn.addEventListener('click', () => {
        showForm(deleteAccountForm, loginForm, registerForm, resetPasswordForm);
    });

    backToLoginBtn.addEventListener('click', () => {
        showForm(loginForm, resetPasswordForm, registerForm, deleteAccountForm);
    });

    cancelDeleteBtn.addEventListener('click', () => {
        showForm(loginForm, deleteAccountForm, registerForm, resetPasswordForm);
    });

    // Store email for password reset flow
    let resetEmail = '';

    // Handle password reset flow
    sendCodeBtn.addEventListener('click', async () => {
        const email = document.getElementById('resetEmail').value;
        resetEmail = email; // Store email for later use
        
        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email })
            });

            if (response.ok) {
                verificationCodeSection.classList.remove('hidden');
                sendCodeBtn.disabled = true;
                sendCodeBtn.classList.add('opacity-50');
                sendCodeBtn.textContent = 'Đã gửi';
                setTimeout(() => {
                    sendCodeBtn.disabled = false;
                    sendCodeBtn.classList.remove('opacity-50');
                    sendCodeBtn.textContent = 'Gửi lại';
                }, 60000); // Enable resend after 1 minute
            } else {
                const data = await response.json();
                alert(data.message || 'Không thể gửi mã xác nhận');
            }
        } catch (error) {
            alert('Lỗi kết nối: ' + error.message);
        }
    });

    // Handle password reset form submission
    resetPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = document.getElementById('verificationCode').value;
        const newPassword = document.getElementById('newPassword').value;

        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token: code,
                    newPassword,
                    email: resetEmail
                })
            });

            const data = await response.json();
            if (response.ok) {
                alert('Đặt lại mật khẩu thành công');
                showForm(loginForm, resetPasswordForm);
                // Reset form
                resetPasswordForm.reset();
                verificationCodeSection.classList.add('hidden');
                newPasswordSection.classList.add('hidden');
                resetEmail = '';
            } else {
                alert(data.message || 'Không thể đặt lại mật khẩu');
            }
        } catch (error) {
            alert('Lỗi kết nối: ' + error.message);
        }
    });

    // Handle delete account form submission
    deleteAccountForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('deleteAccountPassword').value;

        if (!confirm('Bạn có chắc chắn muốn xóa tài khoản? Hành động này không thể hoàn tác.')) {
            return;
        }

        try {
            const response = await fetch('/api/auth/delete-account', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ password })
            });

            const data = await response.json();
            if (response.ok) {
                alert('Tài khoản đã được xóa thành công');
                localStorage.removeItem('token');
                window.location.reload();
            } else {
                alert(data.message || 'Không thể xóa tài khoản');
            }
        } catch (error) {
            alert('Lỗi kết nối: ' + error.message);
        }
    });

    // Handle verification code entry
    document.getElementById('verificationCode').addEventListener('input', (e) => {
        if (e.target.value.length === 6) { // Assuming 6-digit code
            newPasswordSection.classList.remove('hidden');
        }
    });
});
