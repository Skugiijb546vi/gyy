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

    let targetUrl = `https://vidsrcme.ru/embed/movie?tmdb=${tmdb}`;
    if (isSeries === 'true') {
        targetUrl = `https://vidsrcme.ru/embed/tv?tmdb=${tmdb}&season=${season || 1}&episode=${episode || 1}`;
    }

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ]
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width: 1080, height: 720 });
        
        let videoUrl = null;

        await page.setRequestInterception(true);
        page.on('request', (request) => {
            const url = request.url();
            if (url.includes('jejunejamboree') || url.includes('north-extn') || url.includes('ad')) {
                request.abort();
            } else {
                request.continue();
            }
        });

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
                await page.mouse.click(540, 360);
            } catch (e) {}
            await new Promise(r => setTimeout(r, 1000));
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

app.get('/', (req, res) => {
    res.send('سێرڤەری SEBAR TV بە سەرکەوتوویی کار دەکات! 🚀');
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
