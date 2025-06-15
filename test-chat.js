const axios = require('axios');

const API_URL = 'http://localhost:3000/api';

async function testChat() {
    try {
        // 1. Login to get token
        console.log('Logging in...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: "test2@example.com",
            password: "password123"
        });
        const token = loginRes.data.token;
        console.log('Login successful');

        // 2. Test welcome message (empty message)
        console.log('\nTesting welcome message...');
        console.log('Using token:', token);
        try {
            const welcomeRes = await axios.post(
                `${API_URL}/assistant/chat`,
                {},
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            console.log('Welcome message:', welcomeRes.data);
        } catch (error) {
            console.error('Welcome message error:', error.response ? {
                status: error.response.status,
                data: error.response.data,
                headers: error.response.headers
            } : error.message);
        }

        // 3. Test normal chat message
        console.log('\nTesting chat message...');
        const chatRes = await axios.post(
            `${API_URL}/assistant/chat`,
            { message: "Xin chào, bạn có thể giúp tôi không?" },
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        console.log('Chat response:', chatRes.data);

    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

testChat();
