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

    const sources = isSeries === 'true' 
        ? [
            `https://vidlink.pro/tv/${tmdb}/${season || 1}/${episode || 1}`,
            `https://autoembed.co/tv/tmdb/${tmdb}-${season || 1}-${episode || 1}`
          ]
        : [
            `https://vidlink.pro/movie/${tmdb}`,
            `https://autoembed.co/movie/tmdb/${tmdb}`
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
        
        // 💡 چەکی نوێ: داخستنی هەموو پۆپ‌ئەپ و تابە نوێیەکانی ڕیکلام لە هەمان چرکەدا!
        browser.on('targetcreated', async (target) => {
            if (target.type() === 'page') {
                const newPage = await target.page();
                const pages = await browser.pages();
                // ئەگەر تابێکی نوێ کرایەوە جگە لە تابی سەرەکی، ڕاستەوخۆ دایبخە
                if (newPage && pages.length > 1 && newPage !== pages[0]) {
                    await newPage.close();
                }
            }
        });

        const page = (await browser.pages())[0];
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1080, height: 720 });
        
        let videoUrl = null;

        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('.m3u8') && !url.includes('ad')) {
                videoUrl = url;
            }
        });

        for (const targetUrl of sources) {
            if (videoUrl) break; 
            
            try {
                // کاتی چاوەڕوانی زیاترمان دانا بۆ ئەوەی سایتەکە بەتەواوی لۆد بێت
                await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
                
                for (let i = 0; i < 8; i++) {
                    if (videoUrl) break;
                    try {
                        // 💡 چەکی دووەم: هێزی زۆرەملێ! ڕاستەوخۆ بە کۆد ڤیدیۆکە لێدەدات
                        await page.evaluate(() => {
                            const videos = document.querySelectorAll('video');
                            videos.forEach(v => v.play());
                        });
                        // هەروەها پەنجەش دەدات نەوەک کۆدەکە بلۆک کرابێت
                        await page.mouse.click(540, 360);
                    } catch (e) {}
                    await new Promise(r => setTimeout(r, 2000));
                }
            } catch (e) {
                console.log("Error with source: ", targetUrl);
            }
        }

        if (videoUrl) {
            res.json({ success: true, url: videoUrl });
        } else {
            res.status(404).json({ 
                success: false, 
                error: 'نەتوانرا لینکەکە بدۆزرێتەوە',
                debug_title: await page.title().catch(() => "Unknown")
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
