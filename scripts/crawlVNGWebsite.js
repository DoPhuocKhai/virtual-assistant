const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');
const url = require('url');

class VNGWebsiteCrawler {
    constructor() {
        this.baseUrl = 'https://vng.com.vn';
        this.visitedUrls = new Set();
        this.data = {
            mainContent: {},
            news: [],
            products: [],
            about: {},
            careers: [],
            links: [],
            lastUpdated: new Date().toISOString()
        };
        this.maxDepth = 3; // Maximum depth for recursive crawling
        
        // Configure axios with headers
        this.axiosInstance = axios.create({
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            timeout: 30000,
            maxRedirects: 5
        });
    }

    async init() {
        try {
            console.log('Starting VNG website crawler...');
            await this.crawlPage(this.baseUrl, 0);
            await this.saveData();
            console.log('Crawling completed successfully!');
        } catch (error) {
            console.error('Crawling failed:', error);
            throw error;
        }
    }

    async crawlPage(pageUrl, depth) {
        if (depth > this.maxDepth || this.visitedUrls.has(pageUrl)) {
            return;
        }

        try {
            console.log(`Crawling: ${pageUrl}`);
            this.visitedUrls.add(pageUrl);

            const response = await this.axiosInstance.get(pageUrl);
            const $ = cheerio.load(response.data);

            // Extract page content
            const pageData = {
                url: pageUrl,
                title: $('title').text().trim(),
                description: $('meta[name="description"]').attr('content'),
                content: this.extractContent($),
                links: this.extractLinks($, pageUrl)
            };

            // Categorize and store content based on URL path
            this.categorizeContent(pageUrl, pageData);

            // Recursively crawl linked pages
            for (const link of pageData.links) {
                if (this.shouldCrawl(link)) {
                    await this.crawlPage(link, depth + 1);
                }
            }

        } catch (error) {
            console.error(`Error crawling ${pageUrl}:`, error.message);
        }
    }

    extractContent($) {
        const content = {
            headings: [],
            paragraphs: [],
            lists: []
        };

        // Extract headings
        $('h1, h2, h3, h4, h5, h6').each((i, el) => {
            content.headings.push({
                level: el.name,
                text: $(el).text().trim()
            });
        });

        // Extract paragraphs
        $('p').each((i, el) => {
            const text = $(el).text().trim();
            if (text) {
                content.paragraphs.push(text);
            }
        });

        // Extract lists
        $('ul, ol').each((i, el) => {
            const items = [];
            $(el).find('li').each((i, li) => {
                items.push($(li).text().trim());
            });
            if (items.length > 0) {
                content.lists.push(items);
            }
        });

        return content;
    }

    extractLinks($, currentUrl) {
        const links = new Set();
        
        $('a[href]').each((i, el) => {
            let href = $(el).attr('href');
            
            // Resolve relative URLs
            try {
                href = url.resolve(currentUrl, href);
                
                // Only include VNG domain links
                if (href.includes('vng.com.vn') || href.includes('vinagame.vn')) {
                    links.add(href);
                }
            } catch (error) {
                console.error(`Error processing link ${href}:`, error.message);
            }
        });

        return Array.from(links);
    }

    shouldCrawl(link) {
        // Skip if already visited
        if (this.visitedUrls.has(link)) {
            return false;
        }

        // Skip non-VNG domains
        if (!link.includes('vng.com.vn') && !link.includes('vinagame.vn')) {
            return false;
        }

        // Skip file downloads
        const fileExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip', '.rar'];
        if (fileExtensions.some(ext => link.toLowerCase().endsWith(ext))) {
            return false;
        }

        return true;
    }

    categorizeContent(pageUrl, pageData) {
        const urlPath = new URL(pageUrl).pathname.toLowerCase();

        if (urlPath === '/' || urlPath === '/en' || urlPath === '/vi') {
            this.data.mainContent = pageData;
        }
        else if (urlPath.includes('news') || urlPath.includes('tin-tuc')) {
            this.data.news.push(pageData);
        }
        else if (urlPath.includes('product') || urlPath.includes('san-pham')) {
            this.data.products.push(pageData);
        }
        else if (urlPath.includes('about') || urlPath.includes('gioi-thieu')) {
            this.data.about = {
                ...this.data.about,
                ...pageData
            };
        }
        else if (urlPath.includes('career') || urlPath.includes('tuyen-dung')) {
            this.data.careers.push(pageData);
        }
        
        // Store all unique links
        this.data.links = [...new Set([...this.data.links, ...pageData.links])];
    }

    async saveData() {
        try {
            const outputDir = path.join(__dirname, '..', 'data');
            await fs.mkdir(outputDir, { recursive: true });

            const outputPath = path.join(outputDir, 'vng_website_data.json');
            await fs.writeFile(
                outputPath,
                JSON.stringify(this.data, null, 2),
                'utf8'
            );

            console.log(`Data saved to ${outputPath}`);
            console.log(`Total pages crawled: ${this.visitedUrls.size}`);
            console.log(`Total links found: ${this.data.links.length}`);
        } catch (error) {
            console.error('Error saving data:', error);
            throw error;
        }
    }
}

// Execute the crawler
const crawler = new VNGWebsiteCrawler();
crawler.init().catch(console.error);

module.exports = VNGWebsiteCrawler;
