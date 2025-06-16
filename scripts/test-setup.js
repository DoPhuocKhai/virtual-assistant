require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { generateTokens } = require('../config/auth');

async function testSetup() {
    try {
        console.log('\n=== Testing Environment Variables ===');
        const requiredEnvVars = [
            'MONGODB_URI',
            'JWT_SECRET',
            'JWT_REFRESH_SECRET'
        ];

        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        if (missingVars.length > 0) {
            console.error('❌ Missing required environment variables:', missingVars);
            console.log('\nPlease add the following to your .env file:');
            missingVars.forEach(varName => {
                console.log(`${varName}=your_${varName.toLowerCase()}_here`);
            });
            return;
        }
        console.log('✅ All required environment variables are set');

        console.log('\n=== Testing Database Connection ===');
        try {
            await mongoose.connect(process.env.MONGODB_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            console.log('✅ Successfully connected to MongoDB');
            
            // Test write operation
            const TestModel = mongoose.model('Test', new mongoose.Schema({
                test: String,
                timestamp: Date
            }));
            
            await TestModel.create({
                test: 'connection-test',
                timestamp: new Date()
            });
            console.log('✅ Successfully wrote to database');
            
            await TestModel.collection.drop();
            console.log('✅ Successfully cleaned up test data');
        } catch (dbError) {
            console.error('❌ Database connection failed:', dbError.message);
            console.log('\nPlease check your MONGODB_URI in .env file');
            return;
        }

        console.log('\n=== Testing JWT Token Generation ===');
        try {
            const testUser = {
                id: 'test-user-id',
                email: 'test@example.com',
                name: 'Test User',
                department: 'IT',
                position: 'Developer'
            };

            // Test access token
            const accessToken = jwt.sign(
                { user: testUser },
                process.env.JWT_SECRET,
                { expiresIn: '15m' }
            );
            const decodedAccess = jwt.verify(accessToken, process.env.JWT_SECRET);
            console.log('✅ Access token generation and verification successful');

            // Test refresh token
            const refreshToken = jwt.sign(
                { userId: testUser.id },
                process.env.JWT_REFRESH_SECRET,
                { expiresIn: '7d' }
            );
            const decodedRefresh = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
            console.log('✅ Refresh token generation and verification successful');

        } catch (jwtError) {
            console.error('❌ JWT token test failed:', jwtError.message);
            console.log('\nPlease check your JWT_SECRET and JWT_REFRESH_SECRET in .env file');
            return;
        }

        console.log('\n=== Setup Test Complete ===');
        console.log('✅ All tests passed successfully');
        console.log('\nNext steps:');
        console.log('1. Update your frontend to store tokens in cookies');
        console.log('2. Update your API calls to include credentials');
        console.log('3. Test the authentication flow in your application');

    } catch (error) {
        console.error('\n❌ Test failed:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\nDatabase connection closed');
    }
}

testSetup().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Script error:', error);
    process.exit(1);
});
