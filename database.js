const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'avito-parser.db');
const db = new Database(dbPath, { verbose: console.log });

// Единая инициализация таблицы saved_ads
function initializeDatabase() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS saved_ads (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            price TEXT,
            url TEXT NOT NULL UNIQUE,
            date TEXT,
            description TEXT,
            location TEXT,
            saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_saved_ads_saved_at ON saved_ads(saved_at);
        CREATE INDEX IF NOT EXISTS idx_saved_ads_date ON saved_ads(date);
    `);
    console.log('База данных инициализирована');
}

// Вызываем при старте
initializeDatabase();

// Сохранение объявления
function saveAd(ad) {
    try {
        if (!ad.id) throw new Error('Не указан ID объявления');
        if (!ad.title) throw new Error('Не указано название объявления');
        if (!ad.url) throw new Error('Не указана ссылка на объявление');

        const stmt = db.prepare(`
            INSERT OR REPLACE INTO saved_ads 
            (id, title, price, url, date, description, location, saved_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            ad.id,
            ad.title,
            ad.price || '0',
            ad.url,
            ad.date || new Date().toISOString(),
            ad.description || '',
            ad.location || '',
            ad.saved_at || new Date().toISOString()
        );

        return {
            success: true,
            changes: result.changes
        };
    } catch (error) {
        console.error('Ошибка сохранения объявления:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Удаление объявления
function deleteAd(id) {
    try {
        if (!id) throw new Error('Не указан ID объявления');

        const stmt = db.prepare(`DELETE FROM saved_ads WHERE id = ?`);
        const result = stmt.run(id);

        return {
            success: true,
            changes: result.changes
        };
    } catch (error) {
        console.error('Ошибка удаления объявления:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Получение всех сохранённых объявлений (сортировка по дате сохранения)
function getSavedAds() {
    try {
        return db.prepare(`
            SELECT id, title, price, url, date, description, location,
                   strftime('%Y-%m-%dT%H:%M:%fZ', saved_at) as saved_at
            FROM saved_ads 
            ORDER BY saved_at DESC
        `).all();
    } catch (error) {
        console.error('Ошибка получения сохранённых объявлений:', error);
        return [];
    }
}

// Получение статистики
function getStats() {
    try {
        return db.prepare(`
            SELECT 
                COUNT(*) as total,
                SUM(price) as total_price,
                AVG(price) as avg_price,
                MIN(price) as min_price,
                MAX(price) as max_price
            FROM saved_ads
            WHERE price != '0'
        `).get();
    } catch (error) {
        console.error('Ошибка получения статистики:', error);
        return null;
    }
}

module.exports = {
    db,
    saveAd,
    deleteAd,
    getSavedAds,
    getStats
};