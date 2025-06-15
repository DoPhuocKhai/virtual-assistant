const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const API_BASE = 'http://localhost:3000/api';

async function testDocumentUpload() {
    try {
        console.log('Testing document upload and access control...\n');

        // Login as different users to test permissions
        const users = {
            operations: {
                email: 'operations@vng.com.vn',
                password: 'password123'
            },
            it: {
                email: 'it@vng.com.vn',
                password: 'password123'
            },
            hr: {
                email: 'hr@vng.com.vn',
                password: 'password123'
            }
        };

        const tokens = {};
        
        // Login all users
        for (const [dept, credentials] of Object.entries(users)) {
            const loginResponse = await axios.post(`${API_BASE}/users/login`, credentials);
            tokens[dept] = loginResponse.data.token;
            console.log(`✅ Logged in as ${dept} user`);
        }

        // Create test document as HR user
        console.log('\nCreating test document as HR user...');
        const createDocResponse = await axios.post(
            `${API_BASE}/documents`,
            {
                title: 'Test Document with Attachments',
                category: 'hr_documents',
                department: 'HR',
                accessLevel: 'department',
                content: 'This is a test document for file upload functionality',
                status: 'published'
            },
            {
                headers: { 'Authorization': `Bearer ${tokens.hr}` }
            }
        );

        const docId = createDocResponse.data.document._id;
        console.log('✅ Created test document:', docId);

        // Create test files
        const testFiles = [
            { name: 'test1.pdf', content: 'Test PDF content' },
            { name: 'test2.docx', content: 'Test Word document content' }
        ];

        for (const file of testFiles) {
            fs.writeFileSync(file.name, file.content);
        }

        // Test file upload as different users
        console.log('\nTesting file uploads...');

        // HR user uploads file
        console.log('\nUploading as HR user (should succeed)...');
        const formData = new FormData();
        formData.append('file', fs.createReadStream('test1.pdf'));
        
        try {
            const uploadResponse = await axios.post(
                `${API_BASE}/documents/${docId}/upload`,
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                        'Authorization': `Bearer ${tokens.hr}`
                    }
                }
            );
            console.log('✅ HR upload successful:', uploadResponse.data.attachment.filename);
        } catch (error) {
            console.log('❌ HR upload failed:', error.response?.data?.message || error.message);
        }

        // Operations user uploads file
        console.log('\nUploading as Operations user (should succeed)...');
        const formData2 = new FormData();
        formData2.append('file', fs.createReadStream('test2.docx'));
        
        try {
            const uploadResponse = await axios.post(
                `${API_BASE}/documents/${docId}/upload`,
                formData2,
                {
                    headers: {
                        ...formData2.getHeaders(),
                        'Authorization': `Bearer ${tokens.operations}`
                    }
                }
            );
            console.log('✅ Operations upload successful:', uploadResponse.data.attachment.filename);
        } catch (error) {
            console.log('❌ Operations upload failed:', error.response?.data?.message || error.message);
        }

        // Test document access
        console.log('\nTesting document access...');
        
        // HR user access (should succeed - own document)
        try {
            const hrAccess = await axios.get(
                `${API_BASE}/documents/${docId}`,
                { headers: { 'Authorization': `Bearer ${tokens.hr}` } }
            );
            console.log('✅ HR can access document');
        } catch (error) {
            console.log('❌ HR access failed:', error.response?.data?.message);
        }

        // Operations user access (should succeed - has full access)
        try {
            const opsAccess = await axios.get(
                `${API_BASE}/documents/${docId}`,
                { headers: { 'Authorization': `Bearer ${tokens.operations}` } }
            );
            console.log('✅ Operations can access document');
        } catch (error) {
            console.log('❌ Operations access failed:', error.response?.data?.message);
        }

        // IT user access (should succeed - has full access)
        try {
            const itAccess = await axios.get(
                `${API_BASE}/documents/${docId}`,
                { headers: { 'Authorization': `Bearer ${tokens.it}` } }
            );
            console.log('✅ IT can access document');
        } catch (error) {
            console.log('❌ IT access failed:', error.response?.data?.message);
        }

        // Cleanup test files
        console.log('\nCleaning up test files...');
        for (const file of testFiles) {
            fs.unlinkSync(file.name);
        }

        console.log('\nTest completed successfully!');

    } catch (error) {
        console.error('❌ Test error:', error.response?.data?.message || error.message);
    }
}

testDocumentUpload();
