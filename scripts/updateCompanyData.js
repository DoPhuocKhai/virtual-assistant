const mongoose = require('mongoose');
const dotenv = require('dotenv');
const wikiCrawler = require('../utils/wikiCrawler');
const CompanyData = require('../models/CompanyData');
const Document = require('../models/Document');

dotenv.config();

async function updateCompanyData() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        // Crawl VNG data from Wikipedia
        console.log('Crawling VNG data from Wikipedia...');
        const vngData = await wikiCrawler.crawlVNGInfo();
        
        // Mark all existing company data as inactive
        await CompanyData.updateMany({}, { isActive: false });

        // Create new company data
        const companyData = new CompanyData({
            ...vngData,
            sourceUrl: 'https://vi.wikipedia.org/wiki/VNG',
            isActive: true
        });
        await companyData.save();
        console.log('Saved new company data');

        // Create or update company overview document
        const overviewDoc = {
            title: 'Tổng quan về VNG Corporation',
            content: companyData.formatForContext(),
            category: 'company_policy',
            department: 'All',
            accessLevel: 'public',
            tags: ['company', 'overview', 'VNG'],
            status: 'published',
            metadata: {
                keywords: ['VNG', 'công ty', 'tổng quan', 'giới thiệu'],
                documentNumber: 'VNG-OVERVIEW-001'
            }
        };

        await Document.findOneAndUpdate(
            { title: overviewDoc.title },
            overviewDoc,
            { upsert: true, new: true }
        );
        console.log('Updated company overview document');

        // Create company policies document
        const policiesDoc = {
            title: 'Chính sách và Quy định VNG',
            content: `
CHÍNH SÁCH VÀ QUY ĐỊNH VNG CORPORATION

1. GIÁ TRỊ CỐT LÕI
- Đón nhận thách thức
- Phát triển đối tác
- Giữ gìn chính trực
- Tôn trọng cá nhân
- Định hướng hiệu quả

2. QUY ĐỊNH CHUNG
- Tuân thủ các quy định của công ty và pháp luật
- Bảo mật thông tin
- Tôn trọng quyền sở hữu trí tuệ
- Chống tham nhũng và xung đột lợi ích

3. CHÍNH SÁCH NHÂN SỰ
- Môi trường làm việc chuyên nghiệp
- Cơ hội phát triển công bằng
- Đánh giá dựa trên hiệu quả công việc
- Chế độ phúc lợi cạnh tranh

4. QUY TẮC ỨNG XỬ
- Tôn trọng đồng nghiệp
- Giao tiếp chuyên nghiệp
- Trang phục phù hợp
- Bảo vệ tài sản công ty

5. CHÍNH SÁCH CÔNG NGHỆ
- Sử dụng email công ty cho công việc
- Bảo mật thông tin và dữ liệu
- Tuân thủ quy định về bản quyền
- Báo cáo các vấn đề bảo mật

* Tài liệu này được cập nhật dựa trên thông tin công khai của VNG và các giá trị cốt lõi của công ty.
            `,
            category: 'company_policy',
            department: 'All',
            accessLevel: 'public',
            tags: ['chính sách', 'quy định', 'VNG'],
            status: 'published',
            metadata: {
                keywords: ['chính sách', 'quy định', 'giá trị cốt lõi', 'VNG'],
                documentNumber: 'VNG-POLICY-001'
            }
        };

        await Document.findOneAndUpdate(
            { title: policiesDoc.title },
            policiesDoc,
            { upsert: true, new: true }
        );
        console.log('Updated company policies document');

        console.log('Company data update completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error updating company data:', error);
        process.exit(1);
    }
}

// Run the update
updateCompanyData();
