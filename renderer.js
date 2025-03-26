document.addEventListener('DOMContentLoaded', () => {
    // Элементы DOM
    const startBtn = document.getElementById('startBtn');
    const clearBtn = document.getElementById('clearBtn');
    const outputDiv = document.getElementById('output');
    const resultsBody = document.getElementById('results-body');
    const savedBody = document.getElementById('saved-body');
    const dateFilter = document.getElementById('dateFilter');
    const customDates = document.getElementById('customDates');
    const keywordInput = document.getElementById('keyword');
    const priceInput = document.getElementById('price');
    const cityInput = document.getElementById('city');
    const limitInput = document.getElementById('limit');
    const dateFromInput = document.getElementById('dateFrom');
    const dateToInput = document.getElementById('dateTo');
    
    // Состояние приложения
    let currentResults = [];
    let savedAds = [];
    let currentSort = { field: null, order: 'asc' };
    let savedSort = { field: 'saved_at', order: 'desc' };
  
    // Инициализация
    function init() {
      initSorting();
      loadSavedAds();
      setupEventListeners();
      setupDefaultDates();
    }
  
    function setupDefaultDates() {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      dateFromInput.valueAsDate = yesterday;
      dateToInput.valueAsDate = today;
    }
  
    function setupEventListeners() {
      dateFilter.addEventListener('change', () => {
        customDates.style.display = dateFilter.value === 'custom' ? 'block' : 'none';
      });
  
      startBtn.addEventListener('click', startParsing);
      clearBtn.addEventListener('click', clearResults);
    }
  
    // Инициализация сортировки
    function initSorting() {
      document.querySelectorAll('#results-table .sortable').forEach(header => {
        header.addEventListener('click', () => {
          const field = header.dataset.sort;
          const order = currentSort.field === field 
              ? currentSort.order === 'asc' ? 'desc' : 'asc'
              : 'asc';
          
          updateSortIcons('#results-table', field, order);
          currentSort = { field, order };
          
          if (currentResults.length > 0) {
            displayResults(sortData(currentResults, field, order));
          }
        });
      });
  
      document.querySelectorAll('#saved-table .sortable').forEach(header => {
        header.addEventListener('click', () => {
          const field = header.dataset.sort;
          const order = savedSort.field === field 
              ? savedSort.order === 'asc' ? 'desc' : 'asc'
              : 'asc';
          
          updateSortIcons('#saved-table', field, order);
          savedSort = { field, order };
          displaySavedAds(sortData(savedAds, field, order));
        });
      });
    }
  
    // Обновление иконок сортировки
    function updateSortIcons(tableId, field, order) {
      document.querySelectorAll(`${tableId} .sortable`).forEach(header => {
        const icon = header.querySelector('.sort-icon');
        if (header.dataset.sort === field) {
          icon.textContent = order === 'asc' ? '↑' : '↓';
          header.dataset.order = order;
        } else {
          icon.textContent = '';
          header.dataset.order = '';
        }
      });
    }
  
    // Функция сортировки данных
    function sortData(data, field, order) {
      return [...data].sort((a, b) => {
        let valA, valB;
        
        if (field === 'price') {
          valA = a.priceNum;
          valB = b.priceNum;
          return order === 'asc' ? valA - valB : valB - valA;
        } 
        else if (field === 'date' || field === 'saved_at') {
          valA = new Date(a[field]).getTime();
          valB = new Date(b[field]).getTime();
          return order === 'asc' ? valA - valB : valB - valA;
        } 
        else {
          valA = (a[field] || '').toString().toLowerCase();
          valB = (b[field] || '').toString().toLowerCase();
          return order === 'asc' 
              ? valA.localeCompare(valB)
              : valB.localeCompare(valA);
        }
      });
    }
  
    // Отображение результатов поиска
    function displayResults(results) {
      resultsBody.innerHTML = results.map(item => `
        <tr data-id="${item.id}">
          <td>${escapeHtml(item.title)}</td>
          <td>${formatPrice(item.price)}</td>
          <td>${formatDateTime(item.date)}</td>
          <td>
            <a href="${item.link}" target="_blank" class="action-btn">Открыть</a>
            <button class="action-btn save-btn">Сохранить</button>
          </td>
        </tr>
      `).join('');
  
      document.querySelectorAll('.save-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const row = e.target.closest('tr');
          const id = row.dataset.id;
          const ad = currentResults.find(item => item.id === id);
          if (ad) {
            saveAd(ad);
          }
        });
      });
    }
  
    // Отображение сохраненных объявлений
    function displaySavedAds(ads) {
      savedBody.innerHTML = ads.map(ad => `
        <tr data-id="${ad.id}">
          <td>${escapeHtml(ad.title)}</td>
          <td>${formatPrice(ad.price)}</td>
          <td>${formatDateTime(ad.date)}</td>
          <td>${formatDateTime(ad.saved_at)}</td>
          <td>
            <a href="${ad.link}" target="_blank" class="action-btn">Открыть</a>
            <button class="action-btn delete-btn">Удалить</button>
          </td>
        </tr>
      `).join('');
  
      document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const row = e.target.closest('tr');
          const id = row.dataset.id;
          deleteSavedAd(id);
          row.remove();
        });
      });
    }
  
    // Форматирование цены
    function formatPrice(price) {
      if (!price) return '0 ₽';
      const num = parseInt(price.replace(/\D/g, '')) || 0;
      return num.toLocaleString('ru-RU') + ' ₽';
    }
  
    // Форматирование даты и времени
    function formatDateTime(dateString) {
        if (!dateString) return 'Нет данных';
        
        try {
          const date = new Date(dateString);
          if (isNaN(date.getTime())) return 'Некорректная дата';
          
          return date.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        } catch (e) {
          console.error('Ошибка форматирования даты:', e);
          return 'Ошибка даты';
        }
      }
  
    // Экранирование HTML
    function escapeHtml(unsafe) {
      if (!unsafe) return '';
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }
  
    // Сохранение объявления
    async function saveAd(ad) {
      try {
        const savedAt = new Date().toISOString();
        const savedAd = { 
          ...ad, 
          id: `saved-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          saved_at: savedAt,
          priceNum: ad.priceNum || parseInt((ad.price || '0').replace(/\D/g, '')) || 0
        };
  
        await window.electronAPI.saveAd(savedAd);
        savedAds.unshift(savedAd);
        displaySavedAds(sortData(savedAds, savedSort.field, savedSort.order));
      } catch (error) {
        console.error('Ошибка сохранения объявления:', error);
      }
    }
  
    // Удаление сохраненного объявления
    async function deleteSavedAd(id) {
      try {
        await window.electronAPI.deleteAd(id);
        savedAds = savedAds.filter(ad => ad.id !== id);
      } catch (error) {
        console.error('Ошибка удаления объявления:', error);
      }
    }
  
    // Фильтрация по дате
    function filterByDate(results, filterType, dateFrom, dateTo) {
      if (filterType === 'all') return results;
  
      const now = new Date();
      let startDate, endDate;
  
      if (filterType === 'today') {
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date();
        return results.filter(item => {
          try {
            const itemDate = new Date(item.date);
            return itemDate >= startDate && itemDate <= endDate;
          } catch {
            return false;
          }
        });
      }
      else if (filterType === 'custom') {
        if (!dateFrom || !dateTo) return results;
        startDate = new Date(dateFrom);
        endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        return results.filter(item => {
          try {
            const itemDate = new Date(item.date);
            return itemDate >= startDate && itemDate <= endDate;
          } catch {
            return false;
          }
        });
      }
  
      return results;
    }
  
    // Запуск парсинга
    async function startParsing() {
      const keyword = keywordInput.value.trim();
      const price = priceInput.value.trim();
      const city = cityInput.value.trim() || 'rossiya';
      const limit = parseInt(limitInput.value) || 50;
      const filterType = dateFilter.value;
      const dateFrom = dateFromInput.value;
      const dateTo = dateToInput.value;
  
      if (!keyword) {
        outputDiv.textContent = 'Введите ключевые слова для поиска';
        return;
      }
  
      try {
        outputDiv.textContent = 'Идет поиск объявлений...';
        startBtn.disabled = true;
        
        const params = { 
          keyword, 
          price: price ? parseInt(price.replace(/\D/g, '')) : undefined,
          city,
          limit
        };
  
        currentResults = await window.electronAPI.parseData(params);
        
        currentResults = currentResults.map((ad, index) => ({
          ...ad,
          id: `ad-${Date.now()}-${index}`,
          priceNum: parseInt((ad.price || '0').replace(/\D/g, '')) || 0
        }));
        
        const filteredResults = filterByDate(currentResults, filterType, dateFrom, dateTo);
        
        if (currentSort.field) {
          displayResults(sortData(filteredResults, currentSort.field, currentSort.order));
        } else {
          displayResults(filteredResults);
        }
        
        outputDiv.textContent = `Найдено объявлений: ${filteredResults.length}`;
      } catch (error) {
        console.error('Ошибка при парсинге:', error);
        outputDiv.textContent = `Ошибка: ${error.message}`;
      } finally {
        startBtn.disabled = false;
      }
    }
  
    // Очистка результатов
    function clearResults() {
      resultsBody.innerHTML = '';
      currentResults = [];
      outputDiv.textContent = '';
    }
  
    // Загрузка сохраненных объявлений
    async function loadSavedAds() {
      try {
        savedAds = await window.electronAPI.getSavedAds();
        savedAds = savedAds.map(ad => ({
          ...ad,
          priceNum: parseInt((ad.price || '0').replace(/\D/g, '')) || 0
        }));
        displaySavedAds(sortData(savedAds, savedSort.field, savedSort.order));
      } catch (error) {
        console.error('Ошибка загрузки сохраненных объявлений:', error);
      }
    }
  
    // Инициализация приложения
    init();
  });