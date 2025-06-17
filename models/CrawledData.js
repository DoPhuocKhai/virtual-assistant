const mongoose = require('mongoose');

const crawledDataSchema = new mongoose.Schema({
    source: {
        type: String,
        required: true,
        enum: ['news', 'wiki']
    },
    title: String,
    content: {
        type: String,
        required: true
    },
    url: String,
    category: String,
    timestamp: {
        type: Date,
        default: Date.now
    },
    keywords: [String],
    metadata: mongoose.Schema.Types.Mixed
});

// Add text index for search
crawledDataSchema.index({ 
    title: 'text', 
    content: 'text',
    keywords: 'text' 
});

module.exports = mongoose.model('CrawledData', crawledDataSchema);
