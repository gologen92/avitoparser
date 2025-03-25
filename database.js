const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'avito-parser.db');
const db = new Database(dbPath, { verbose: console.log });

// Создание таблиц
db.exec(`
  CREATE TABLE IF NOT EXISTS ads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    price TEXT,
    url TEXT NOT NULL,
    date TEXT,
    parsed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS saved_ads (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    price TEXT,
    url TEXT NOT NULL,
    date TEXT,
    saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);

// Сохранение объявления
function saveAd(ad) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO saved_ads (id, title, price, url, date, saved_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(ad.id, ad.title, ad.price, ad.link, ad.date, ad.saved_at);
}

// Удаление объявления
function deleteAd(id) {
  const stmt = db.prepare(`DELETE FROM saved_ads WHERE id = ?`);
  return stmt.run(id);
}

// Получение сохраненных объявлений
function getSavedAds() {
  return db.prepare(`
    SELECT * FROM saved_ads 
    ORDER BY saved_at DESC
  `).all();
}

module.exports = {
  db,
  saveAd,
  deleteAd,
  getSavedAds
};