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

    // بەکارهێنانی سایتی فەرمی کە خۆت باست کرد و ئیشی کرد لە 1DM
    let targetUrl = `https://vidsrc.me/embed/movie?tmdb=${tmdb}`;
    if (isSeries === 'true') {
        targetUrl = `https://vidsrc.me/embed/tv?tmdb=${tmdb}&season=${season || 1}&episode=${episode || 1}`;
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
                '--js-flags="--max-old-space-size=256"'
            ]
        });

        const page = (await browser.pages())[0];

        // 💡 لاساییکردنەوەی بەرنامەی 1DM (خۆگۆڕین بۆ مۆبایلێکی گالاکسی)
        await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
        await page.setViewport({ width: 412, height: 915, isMobile: true });

        let videoUrl = null;

        // 💡 بلۆککەری ڕیکلامی دڕندە (هاوشێوەی 1DM)
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            const url = request.url();
            const type = request.resourceType();

            // بلۆککردنی وێنە و فۆنت بۆ خێرایی
            if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
                request.abort();
                return;
            }

            // بلۆککردنی هەموو ئەو سکریپتانەی کە ناوی ڕیکلامیان تێدایە یان هی کۆمپانیای ترن
            const badKeywords = ['pop', 'ad', 'track', 'stat', 'analytic', 'jejune', 'north-extn', 'yahoo', 'universal'];
            if (badKeywords.some(keyword => url.toLowerCase().includes(keyword))) {
                request.abort();
                return;
            }

            request.continue();
        });

        page.on('response', async (response) => {
            const url = response.url();
            // ڕاوکەری میدیا (Media Sniffer) بۆ گرتنی لینکی m3u8
            if (url.includes('.m3u8')) {
                videoUrl = url;
            }
        });

        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });

        // 💡 لێدانی دوگمەی پلەی هەروەک چۆن تۆ لەسەر شاشەی مۆبایلەکەت دەیکەیت
        for (let i = 0; i < 10; i++) {
            if (videoUrl) break;
            try {
                // بە زۆر کرتە دەکەین لە ناوەڕاستی شاشەی مۆبایلەکە
                await page.mouse.click(206, 457);
            } catch (e) {}
            await new Promise(r => setTimeout(r, 1000));
        }

        if (videoUrl) {
            res.json({ success: true, url: videoUrl });
        } else {
            res.status(404).json({ success: false, error: 'هێشتا نەدۆزرایەوە بە شێوازی 1DM' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (browser) await browser.close();
    }
});

app.get('/', (req, res) => res.send('سێرڤەری SEBAR TV بە سەرکەوتوویی کار دەکات! 🚀'));
app.listen(port, () => console.log(`Server running on port ${port}`));
