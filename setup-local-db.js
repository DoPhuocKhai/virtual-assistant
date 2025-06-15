const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Connect to local MongoDB
const MONGODB_URI = 'mongodb://localhost:27017/virtual-assistant';

async function setupDatabase() {
    try {
        console.log('🔄 Connecting to local MongoDB...');
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to local MongoDB successfully!');

        // Import models
        const User = require('./models/User');
        const CompanyData = require('./models/CompanyData');

        // Check if admin user exists
        const existingAdmin = await User.findOne({ email: 'admin@company.com' });
        
        if (!existingAdmin) {
            console.log('👤 Creating default admin user...');
            
            // Create default admin user
            const hashedPassword = await bcrypt.hash('admin123', 10);
            const adminUser = new User({
                email: 'admin@company.com',
                password: hashedPassword,
                name: 'System Administrator',
                department: 'IT',
                position: 'System Administrator',
                role: 'admin',
                permissions: [
                    'view_company_docs',
                    'edit_company_docs',
                    'manage_users',
                    'view_reports',
                    'manage_meetings',
                    'manage_tasks'
                ],
                isActive: true
            });
            
            await adminUser.save();
            console.log('✅ Admin user created successfully!');
            console.log('📧 Email: admin@company.com');
            console.log('🔑 Password: admin123');
        } else {
            console.log('👤 Admin user already exists');
        }

        // Check if company data exists
        const existingCompany = await CompanyData.findOne();
        
        if (!existingCompany) {
            console.log('🏢 Creating default company data...');
            
            const companyData = new CompanyData({
                name: 'Công ty TNHH ABC',
                tradingName: 'ABC Company',
                type: 'Công ty trách nhiệm hữu hạn',
                founded: '2020',
                headquarters: 'Hà Nội, Việt Nam',
                industry: 'Công nghệ thông tin',
                products: ['Phần mềm quản lý', 'Ứng dụng di động', 'Tư vấn IT'],
                employees: '50-100',
                website: 'https://abc-company.com',
                description: 'Công ty chuyên về phát triển phần mềm và giải pháp công nghệ thông tin.',
                isActive: true
            });
            
            await companyData.save();
            console.log('✅ Company data created successfully!');
        } else {
            console.log('🏢 Company data already exists');
        }

        console.log('\n🎉 Database setup completed successfully!');
        console.log('🚀 You can now start the application with: npm start');
        console.log('🌐 Access the application at: http://localhost:3000');
        
    } catch (error) {
        console.error('❌ Database setup failed:', error);
        console.log('\n💡 Make sure MongoDB is running locally:');
        console.log('   - Install MongoDB: https://docs.mongodb.com/manual/installation/');
        console.log('   - Start MongoDB: mongod');
        console.log('   - Default port: 27017');
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

// Run setup
setupDatabase();
