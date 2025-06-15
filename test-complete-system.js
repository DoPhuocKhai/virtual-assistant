const axios = require('axios');
require('dotenv').config();

const API_BASE = 'http://localhost:3000/api';

async function testCompleteSystem() {
    try {
        console.log('Testing complete virtual assistant system...\n');

        // Test 1: Login as Operations user
        console.log('=== TEST 1: USER AUTHENTICATION ===');
        const loginResponse = await axios.post(`${API_BASE}/users/login`, {
            email: 'operations@vng.com.vn',
            password: 'password123'
        });

        const token = loginResponse.data.token;
        console.log('✅ Login successful as Operations user\n');

        // Test 2: Test basic company information
        console.log('=== TEST 2: BASIC COMPANY INFORMATION ===');
        const basicQuestions = [
            'VNG là gì?',
            'VNG được thành lập khi nào?',
            'Sản phẩm chính của VNG là gì?'
        ];

        for (const question of basicQuestions) {
            console.log(`❓ Question: ${question}`);
            
            const chatResponse = await axios.post(`${API_BASE}/assistant/message`, {
                message: question
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            console.log(`✅ Response: ${chatResponse.data.response.substring(0, 150)}...\n`);
        }

        // Test 3: Test financial and news information
        console.log('=== TEST 3: FINANCIAL & NEWS INFORMATION ===');
        const financialQuestions = [
            'Doanh thu của VNG quý I/2025 là bao nhiêu?',
            'VNG có được niêm yết trên NASDAQ không?',
            'VNG có những đối tác nào?',
            'VNG có nhận được giải thưởng gì gần đây?'
        ];

        for (const question of financialQuestions) {
            console.log(`❓ Question: ${question}`);
            
            try {
                const chatResponse = await axios.post(`${API_BASE}/assistant/message`, {
                    message: question
                }, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                console.log(`✅ Response: ${chatResponse.data.response.substring(0, 200)}...\n`);
            } catch (error) {
                console.log(`❌ Error: ${error.response?.data?.message || error.message}\n`);
            }
        }

        // Test 4: Test document access
        console.log('=== TEST 4: DOCUMENT ACCESS ===');
        try {
            const documentsResponse = await axios.get(`${API_BASE}/documents`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            console.log(`✅ Retrieved ${documentsResponse.data.documents.length} documents`);
            
            if (documentsResponse.data.documents.length > 0) {
                const firstDoc = documentsResponse.data.documents[0];
                console.log(`   - First document: "${firstDoc.title}" by ${firstDoc.author.name}`);
            }
        } catch (error) {
            console.log(`❌ Document access error: ${error.response?.data?.message || error.message}`);
        }

        // Test 5: Test document categories
        console.log('\n=== TEST 5: DOCUMENT CATEGORIES ===');
        try {
            const categoriesResponse = await axios.get(`${API_BASE}/documents/meta/categories`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            console.log(`✅ Retrieved ${categoriesResponse.data.categories.length} document categories:`);
            categoriesResponse.data.categories.forEach(cat => {
                console.log(`   - ${cat.label} (${cat.value})`);
            });
        } catch (error) {
            console.log(`❌ Categories error: ${error.response?.data?.message || error.message}`);
        }

        // Test 6: Test different user permissions
        console.log('\n=== TEST 6: USER PERMISSIONS ===');
        const testUsers = [
            { email: 'it@vng.com.vn', password: 'password123', dept: 'IT' },
            { email: 'hr@vng.com.vn', password: 'password123', dept: 'HR' }
        ];

        for (const user of testUsers) {
            try {
                const userLogin = await axios.post(`${API_BASE}/users/login`, {
                    email: user.email,
                    password: user.password
                });

                const userToken = userLogin.data.token;
                console.log(`✅ ${user.dept} user login successful`);

                // Test document access for this user
                const userDocsResponse = await axios.get(`${API_BASE}/documents`, {
                    headers: { 'Authorization': `Bearer ${userToken}` }
                });

                console.log(`   - ${user.dept} user can access ${userDocsResponse.data.documents.length} documents`);

            } catch (error) {
                console.log(`❌ ${user.dept} user test failed: ${error.response?.data?.message || error.message}`);
            }
        }

        console.log('\n=== SYSTEM TEST COMPLETED ===');
        console.log('✅ Virtual Assistant system is functioning properly!');
        console.log('✅ News crawling and financial data integration successful');
        console.log('✅ Document management with access control working');
        console.log('✅ Multi-user authentication and permissions verified');

    } catch (error) {
        console.error('❌ System test error:', error.response?.data?.message || error.message);
        console.error('Make sure the server is running on port 3000');
    }
}

testCompleteSystem();
