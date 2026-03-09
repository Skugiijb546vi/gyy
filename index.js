const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());
const port = process.env.PORT || 3000;

app.get('/api/get-link', async (req, res) => {
    const { tmdb, isSeries, season, episode } = req.query;
    if (!tmdb) return res.status(400).json({ error: 'تکایە ئایدی فیلمەکە بنێرە' });

    // بەکارهێنانی باشترین دۆمەینی سایتەکە
    let targetUrl = `https://vidsrc.net/embed/movie?tmdb=${tmdb}`;
    if (isSeries === 'true') {
        targetUrl = `https://vidsrc.net/embed/tv?tmdb=${tmdb}&season=${season || 1}&episode=${episode || 1}`;
    }

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            executablePath: '/usr/bin/chromium',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-zygote',
                '--single-process',
                '--disable-gpu',
                '--disable-web-security'
            ]
        });
        
        const page = await browser.newPage();
        
        // خۆگۆڕین بۆ ئەوەی سایتەکە نەزانێت ڕۆبۆتین
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1080, height: 720 });
        
        let videoUrl = null;

        page.on('response', async (response) => {
            const url = response.url();
            // گەڕان بەدوای فایلی ڤیدیۆکەدا
            if (url.includes('.m3u8')) {
                videoUrl = url;
            }
        });

        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // لێدانی پەنجەی زیرەک بۆ بڕینی ڕیکلام و کارپێکردنی ڤیدیۆ
        for (let i = 0; i < 10; i++) {
            if (videoUrl) break;
            try {
                await page.mouse.click(540, 360);
            } catch (e) {}
            // چاوەڕێکردنێکی زیاتر تا ڕیکلامەکە دەڕوات
            await new Promise(r => setTimeout(r, 1500));
        }

        if (videoUrl) {
            res.json({ success: true, url: videoUrl });
        } else {
            // ئەگەر نەیدۆزیەوە، پێمان دەڵێت ڕۆبۆتەکە چی بینیوە!
            const pageTitle = await page.title();
            const pageUrl = page.url();
            res.status(404).json({ 
                success: false, 
                error: 'نەتوانرا لینکەکە بدۆزرێتەوە',
                debug_title: pageTitle,
                debug_url: pageUrl
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (browser) await browser.close();
    }
});

app.get('/', (req, res) => {
    res.send('سێرڤەری SEBAR TV بە سەرکەوتوویی کار دەکات! 🚀');
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
