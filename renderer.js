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

  // Инициализация сортировки
  function initSorting() {
      // Таблица результатов
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

      // Таблица сохраненных объявлений
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
              <td>${item.title}</td>
              <td>${item.price}</td>
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
              <td>${ad.title}</td>
              <td>${ad.price}</td>
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

  // Сохранение объявления
  function saveAd(ad) {
      const savedAt = new Date().toISOString();
      const savedAd = { 
          ...ad, 
          saved_at: savedAt,
          priceNum: ad.priceNum || parseInt((ad.price || '0').replace(/\D/g, '')) || 0
      };

      savedAds.unshift(savedAd);
      displaySavedAds(sortData(savedAds, savedSort.field, savedSort.order));
      window.electronAPI.saveAd(savedAd);
  }

  // Удаление сохраненного объявления
  function deleteSavedAd(id) {
      savedAds = savedAds.filter(ad => ad.id !== id);
      window.electronAPI.deleteAd(id);
  }

  // Форматирование даты и времени
  function formatDateTime(dateString) {
      if (!dateString) return 'Нет данных';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Некорректная дата';
      
      return date.toLocaleString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
      });
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
              const itemDate = new Date(item.date);
              return itemDate >= startDate && itemDate <= endDate;
          });
      }
      else if (filterType === 'custom') {
          if (!dateFrom || !dateTo) return results;
          startDate = new Date(dateFrom);
          endDate = new Date(dateTo);
          endDate.setHours(23, 59, 59, 999);
          return results.filter(item => {
              const itemDate = new Date(item.date);
              return itemDate >= startDate && itemDate <= endDate;
          });
      }

      return results;
  }

  // Обработчики событий
  dateFilter.addEventListener('change', () => {
      customDates.style.display = dateFilter.value === 'custom' ? 'block' : 'none';
  });

  startBtn.addEventListener('click', async () => {
      const keyword = keywordInput.value.trim();
      const price = priceInput.value.trim();
      const city = cityInput.value.trim();
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
          
          currentResults = await window.electronAPI.parseData({ 
              keyword, 
              price, 
              city,
              limit
          });
          
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
      }
  });

  clearBtn.addEventListener('click', () => {
      resultsBody.innerHTML = '';
      currentResults = [];
      outputDiv.textContent = '';
  });

  // Загрузка сохраненных объявлений
  function loadSavedAds() {
      window.electronAPI.getSavedAds().then(ads => {
          savedAds = ads.map(ad => ({
              ...ad,
              priceNum: parseInt((ad.price || '0').replace(/\D/g, '')) || 0
          }));
          displaySavedAds(sortData(savedAds, savedSort.field, savedSort.order));
      });
  }

  // Инициализация
  initSorting();
  loadSavedAds();
});