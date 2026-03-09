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
            executablePath: '/usr/bin/chromium',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-zygote',
                '--single-process',
                '--disable-gpu',
                '--js-flags="--max-old-space-size=256"',
                '--autoplay-policy=no-user-gesture-required' // 💡 ڕێگەپێدان بە لێدانی ڤیدیۆ بەبێ پەنجەدان
            ]
        });
        
        browser.on('targetcreated', async (target) => {
            if (target.type() === 'page') {
                const newPage = await target.page();
                const pages = await browser.pages();
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

        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });

        for (let i = 0; i < 15; i++) {
            if (videoUrl) break;
            try {
                await page.mouse.click(540, 360);
                
                // 💡 چوونە ناو هەموو بۆکسە شاراوەکانی سایتەکە (Iframes)
                const frames = page.frames();
                for (const frame of frames) {
                    try {
                        await frame.evaluate(() => {
                            const video = document.querySelector('video');
                            if (video) {
                                video.muted = true; // دەبێت بێدەنگ بێت تا کۆد کار بکات
                                video.play();
                            }
                        });
                    } catch(e) {}
                }
            } catch (e) {}
            await new Promise(r => setTimeout(r, 1500));
        }

        if (videoUrl) {
            res.json({ success: true, url: videoUrl });
        } else {
            res.status(404).json({ success: false, error: 'نەتوانرا لەناو چوارچێوەکانیشدا بدۆزرێتەوە' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (browser) await browser.close();
    }
});

app.get('/', (req, res) => res.send('سێرڤەری SEBAR TV بە سەرکەوتوویی کار دەکات! 🚀'));
app.listen(port, () => console.log(`Server running on port ${port}`));
