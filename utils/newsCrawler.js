const axios = require('axios');
const cheerio = require('cheerio');

class NewsCrawler {
    constructor() {
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    }

    async crawlArticle(url) {
        try {
            console.log(`Crawling: ${url}`);
            
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                },
                timeout: 10000
            });

            const $ = cheerio.load(response.data);
            
            // Extract title
            let title = $('h1').first().text().trim() || 
                       $('title').text().trim() || 
                       $('.title').first().text().trim() ||
                       $('.article-title').first().text().trim();

            // Extract content based on common Vietnamese news site patterns
            let content = '';
            
            // Try different content selectors
            const contentSelectors = [
                '.article-content',
                '.content-detail',
                '.detail-content',
                '.article-body',
                '.content-body',
                '.post-content',
                '.entry-content',
                '.main-content p',
                '.content p',
                'article p',
                '.detail p'
            ];

            for (const selector of contentSelectors) {
                const elements = $(selector);
                if (elements.length > 0) {
                    content = elements.map((i, el) => $(el).text().trim()).get().join('\n');
                    if (content.length > 100) break;
                }
            }

            // If no content found, try to get all paragraphs
            if (!content || content.length < 100) {
                content = $('p').map((i, el) => $(el).text().trim()).get()
                    .filter(text => text.length > 50)
                    .join('\n');
            }

            // Extract date
            let publishDate = '';
            const dateSelectors = [
                '.publish-date',
                '.date',
                '.time',
                '.article-date',
                '.post-date',
                'time',
                '[datetime]'
            ];

            for (const selector of dateSelectors) {
                const dateEl = $(selector).first();
                if (dateEl.length > 0) {
                    publishDate = dateEl.attr('datetime') || dateEl.text().trim();
                    break;
                }
            }

            return {
                url,
                title: title.replace(/\s+/g, ' ').trim(),
                content: content.replace(/\s+/g, ' ').trim(),
                publishDate,
                crawledAt: new Date().toISOString()
            };

        } catch (error) {
            console.error(`Error crawling ${url}:`, error.message);
            return {
                url,
                title: '',
                content: '',
                publishDate: '',
                error: error.message,
                crawledAt: new Date().toISOString()
            };
        }
    }

    async crawlMultipleArticles(urls) {
        const results = [];
        
        for (const url of urls) {
            try {
                const article = await this.crawlArticle(url);
                results.push(article);
                
                // Add delay between requests to be respectful
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`Failed to crawl ${url}:`, error);
                results.push({
                    url,
                    title: '',
                    content: '',
                    error: error.message,
                    crawledAt: new Date().toISOString()
                });
            }
        }
        
        return results;
    }

    // Compile all crawled data into a comprehensive company information
    compileVNGData(articles) {
        let compiledData = {
            financialInfo: '',
            recentNews: '',
            achievements: '',
            businessUpdates: '',
            partnerships: '',
            fullContent: ''
        };

        const allContent = articles.map(article => {
            if (article.content) {
                return `${article.title}\n${article.content}\n---\n`;
            }
            return '';
        }).join('\n');

        compiledData.fullContent = allContent;

        // Categorize content based on keywords
        articles.forEach(article => {
            const content = `${article.title} ${article.content}`.toLowerCase();
            
            if (content.includes('doanh thu') || content.includes('lợi nhuận') || content.includes('tài chính') || content.includes('nasdaq') || content.includes('định giá')) {
                compiledData.financialInfo += `${article.title}\n${article.content}\n\n`;
            }
            
            if (content.includes('khen thưởng') || content.includes('giải thưởng') || content.includes('huân chương') || content.includes('bằng khen')) {
                compiledData.achievements += `${article.title}\n${article.content}\n\n`;
            }
            
            if (content.includes('hợp tác') || content.includes('partnership') || content.includes('nvidia') || content.includes('temasek')) {
                compiledData.partnerships += `${article.title}\n${article.content}\n\n`;
            }
            
            if (content.includes('data center') || content.includes('trung tâm dữ liệu') || content.includes('trụ sở') || content.includes('mở rộng')) {
                compiledData.businessUpdates += `${article.title}\n${article.content}\n\n`;
            }
            
            compiledData.recentNews += `${article.title}\n${article.content}\n\n`;
        });

        return compiledData;
    }
}

module.exports = new NewsCrawler();
