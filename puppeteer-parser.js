const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { setTimeout } = require('timers/promises');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const CONFIG = {
  maxRetries: 3,
  navigationTimeout: 120000,
  waitForSelectorTimeout: 30000,
  delayBetweenRetries: 15000,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  viewport: { width: 1280, height: 1024 },
  debugDir: path.join(__dirname, 'debug')
};

if (!fs.existsSync(CONFIG.debugDir)) {
  fs.mkdirSync(CONFIG.debugDir);
}

function transliterateCity(cityName) {
  if (!cityName || cityName.toLowerCase() === 'россия') return 'rossiya';
  
  const dict = {
    'москва': 'moskva',
    'санкт-петербург': 'sankt-peterburg',
    'новосибирск': 'novosibirsk',
    'екатеринбург': 'ekaterinburg',
    'казань': 'kazan',
    'нижний новгород': 'nizhniy_novgorod',
    'ростов-на-дону': 'rostov-na-donu'
  };
  
  return dict[cityName.toLowerCase()] || cityName.toLowerCase().replace(/\s+/g, '-');
}

async function parseAvito(keyword, maxPrice, city = 'rossiya', limit = 50) {
  let browser;
  let page;
  let retryCount = 0;
  let lastError = null;

  if (!keyword || typeof keyword !== 'string') {
    throw new Error('Invalid keyword parameter');
  }

  while (retryCount < CONFIG.maxRetries) {
    try {
      console.log(`[Attempt ${retryCount + 1}/${CONFIG.maxRetries}] Launching browser...`);
      
      // Browser launch options
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-features=IsolateOrigins,site-per-process',
          '--window-size=1280,1024'
        ],
        timeout: CONFIG.navigationTimeout,
        ignoreHTTPSErrors: true
      });

      page = await browser.newPage();
      await page.setUserAgent(CONFIG.userAgent);
      await page.setViewport(CONFIG.viewport);
      await page.setDefaultNavigationTimeout(CONFIG.navigationTimeout);
      await page.setDefaultTimeout(CONFIG.waitForSelectorTimeout);

      await page.setExtraHTTPHeaders({
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      });

      const url = `https://www.avito.ru/${transliterateCity(city)}?q=${encodeURIComponent(keyword)}${maxPrice ? `&pmax=${maxPrice}` : ''}`;
      console.log(`[Attempt ${retryCount + 1}] Loading URL: ${url}`);

      await setTimeout(Math.random() * 3000 + 2000);

      const response = await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: CONFIG.navigationTimeout,
        referer: 'https://www.avito.ru/'
      });

      if (!response.ok()) {
        throw new Error(`HTTP ${response.status()} - ${response.statusText()}`);
      }

      const isBlocked = await page.evaluate(() => {
        const captcha = document.querySelector('.captcha, .captcha-container, div[class*="captcha"], iframe[src*="captcha"]');
        const blocked = document.body.textContent.includes('Доступ ограничен') || 
                      document.body.textContent.includes('Подозрительная активность') ||
                      document.body.textContent.includes('Превышен лимит запросов');
        return !!captcha || blocked;
      });

      if (isBlocked) {
        throw new Error('Обнаружена CAPTCHA или блокировка доступа');
      }

      console.log(`[Attempt ${retryCount + 1}] Waiting for ads...`);
      
      try {
        await page.waitForFunction(() => {
          const items = document.querySelectorAll('[data-marker="item"], .iva-item-root');
          return items.length > 0 || 
                document.querySelector('.items-empty') || 
                document.querySelector('.empty-results') ||
                document.querySelector('.error-page');
        }, { timeout: CONFIG.waitForSelectorTimeout });

       const noResults = await page.evaluate(() => {
          return !!document.querySelector('.items-empty, .empty-results');
        });

        if (noResults) {
          console.log('No results found for the query');
          return [];
        }

        const errorPage = await page.evaluate(() => {
          return !!document.querySelector('.error-page');
        });

        if (errorPage) {
          throw new Error('Avito returned an error page');
        }
      } catch (e) {
        throw new Error('Не найдено ни одного объявления на странице');
      }

      console.log(`[Attempt ${retryCount + 1}] Parsing ads data...`);
      const ads = await parsePageData(page, limit);
      
      if (ads.length === 0 && retryCount < CONFIG.maxRetries - 1) {
        throw new Error('Получен пустой список объявлений');
      }

      return ads;

    } catch (error) {
      lastError = error;
      retryCount++;
      console.error(`[Attempt ${retryCount} Error]: ${error.message}`);

      if (page) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        try {
          await page.screenshot({ 
            path: path.join(CONFIG.debugDir, `error_${timestamp}_attempt_${retryCount}.png`), 
            fullPage: true 
          });
          const html = await page.content();
          fs.writeFileSync(
            path.join(CONFIG.debugDir, `error_${timestamp}_attempt_${retryCount}.html`), 
            html
          );
        } catch (debugError) {
          console.error('Failed to save debug files:', debugError);
        }
      }

      if (retryCount < CONFIG.maxRetries) {
        const delay = CONFIG.delayBetweenRetries * (retryCount * 0.5 + 1);
        console.log(`Retrying in ${delay/1000} seconds...`);
        await setTimeout(delay);
      }
    } finally {
      if (page) await page.close().catch(console.error);
    }
  }

  if (browser) await browser.close().catch(console.error);
  throw new Error(`All ${CONFIG.maxRetries} attempts failed. Last error: ${lastError.message}`);
}

