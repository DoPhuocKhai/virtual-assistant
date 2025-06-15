const axios = require('axios');

async function testVNGChat() {
    try {
        // First, let's test login with VNG credentials
        console.log('Testing VNG chatbot functionality...\n');
        
        const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
            email: 'admin@vng.com.vn',
            password: 'admin123'
        });
        
        const token = loginResponse.data.token;
        console.log('✅ Login successful with VNG credentials');
        
        // Test company info endpoint
        const companyInfoResponse = await axios.get('http://localhost:3000/api/company/info', {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log('\n📊 Company Info Response:');
        console.log(JSON.stringify(companyInfoResponse.data, null, 2));
        
        // Test chatbot with VNG-related questions
        const testQuestions = [
            'Công ty VNG là gì?',
            'VNG được thành lập khi nào?',
            'Sản phẩm chính của VNG là gì?',
            'VNG có bao nhiêu nhân viên?'
        ];
        
        for (const question of testQuestions) {
            console.log(`\n❓ Question: ${question}`);
            
            try {
                const chatResponse = await axios.post('http://localhost:3000/api/assistant/message', {
                    message: question
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                
                console.log(`✅ Response: ${chatResponse.data.response.substring(0, 200)}...`);
            } catch (chatError) {
                console.log(`❌ Chat error: ${chatError.message}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

testVNGChat();
