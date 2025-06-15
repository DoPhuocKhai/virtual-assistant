const axios = require('axios');
const cheerio = require('cheerio');

class WikiCrawler {
    constructor() {
        this.baseUrl = 'https://vi.wikipedia.org';
    }

    async crawlVNGInfo() {
        try {
            const response = await axios.get('https://vi.wikipedia.org/wiki/VNG');
            const $ = cheerio.load(response.data);
            
            // Initialize data object
            const companyData = {
                name: 'VNG Corporation',
                tradingName: '',
                type: '',
                founded: '',
                headquarters: '',
                keyPeople: [],
                industry: [],
                products: [],
                revenue: '',
                employees: '',
                website: '',
                description: '',
                history: '',
                content: ''
            };

            // Extract infobox data
            const infobox = $('.infobox');
            infobox.find('tr').each((i, elem) => {
                const label = $(elem).find('th').text().trim();
                const value = $(elem).find('td').text().trim();
                
                switch(label) {
                    case 'Tên giao dịch':
                        companyData.tradingName = value;
                        break;
                    case 'Loại':
                        companyData.type = value;
                        break;
                    case 'Thành lập':
                        companyData.founded = value;
                        break;
                    case 'Trụ sở':
                        companyData.headquarters = value;
                        break;
                    case 'Người điều hành':
                        companyData.keyPeople = value.split('\n').map(p => p.trim()).filter(p => p);
                        break;
                    case 'Ngành':
                        companyData.industry = value.split('\n').map(i => i.trim()).filter(i => i);
                        break;
                    case 'Sản phẩm':
                        companyData.products = value.split('\n').map(p => p.trim()).filter(p => p);
                        break;
                    case 'Doanh thu':
                        companyData.revenue = value;
                        break;
                    case 'Số nhân viên':
                        companyData.employees = value;
                        break;
                    case 'Website':
                        companyData.website = value;
                        break;
                }
            });

            // Extract main content
            const mainContent = $('#mw-content-text');
            
            // Get description (first paragraph)
            companyData.description = mainContent.find('p').first().text().trim();

            // Get history
            const historySection = mainContent.find('#Lịch_sử').parent().nextUntil('h2');
            companyData.history = historySection.text().trim();

            // Get full content
            companyData.content = mainContent.text().trim();

            return companyData;
        } catch (error) {
            console.error('Error crawling VNG info:', error);
            throw error;
        }
    }
}

module.exports = new WikiCrawler();
