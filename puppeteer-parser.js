const puppeteer = require('puppeteer');

function transliterateCity(cityName) {
  // Полный словарь транслитерации Avito
  const cyrillicToLatin = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd',
    'е': 'e', 'ё': 'yo', 'ж': 'zh', 'з': 'z', 'и': 'i',
    'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n',
    'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't',
    'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch',
    'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '',
    'э': 'e', 'ю': 'yu', 'я': 'ya',
    ' ': '-', '_': '-', "'": '', '`': '', ',': ''
  };

  // Специальные исключения для городов
  const exceptions = {
    'балашиха': 'balashikha',
    'брянск': 'bryansk',
    'волгоград': 'volgograd', // "ь" отсутствует, но добавлен для единообразия
    'воронеж': 'voronezh',
    'екатеринбург': 'ekaterinburg',
    'иваново': 'ivanovo',
    'ижевск': 'izhevsk',
    'йошкар-ола': 'yoshkar-ola',
    'казань': 'kazan',
    'калуга': 'kaluga',
    'курск': 'kursk',
    'липецк': 'lipetsk',
    'люберцы': 'lyubertsy',
    'москва': 'moskva',
    'мытищи': 'mytishchi',
    'нижний новгород': 'nizhniy_novgorod',
    'новороссийск': 'novorossiysk',
    'орёл': 'orel',
    'пенза': 'penza',
    'пермь': 'perm',
    'подольск': 'podolsk',
    'ростов-на-дону': 'rostov-na-donu',
    'рязань': 'ryazan',
    'самара': 'samara',
    'санкт-петербург': 'sankt-peterburg',
    'саратов': 'saratov',
    'сергиев посад': 'sergiev-posad',
    'смоленск': 'smolensk',
    'ставрополь': 'stavropol',
    'тверь': 'tver',
    'тольятти': 'tolyatti',
    'томск': 'tomsk',
    'тула': 'tula',
    'тюмень': 'tyumen',
    'улан-удэ': 'ulan-ude',
    'ульяновск': 'ulyanovsk',
    'уфа': 'ufa',
    'чебоксары': 'cheboksary',
    'челябинск': 'chelyabinsk',
    'ярославль': 'yaroslavl',
    //Крым
    'симферополь': 'simferopol',
    'севастополь': 'sevastopol',
    'ялта': 'yalta',
    'керчь': 'kerch',
    'феодосия': 'feodosiya'

  };

  const lowerCity = cityName.toLowerCase().trim();
  return exceptions[lowerCity] || 
    lowerCity.split('').map(char => cyrillicToLatin[char] || char).join('')
      .replace(/[-]{2,}/g, '-')
      .replace(/^-|-$/g, '');
}

async function parseAvito(keyword, maxPrice, city = 'rossiya', limit = 50) {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox'],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH
    });

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);

    try {
        const url = `https://www.avito.ru/${transliterateCity(city)}?q=${encodeURIComponent(keyword)}&pmax=${maxPrice}`;
        await page.goto(url, { waitUntil: 'networkidle2' });
        await page.waitForSelector('[data-marker="item"]', { timeout: 15000 });

        const ads = await page.evaluate(() => {
            function normalizeDate(dateText) {
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                
                if (dateText.includes('сегодня')) {
                    const time = dateText.replace('сегодня', '').trim();
                    const [hours, minutes] = time.split(':').map(Number);
                    const date = new Date(today);
                    date.setHours(hours, minutes);
                    return date.toISOString();
                }
                else if (dateText.includes('вчера')) {
                    const time = dateText.replace('вчера', '').trim();
                    const [hours, minutes] = time.split(':').map(Number);
                    const date = new Date(today);
                    date.setDate(date.getDate() - 1);
                    date.setHours(hours, minutes);
                    return date.toISOString();
                }
                else {
                    const months = {
                        'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3,
                        'мая': 4, 'июня': 5, 'июля': 6, 'августа': 7,
                        'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11
                    };
                    
                    const parts = dateText.split(' ');
                    if (parts.length === 3) {
                        const day = parseInt(parts[0]);
                        const month = months[parts[1]];
                        const [hours, minutes] = parts[2].split(':').map(Number);
                        const date = new Date(now.getFullYear(), month, day, hours, minutes);
                        return date.toISOString();
                    }
                }
                return new Date().toISOString();
            }

            return Array.from(document.querySelectorAll('[data-marker="item"]')).map(item => {
                const priceElement = item.querySelector('[data-marker="item-price"]') || 
                                    item.querySelector('[itemprop="price"]');
                let price = '0';
                if (priceElement) {
                    price = priceElement.getAttribute('content') || 
                            priceElement.textContent.replace(/\s+/g, '').match(/\d+/)?.[0] || 
                            '0';
                }

                const dateElement = item.querySelector('[data-marker="item-date"]');
                let date = '';
                if (dateElement) {
                    date = normalizeDate(dateElement.textContent.trim());
                }

                const linkElement = item.querySelector('[itemprop="url"]') || 
                                  item.querySelector('[data-marker="item-title"]');
                let link = '#';
                if (linkElement) {
                    link = linkElement.href || 
                          'https://www.avito.ru' + linkElement.getAttribute('href');
                }

                return {
                    title: item.querySelector('[itemprop="name"]')?.textContent.trim() || 'Без названия',
                    price: price,
                    priceNum: parseInt(price.replace(/\D/g, '')) || 0,
                    link: link,
                    date: date || new Date().toISOString()
                };
            });
        });

        return ads.slice(0, limit).filter(ad => ad.title !== 'Без названия' && ad.link !== '#');

    } catch (error) {
        console.error('Ошибка парсинга:', error);
        await page.screenshot({ path: 'error.png' });
        return [];
    } finally {
        await browser.close();
    }
}

module.exports = parseAvito;