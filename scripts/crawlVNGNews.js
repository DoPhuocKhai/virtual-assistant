const mongoose = require('mongoose');
const CompanyData = require('../models/CompanyData');
const newsCrawler = require('../utils/newsCrawler');
require('dotenv').config();

const vngNewsUrls = [
    'https://cafef.vn/vng-quy-i-2025-doanh-thu-2232-ty-dong-loi-nhuan-tang-vot-188250506191738327.chn',
    'https://vneconomy.vn/loi-nhuan-giam-75-vi-sao-vng-van-duoc-dinh-gia-1-ty-usd.htm',
    'https://vietnamnet.vn/vng-chinh-thuc-ky-ban-ghi-nho-niem-yet-co-phieu-tren-san-nasdaq-i354343.html',
    'https://vtv.vn/cong-nghe/vng-chinh-thuc-khai-truong-tru-so-moi-rong-hon-52000m2-20191113103238453.htm',
    'https://vneconomy.vn/vng-duoc-quy-dau-tu-temasek-dinh-gia-toi-22-ty-usd.htm',
    'https://www.bloomberg.com/news/articles/2023-08-23/vng-files-to-become-first-vietnam-tech-firm-to-go-public-in-us?embedded-checkout=true',
    'https://cafef.vn/co-phieu-vnz-dat-nhat-lich-su-chung-khoan-viet-nam-vng-can-moc-von-hoa-ty-usd-20230210143054239.chn',
    'https://thanhnien.vn/vng-greennode-hop-tac-nvidia-khai-truong-trung-tam-du-lieu-ai-cloud-tai-thai-lan-185240625112329667.htm',
    'https://baodautu.vn/vng-xay-dung-data-center-lon-nhat-viet-nam-ban-dich-vu-cloud-ra-the-gioi-d215258.html',
    'https://tienphong.vn/vng-nhan-bang-khen-cua-ubnd-tphcm-post618222.tpo',
    'https://www.qdnd.vn/chinh-tri/tin-tuc/cong-ty-cp-vng-don-huan-chuong-lao-dong-hang-ba-323302',
    'https://vietnamnet.vn/vng-don-nhan-bang-khen-doanh-nghiep-tieu-bieu-2017-i354317.html',
    'https://nhandan.vn/zalo-cua-bo-y-te-gui-hon-35-ty-thong-bao-ve-covid-19-den-nguoi-dan-post607756.html',
    'https://www.qdnd.vn/xa-hoi/tin-tuc/zalo-nhan-giay-khen-tu-giam-doc-cong-an-tp-ho-chi-minh-725289',
    'https://nguoidothi.net.vn/zalo-duoc-trao-bang-khen-vi-dong-gop-xuat-sac-trong-ho-tro-hoat-dong-chuyen-doi-so-46447.html',
    'https://vnggames.com/vn/vi'
];

async function crawlAndUpdateVNGData() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        console.log('Starting to crawl VNG news articles...');
        
        // Crawl all articles
        const articles = await newsCrawler.crawlMultipleArticles(vngNewsUrls);
        
        console.log(`Successfully crawled ${articles.length} articles`);
        
        // Compile the data
        const compiledData = newsCrawler.compileVNGData(articles);
        
        // Get existing company data
        let companyData = await CompanyData.findOne({ isActive: true });
        
        if (!companyData) {
            console.log('No existing company data found, creating new entry...');
            companyData = new CompanyData({
                name: 'VNG Corporation',
                tradingName: 'VNG',
                isActive: true
            });
        }

        // Update company data with news information
        const currentDate = new Date().toISOString();
        
        // Add financial information
        if (compiledData.financialInfo) {
            companyData.financialInfo = compiledData.financialInfo;
        }
        
        // Add recent news and updates
        companyData.recentNews = compiledData.recentNews;
        companyData.achievements = compiledData.achievements;
        companyData.partnerships = compiledData.partnerships;
        companyData.businessUpdates = compiledData.businessUpdates;
        
        // Update the main content with comprehensive information
        const enhancedContent = `
VNG CORPORATION - THÔNG TIN TOÀN DIỆN

=== THÔNG TIN TÀI CHÍNH ===
${compiledData.financialInfo}

=== THÀNH TỰU VÀ GIẢI THƯỞNG ===
${compiledData.achievements}

=== ĐỐI TÁC VÀ HỢP TÁC ===
${compiledData.partnerships}

=== CẬP NHẬT KINH DOANH ===
${compiledData.businessUpdates}

=== TIN TỨC GÂN ĐÂY ===
${compiledData.recentNews}

=== NỘI DUNG ĐẦY ĐỦ ===
${compiledData.fullContent}
        `;
        
        // Update all company data fields
        Object.assign(companyData, {
            content: enhancedContent,
            sourceUrl: 'https://www.vng.com.vn/',
            lastUpdated: new Date(),
            newsLastCrawled: new Date()
        });

        // Save the updated data
        await companyData.save();

        console.log('Successfully updated VNG company data with news information');
        console.log(`Total content length: ${enhancedContent.length} characters`);
        
        // Log summary of what was crawled
        console.log('\n=== CRAWL SUMMARY ===');
        articles.forEach((article, index) => {
            console.log(`${index + 1}. ${article.title || 'No title'}`);
            console.log(`   URL: ${article.url}`);
            console.log(`   Content length: ${article.content ? article.content.length : 0} chars`);
            if (article.error) {
                console.log(`   Error: ${article.error}`);
            }
            console.log('');
        });

        // Return the updated company data
        return companyData;
        
    } catch (error) {
        console.error('Error crawling VNG news:', error);
        throw error; // Re-throw to handle in the chat route
    }
}

// Run the script
if (require.main === module) {
    crawlAndUpdateVNGData();
}

module.exports = { crawlAndUpdateVNGData };
