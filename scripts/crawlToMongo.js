const mongoose = require('mongoose');
const CrawledData = require('../models/CrawledData');
const newsCrawler = require('./newsCrawler');

async function saveToDB(articleData) {
    try {
        const newsData = new CrawledData({
            source: 'news',
            title: articleData.title,
            content: articleData.content,
            url: articleData.url,
            category: getCategoryFromContent(articleData.title + ' ' + articleData.content),
            keywords: extractKeywords(articleData.content),
            metadata: {
                publishDate: articleData.publishDate,
                crawledAt: articleData.crawledAt
            }
        });

        await newsData.save();
        console.log(`Saved to MongoDB: ${articleData.title}`);
        return newsData;
    } catch (error) {
        console.error(`Error saving to MongoDB: ${error.message}`);
        return null;
    }
}

function getCategoryFromContent(text) {
    text = text.toLowerCase();
    if (text.includes('doanh thu') || text.includes('lợi nhuận') || text.includes('tài chính') || text.includes('nasdaq')) {
        return 'financial';
    }
    if (text.includes('giải thưởng') || text.includes('huân chương') || text.includes('bằng khen')) {
        return 'achievements';
    }
    if (text.includes('hợp tác') || text.includes('partnership')) {
        return 'partnerships';
    }
    if (text.includes('data center') || text.includes('trung tâm dữ liệu') || text.includes('mở rộng')) {
        return 'business_updates';
    }
    return 'general';
}

function extractKeywords(content) {
    const keywords = new Set();
    const keywordPatterns = [
        /VNG|Zalo|ZaloPay/gi,
        /Cloud|AI|Blockchain/gi,
        /Nasdaq|IPO|cổ phiếu/gi,
        /doanh thu|lợi nhuận|tài chính/gi,
        /giải thưởng|thành tựu|bằng khen/gi,
        /hợp tác|đối tác|partnership/gi
    ];

    keywordPatterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
            matches.forEach(match => keywords.add(match.toLowerCase()));
        }
    });

    return Array.from(keywords);
}

async function crawlAndSaveToMongo(urls) {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB Atlas');

        // Crawl articles
        const articles = await newsCrawler.crawlMultipleArticles(urls);
        
        // Save each article to MongoDB
        const savedArticles = [];
        for (const article of articles) {
            if (article && article.title && article.content) {
                const saved = await saveToDB(article);
                if (saved) {
                    savedArticles.push(saved);
                }
            }
        }

        console.log(`Successfully saved ${savedArticles.length} articles to MongoDB`);
        return savedArticles;
    } catch (error) {
        console.error('Error in crawlAndSaveToMongo:', error);
        throw error;
    } finally {
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
    }
}

async function getCompiledData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        const articles = await CrawledData.find({ source: 'news' })
            .sort('-metadata.publishDate')
            .limit(50);  // Get latest 50 articles

        let compiledData = {
            financialInfo: '',
            recentNews: '',
            achievements: '',
            businessUpdates: '',
            partnerships: '',
            fullContent: ''
        };

        articles.forEach(article => {
            const content = `${article.title}\n${article.content}\n\n`;
            
            switch(article.category) {
                case 'financial':
                    compiledData.financialInfo += content;
                    break;
                case 'achievements':
                    compiledData.achievements += content;
                    break;
                case 'partnerships':
                    compiledData.partnerships += content;
                    break;
                case 'business_updates':
                    compiledData.businessUpdates += content;
                    break;
            }
            
            compiledData.recentNews += content;
            compiledData.fullContent += content;
        });

        return compiledData;
    } catch (error) {
        console.error('Error getting compiled data:', error);
        throw error;
    } finally {
        await mongoose.connection.close();
    }
}

module.exports = {
    crawlAndSaveToMongo,
    getCompiledData
};
