require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const CompanyData = require('../models/CompanyData');
const jwt = require('jsonwebtoken');

async function testConnection() {
    try {
        // Connect to MongoDB Atlas
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB Atlas successfully');

        // Test database queries
        console.log('\nTesting database queries...');
        
        // Test User collection
        const userCount = await User.countDocuments();
        console.log(`Found ${userCount} users in database`);
        
        // Test CompanyData collection
        const companyData = await CompanyData.findOne();
        if (companyData) {
            console.log('✅ Company data found');
        } else {
            console.log('❌ No company data found');
        }

        // Test token generation
        console.log('\nTesting token generation...');
        const testUser = await User.findOne();
        if (testUser) {
            const accessToken = jwt.sign(
                {
                    user: {
                        id: testUser.id,
                        email: testUser.email,
                        name: testUser.name,
                        department: testUser.department,
                        position: testUser.position
                    }
                },
                process.env.JWT_SECRET,
                { expiresIn: '15m' }
            );

            const refreshToken = jwt.sign(
                { userId: testUser.id },
                process.env.JWT_REFRESH_SECRET,
                { expiresIn: '7d' }
            );

            // Verify tokens
            const decodedAccess = jwt.verify(accessToken, process.env.JWT_SECRET);
            const decodedRefresh = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

            console.log('✅ Token generation and verification successful');
            console.log('Access token payload:', decodedAccess.user);
            console.log('Refresh token payload:', decodedRefresh);
        }

        // Test database write
        console.log('\nTesting database write...');
        const testDoc = new mongoose.model('TestCollection', new mongoose.Schema({
            test: String,
            timestamp: Date
        }))({
            test: 'test-write',
            timestamp: new Date()
        });
        await testDoc.save();
        console.log('✅ Database write successful');
        await mongoose.connection.db.collection('TestCollection').drop();
        console.log('✅ Test collection cleaned up');

        console.log('\n✅ All tests passed successfully');
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\nDatabase connection closed');
    }
}

testConnection().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Script error:', error);
    process.exit(1);
});
