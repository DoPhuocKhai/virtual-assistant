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

        // Check if users exist
        const existingUsers = await User.countDocuments();
        
        if (existingUsers === 0) {
            console.log('👤 Creating sample users...');
            
            const sampleUsers = [
                {
                    email: 'admin@company.com',
                    password: await bcrypt.hash('admin123', 10),
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
                },
                {
                    email: 'it.manager@company.com',
                    password: await bcrypt.hash('it123', 10),
                    name: 'Nguyễn Văn IT',
                    department: 'IT',
                    position: 'IT Manager',
                    role: 'manager',
                    permissions: [
                        'view_company_docs',
                        'edit_company_docs',
                        'manage_users',
                        'view_reports',
                        'manage_meetings'
                    ],
                    isActive: true
                },
                {
                    email: 'operations.manager@company.com',
                    password: await bcrypt.hash('ops123', 10),
                    name: 'Trần Thị Operations',
                    department: 'Operations',
                    position: 'Operations Manager',
                    role: 'manager',
                    permissions: [
                        'view_company_docs',
                        'manage_users',
                        'view_reports',
                        'manage_meetings'
                    ],
                    isActive: true
                },
                {
                    email: 'hr.employee@company.com',
                    password: await bcrypt.hash('hr123', 10),
                    name: 'Lê Văn HR',
                    department: 'HR',
                    position: 'HR Specialist',
                    role: 'employee',
                    permissions: [
                        'view_company_docs',
                        'view_reports'
                    ],
                    isActive: true
                },
                {
                    email: 'finance.employee@company.com',
                    password: await bcrypt.hash('finance123', 10),
                    name: 'Phạm Thị Finance',
                    department: 'Finance',
                    position: 'Accountant',
                    role: 'employee',
                    permissions: [
                        'view_company_docs',
                        'view_reports'
                    ],
                    isActive: true
                },
                {
                    email: 'sales.employee@company.com',
                    password: await bcrypt.hash('sales123', 10),
                    name: 'Hoàng Văn Sales',
                    department: 'Sales',
                    position: 'Sales Executive',
                    role: 'employee',
                    permissions: [
                        'view_company_docs'
                    ],
                    isActive: true
                }
            ];
            
            await User.insertMany(sampleUsers);
            console.log('✅ Sample users created successfully!');
            console.log('\n📋 User Accounts:');
            console.log('👑 Admin: admin@company.com / admin123');
            console.log('🔧 IT Manager: it.manager@company.com / it123');
            console.log('⚙️  Operations Manager: operations.manager@company.com / ops123');
            console.log('👥 HR Employee: hr.employee@company.com / hr123');
            console.log('💰 Finance Employee: finance.employee@company.com / finance123');
            console.log('📈 Sales Employee: sales.employee@company.com / sales123');
        } else {
            console.log('👤 Users already exist in database');
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