async function parsePageData(page, limit) {
  return await page.evaluate((limit) => {
    function parseDate(dateText) {
  if (!dateText) return new Date().toISOString();

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const timeRegex = /(\d{1,2}):(\d{1,2})/;
  const relativeRegex = /(\d+)\s+(минут[а-я]*|час[а-я]*|день|дн[я-я]*|секунд[а-я]*)/i;

  try {
    // "Только что" или "1 минуту назад"
    if (/только что/i.test(dateText) || /только что/i.test(dateText)) {
      return new Date().toISOString();
    }

    // Парсинг относительного времени
    const relativeMatch = dateText.match(relativeRegex);
    if (relativeMatch) {
      const value = parseInt(relativeMatch[1]);
      const unit = relativeMatch[2].toLowerCase();
      
      const date = new Date();
      
      if (unit.startsWith('секунд')) {
        date.setSeconds(date.getSeconds() - value);
      } else if (unit.startsWith('минут')) {
        date.setMinutes(date.getMinutes() - value);
      } else if (unit.startsWith('час')) {
        date.setHours(date.getHours() - value);
      } else if (unit.startsWith('дн')) {
        date.setDate(date.getDate() - value);
      }
      
      return date.toISOString();
    }
        // Сегодня с временем
        if (/сегодня/i.test(dateText)) {
          const timeMatch = dateText.match(timeRegex);
          if (timeMatch) {
            const date = new Date(today);
            date.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]));
            return date.toISOString();
          }
          return today.toISOString();
        }
    
        // Вчера с временем
        if (/вчера/i.test(dateText)) {
          const timeMatch = dateText.match(timeRegex);
          if (timeMatch) {
            const date = new Date(yesterday);
            date.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]));
            return date.toISOString();
          }
          return yesterday.toISOString();
        }
    
        // Полная дата (например, "20 мая в 12:30" или "15 марта 2023")
        const months = {
          'январ': 0, 'феврал': 1, 'март': 2, 'апрел': 3, 'мая': 4,
          'июн': 5, 'июл': 6, 'август': 7, 'сентябр': 8,
          'октябр': 9, 'ноябр': 10, 'декабр': 11
        };
    
        const dateMatch = dateText.match(/(\d{1,2})\s+([а-я]+)(?:\s+(\d{4}))?(?:\s+в\s+(\d{1,2}):(\d{1,2}))?/i);
        if (dateMatch) {
          const day = parseInt(dateMatch[1]);
          const monthName = dateMatch[2].toLowerCase();
          const year = dateMatch[3] ? parseInt(dateMatch[3]) : now.getFullYear();
          const hours = dateMatch[4] ? parseInt(dateMatch[4]) : 0;
          const minutes = dateMatch[5] ? parseInt(dateMatch[5]) : 0;
    
          for (const [key, value] of Object.entries(months)) {
            if (monthName.startsWith(key)) {
              return new Date(year, value, day, hours, minutes).toISOString();
            }
          }
        }
      } catch (e) {
        console.error('Date parsing error:', e);
      }
    
      return new Date().toISOString();
    }

    const items = Array.from(document.querySelectorAll('[data-marker="item"], .iva-item-root'));
    const results = [];

    for (const item of items.slice(0, limit)) {
      try {
        const titleEl = item.querySelector('[itemprop="name"], .iva-item-titleStep-2bjhf');
        const title = titleEl ? titleEl.textContent.trim() : 'Без названия';

        const priceEl = item.querySelector('[itemprop="price"], .iva-item-priceStep-2qRpg');
        let price = '0';
        if (priceEl) {
          price = priceEl.getAttribute('content') || 
                 priceEl.textContent.replace(/\D+/g, '') || '0';
        }

        const linkEl = item.querySelector('[itemprop="url"], .iva-item-titleStep-2bjhf a');
        let link = '#';
        if (linkEl) {
          link = linkEl.href || `https://www.avito.ru${linkEl.getAttribute('href')}`;
        }

        const dateEl = item.querySelector('[data-marker="item-date"], .iva-item-dateInfoStep-2uc5s');
        const date = dateEl ? parseDate(dateEl.textContent) : new Date().toISOString();

        const descEl = item.querySelector('[data-marker="item-specific-params"], .iva-item-descriptionStep-2qRpg');
        const description = descEl ? descEl.textContent.trim() : '';

        const locationEl = item.querySelector('[data-marker="item-address"], .iva-item-locationStep-2UHp2');
        const location = locationEl ? locationEl.textContent.trim() : '';

        if (title !== 'Без названия' && link !== '#') {
          results.push({
            title,
            price,
            priceNum: parseInt(price.replace(/\D+/g, '')) || 0,
            link,
            date,
            description,
            location
          });
        }
      } catch (e) {
        console.error('Error parsing item:', e);
      }
    }

    return results;
  }, limit);
}

module.exports = parseAvito;
