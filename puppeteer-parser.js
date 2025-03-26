const puppeteer = require('puppeteer');
const { setTimeout } = require('timers/promises');

// Конфигурация
const CONFIG = {
  maxRetries: 3,
  navigationTimeout: 90000, // 1.5 минуты
  waitForSelectorTimeout: 20000, // 20 секунд
  delayBetweenRetries: 10000, // 10 секунд
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  viewport: { width: 1280, height: 1024 }
};

// Транслитерация городов (сокращенная версия)
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
  
  return dict[cityName.toLowerCase()] || cityName.toLowerCase();
}

async function parseAvito(keyword, maxPrice, city = 'rossiya', limit = 50) {
  let browser;
  let page;
  let retryCount = 0;
  let lastError = null;

  while (retryCount < CONFIG.maxRetries) {
    try {
      console.log(`[Попытка ${retryCount + 1}] Запуск браузера...`);
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ],
        timeout: CONFIG.navigationTimeout
      });

      page = await browser.newPage();
      await page.setUserAgent(CONFIG.userAgent);
      await page.setViewport(CONFIG.viewport);
      await page.setDefaultTimeout(CONFIG.waitForSelectorTimeout);

      const url = `https://www.avito.ru/${transliterateCity(city)}?q=${encodeURIComponent(keyword)}${maxPrice ? `&pmax=${maxPrice}` : ''}`;
      console.log(`[${retryCount + 1}] Загрузка страницы: ${url}`);

      // Навигация с обработкой ошибок
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: CONFIG.navigationTimeout
      });

      if (!response.ok()) {
        throw new Error(`HTTP ${response.status()} - ${response.statusText()}`);
      }

      // Проверка на блокировку
      const isBlocked = await page.evaluate(() => {
        const captcha = document.querySelector('.captcha, .captcha-container');
        const blocked = document.body.textContent.includes('Доступ ограничен');
        return !!captcha || blocked;
      });

      if (isBlocked) {
        throw new Error('Обнаружена CAPTCHA или блокировка доступа');
      }

      console.log(`[${retryCount + 1}] Ожидание списка объявлений...`);
      
      // Ждем появления хотя бы одного объявления
      try {
        await page.waitForSelector('[data-marker="item"], .iva-item-root', {
          timeout: CONFIG.waitForSelectorTimeout
        });
      } catch (e) {
        // Проверяем вручную, если стандартное ожидание не сработало
        const hasItems = await page.evaluate(() => {
          return document.querySelectorAll('[data-marker="item"], .iva-item-root').length > 0;
        });
        
        if (!hasItems) {
          throw new Error('Не найдено ни одного объявления на странице');
        }
      }

      console.log(`[${retryCount + 1}] Парсинг данных...`);
      const ads = await parsePageData(page, limit);
      
      if (ads.length === 0 && retryCount < CONFIG.maxRetries - 1) {
        throw new Error('Получен пустой список объявлений');
      }

      return ads;

    } catch (error) {
      lastError = error;
      retryCount++;
      console.error(`[Ошибка ${retryCount}]: ${error.message}`);

      // Сохраняем скриншот для отладки
      if (page) {
        await page.screenshot({ path: `error_attempt_${retryCount}.png` });
      }

      if (retryCount < CONFIG.maxRetries) {
        console.log(`Повторная попытка через ${CONFIG.delayBetweenRetries/1000} сек...`);
        await setTimeout(CONFIG.delayBetweenRetries);
      }
    } finally {
      if (page) await page.close();
      if (browser) await browser.close();
    }
  }

  throw new Error(`Все попытки завершились ошибкой. Последняя ошибка: ${lastError.message}`);
}

// Парсинг данных со страницы
async function parsePageData(page, limit) {
  return await page.evaluate((limit) => {
    function parseDate(dateText) {
      if (!dateText) return new Date().toISOString();

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // "Сегодня, 12:30"
      if (/сегодня/i.test(dateText)) {
        const time = dateText.replace(/сегодня\D*/i, '').trim();
        const [hours, minutes] = time.split(':').map(Number);
        const date = new Date(today);
        date.setHours(hours, minutes);
        return date.toISOString();
      }

      // "Вчера, 15:45"
      if (/вчера/i.test(dateText)) {
        const time = dateText.replace(/вчера\D*/i, '').trim();
        const [hours, minutes] = time.split(':').map(Number);
        const date = new Date(today);
        date.setDate(date.getDate() - 1);
        date.setHours(hours, minutes);
        return date.toISOString();
      }

      // "5 мая 2023"
      const months = {
        'январ': 0, 'феврал': 1, 'март': 2, 'апрел': 3,
        'мая': 4, 'июн': 5, 'июл': 6, 'август': 7,
        'сентябр': 8, 'октябр': 9, 'ноябр': 10, 'декабр': 11
      };

      const match = dateText.match(/(\d{1,2})\s+([а-я]+)\s+(\d{4})?/i);
      if (match) {
        const day = parseInt(match[1]);
        const monthName = match[2].toLowerCase();
        const year = match[3] ? parseInt(match[3]) : now.getFullYear();
        
        let month = -1;
        for (const [key, value] of Object.entries(months)) {
          if (monthName.startsWith(key)) {
            month = value;
            break;
          }
        }

        if (month >= 0) {
          return new Date(year, month, day).toISOString();
        }
      }

      return new Date().toISOString();
    }

    const items = Array.from(document.querySelectorAll('[data-marker="item"], .iva-item-root'));
    const results = [];

    for (const item of items.slice(0, limit)) {
      try {
        // Название
        const titleEl = item.querySelector('[itemprop="name"], .iva-item-titleStep-2bjhf');
        const title = titleEl ? titleEl.textContent.trim() : 'Без названия';

        // Цена
        const priceEl = item.querySelector('[itemprop="price"], .iva-item-priceStep-2qRpg');
        let price = '0';
        if (priceEl) {
          price = priceEl.getAttribute('content') || 
                 priceEl.textContent.replace(/\D+/g, '') || '0';
        }

        // Ссылка
        const linkEl = item.querySelector('[itemprop="url"], .iva-item-titleStep-2bjhf a');
        let link = '#';
        if (linkEl) {
          link = linkEl.href || `https://www.avito.ru${linkEl.getAttribute('href')}`;
        }

        // Дата
        const dateEl = item.querySelector('[data-marker="item-date"], .iva-item-dateInfoStep-2uc5s');
        const date = dateEl ? parseDate(dateEl.textContent) : new Date().toISOString();

        if (title !== 'Без названия' && link !== '#') {
          results.push({
            title,
            price,
            priceNum: parseInt(price.replace(/\D+/g, '')) || 0,
            link,
            date
          });
        }
      } catch (e) {
        console.error('Ошибка парсинга элемента:', e);
      }
    }

    return results;
  }, limit);
}

module.exports = parseAvito;