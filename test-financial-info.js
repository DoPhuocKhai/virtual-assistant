const axios = require('axios');
require('dotenv').config();

const API_BASE = 'http://localhost:3000/api';

async function testFinancialInfo() {
    try {
        console.log('Testing VNG financial information access...\n');

        // Login first
        const loginResponse = await axios.post(`${API_BASE}/users/login`, {
            email: 'operations@vng.com.vn',
            password: 'password123'
        });

        const token = loginResponse.data.token;
        console.log('✅ Login successful as Operations user\n');

        // Test financial questions
        const financialQuestions = [
            'Doanh thu của VNG quý I/2025 là bao nhiêu?',
            'Lợi nhuận của VNG thay đổi như thế nào?',
            'VNG có được niêm yết trên NASDAQ không?',
            'VNG có những đối tác nào?',
            'VNG có nhận được giải thưởng gì gần đây?'
        ];

        for (const question of financialQuestions) {
            console.log(`❓ Question: ${question}`);
            
            const chatResponse = await axios.post(`${API_BASE}/assistant/message`, {
                message: question
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log(`✅ Response: ${chatResponse.data.response.substring(0, 200)}...\n`);
        }

    } catch (error) {
        console.error('❌ Error:', error.response?.data?.message || error.message);
    }
}

testFinancialInfo();
