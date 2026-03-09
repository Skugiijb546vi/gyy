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

    // 💡 لێرەدا وازمان لە vidsrc هێنا و دوو سایتی زۆر باشترمان داناوە کە کلاودفلێریان نییە
    const sources = isSeries === 'true' 
        ? [
            `https://autoembed.co/tv/tmdb/${tmdb}-${season || 1}-${episode || 1}`,
            `https://vidlink.pro/tv/${tmdb}/${season || 1}/${episode || 1}`
          ]
        : [
            `https://autoembed.co/movie/tmdb/${tmdb}`,
            `https://vidlink.pro/movie/${tmdb}`
          ];

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
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1080, height: 720 });
        
        let videoUrl = null;

        page.on('response', async (response) => {
            const url = response.url();
            // گەڕان بەدوای فایلی ڤیدیۆکەدا
            if (url.includes('.m3u8') && !url.includes('ad')) {
                videoUrl = url;
            }
        });

        // گەڕان بەناو سایتەکاندا یەک بە یەک (ئەگەر یەکەمیان گیرا، دەچێتە دووەم)
        for (const targetUrl of sources) {
            if (videoUrl) break; 
            
            try {
                await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
                
                // کلیک کردن بۆ کارپێکردنی ڤیدیۆکە و داخستنی ڕیکلام
                for (let i = 0; i < 6; i++) {
                    if (videoUrl) break;
                    try {
                        await page.mouse.click(540, 360);
                        await new Promise(r => setTimeout(r, 500));
                        await page.mouse.click(540, 360); // دبل کلیک بۆ تێپەڕاندنی ڕیکلام
                    } catch (e) {}
                    await new Promise(r => setTimeout(r, 1500));
                }
            } catch (e) {
                console.log("Error with source: ", targetUrl);
            }
        }

        if (videoUrl) {
            res.json({ success: true, url: videoUrl });
        } else {
            const pageTitle = await page.title();
            res.status(404).json({ 
                success: false, 
                error: 'لە هیچ کامیان نەدۆزرایەوە',
                debug_title: pageTitle
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (browser) await browser.close();
    }
});

app.get('/', (req, res) => res.send('سێرڤەری SEBAR TV بە سەرکەوتوویی کار دەکات! 🚀'));
app.listen(port, () => console.log(`Server running on port ${port}`));
