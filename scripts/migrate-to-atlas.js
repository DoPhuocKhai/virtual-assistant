require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const CompanyData = require('../models/CompanyData');
const Document = require('../models/Document');
const Meeting = require('../models/Meeting');
const Task = require('../models/Task');
const Mailbox = require('../models/Mailbox');
const AssistantChat = require('../models/AssistantChat');

// Source (Local) MongoDB connection
const sourceUri = 'mongodb://localhost:27017/virtual-assistant';

// Target (Atlas) MongoDB connection
const targetUri = process.env.MONGODB_URI;

async function migrateData() {
    try {
        // Connect to source database
        const sourceConn = await mongoose.createConnection(sourceUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to source database');

        // Connect to target database
        const targetConn = await mongoose.createConnection(targetUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to target database');

        // Define models for both connections
        const sourceModels = {
            User: sourceConn.model('User', User.schema),
            CompanyData: sourceConn.model('CompanyData', CompanyData.schema),
            Document: sourceConn.model('Document', Document.schema),
            Meeting: sourceConn.model('Meeting', Meeting.schema),
            Task: sourceConn.model('Task', Task.schema),
            Mailbox: sourceConn.model('Mailbox', Mailbox.schema),
            AssistantChat: sourceConn.model('AssistantChat', AssistantChat.schema)
        };

        const targetModels = {
            User: targetConn.model('User', User.schema),
            CompanyData: targetConn.model('CompanyData', CompanyData.schema),
            Document: targetConn.model('Document', Document.schema),
            Meeting: targetConn.model('Meeting', Meeting.schema),
            Task: targetConn.model('Task', Task.schema),
            Mailbox: targetConn.model('Mailbox', Mailbox.schema),
            AssistantChat: targetConn.model('AssistantChat', AssistantChat.schema)
        };

        // Migrate each collection
        for (const [modelName, sourceModel] of Object.entries(sourceModels)) {
            console.log(`Migrating ${modelName}...`);
            
            // Get all documents from source
            const documents = await sourceModel.find({});
            console.log(`Found ${documents.length} ${modelName} documents`);

            if (documents.length > 0) {
                // Insert into target
                await targetModels[modelName].insertMany(documents);
                console.log(`Migrated ${documents.length} ${modelName} documents`);
            }
        }

        console.log('Migration completed successfully');

        // Close connections
        await sourceConn.close();
        await targetConn.close();
        console.log('Database connections closed');

    } catch (error) {
        console.error('Migration error:', error);
    }
}

// Run migration
migrateData().then(() => {
    console.log('Migration script finished');
    process.exit(0);
}).catch(error => {
    console.error('Migration script error:', error);
    process.exit(1);
});
