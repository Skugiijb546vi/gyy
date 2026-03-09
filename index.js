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

    // تەنها یەک سەرچاوەمان هێشتەوە بۆ ئەوەی ڕام پڕ نەبێت
    const targetUrl = isSeries === 'true' 
        ? `https://vidlink.pro/tv/${tmdb}/${season || 1}/${episode || 1}`
        : `https://vidlink.pro/movie/${tmdb}`;

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            executablePath: '/usr/bin/chromium',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // ڕێگری لە کێشەی میمۆری
                '--disable-accelerated-2d-canvas',
                '--no-zygote',
                '--single-process',
                '--disable-gpu',
                '--js-flags="--max-old-space-size=256"', // دیاریکردنی ڕام بە کەمترین ئاست
                '--disable-features=IsolateOrigins,site-per-process',
                '--blink-settings=imagesEnabled=false' // کوژاندنەوەی وێنەکان بۆ خێرایی
            ]
        });
        
        const page = (await browser.pages())[0];
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 800, height: 600 });
        
        let videoUrl = null;

        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('.m3u8') && !url.includes('ad')) {
                videoUrl = url;
            }
        });

        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        for (let i = 0; i < 6; i++) {
            if (videoUrl) break;
            try {
                await page.evaluate(() => {
                    const videos = document.querySelectorAll('video');
                    videos.forEach(v => v.play());
                });
                await page.mouse.click(400, 300);
            } catch (e) {}
            await new Promise(r => setTimeout(r, 2000));
        }

        if (videoUrl) {
            res.json({ success: true, url: videoUrl });
        } else {
            res.status(404).json({ success: false, error: 'نەتوانرا لینکەکە بدۆزرێتەوە' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (browser) await browser.close();
    }
});

app.get('/', (req, res) => res.send('سێرڤەری SEBAR TV بە سەرکەوتوویی کار دەکات! 🚀'));
app.listen(port, () => console.log(`Server running on port ${port}`));
