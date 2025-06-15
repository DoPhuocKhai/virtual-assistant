const axios = require('axios');

const API_URL = 'http://localhost:3000/api';

async function testAuth() {
    try {
        // 1. Register a new user
        console.log('Testing registration...');
        const registerRes = await axios.post(`${API_URL}/auth/register`, {
            email: "test2@example.com",
            password: "password123",
            name: "Test User 2",
            department: "IT",
            position: "Developer"
        });
        console.log('Registration successful:', registerRes.data);

        // 2. Login with the new user
        console.log('\nTesting login...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: "test2@example.com",
            password: "password123"
        });
        console.log('Login successful:', loginRes.data);

        // 3. Test protected endpoint
        console.log('\nTesting protected endpoint...');
        const token = loginRes.data.token;
        const infoRes = await axios.get(`${API_URL}/company/info`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        console.log('Protected endpoint response:', infoRes.data);

    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

testAuth();
