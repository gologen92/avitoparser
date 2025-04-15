document.addEventListener('DOMContentLoaded', () => {
    // Получаем все необходимые элементы DOM
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
    const exportBtn = document.getElementById('exportBtn');
    const telegramModal = document.getElementById('telegramModal');
    const telegramTokenInput = document.getElementById('telegramToken');
    const telegramChatIdInput = document.getElementById('telegramChatId');
    const saveTelegramBtn = document.getElementById('saveTelegramSettings');
    const testTelegramBtn = document.getElementById('testTelegramSettings');
    const telegramTestResult = document.getElementById('telegramTestResult');
    const openTelegramBtn = document.getElementById('openTelegramSettings');
    const closeTelegramBtn = document.querySelector('.close-btn');

    // Состояние приложения
    let currentResults = [];
    let savedAds = [];
    let currentSort = { field: null, order: 'asc' };
    let savedSort = { field: 'saved_at', order: 'desc' };
    let isParsing = false;

    // Инициализация приложения
    async function init() {
        try {
            initTabs();
            initSorting();
            setupEventListeners();
            setupDefaultDates();
            restoreSearchParams();
            setupTelegramUI();
            showStatusMessage('Загрузка сохраненных объявлений...', 'info');
            await loadSavedAds();
        } catch (error) {
            console.error('Ошибка инициализации:', error);
            showStatusMessage('Ошибка загрузки приложения', 'error');
        }
    }

    // Инициализация вкладок (новая реализация)
    function initTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Удаляем active у всех кнопок и контента
                document.querySelectorAll('.tab-btn, .tab-content').forEach(el => {
                    el.classList.remove('active');
                });
                
                // Добавляем active к выбранной кнопке и контенту
                const tabId = btn.dataset.tab;
                btn.classList.add('active');
                document.getElementById(tabId).classList.add('active');

                // Показываем сообщение если перешли на пустые сохранённые
                if (tabId === 'saved' && savedAds.length === 0) {
                    document.getElementById('empty-saved').style.display = '';
                }
            });
        });
    }

    // Настройка сортировки таблиц
    function initSorting() {
        document.querySelectorAll('#results-table .sortable').forEach(header => {
            header.addEventListener('click', () => {
                if (isParsing) return;
                
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

    // Сортировка данных
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

    // Настройка обработчиков событий
    function setupEventListeners() {
        dateFilter.addEventListener('change', () => {
            customDates.style.display = dateFilter.value === 'custom' ? 'block' : 'none';
        });

        startBtn.addEventListener('click', startParsing);
        clearBtn.addEventListener('click', clearResults);
        exportBtn.addEventListener('click', exportToExcel);
    }

    // Настройка Telegram интерфейса
    function setupTelegramUI() {
        const savedToken = localStorage.getItem('telegramToken');
        const savedChatId = localStorage.getItem('telegramChatId');
        
        if (savedToken) telegramTokenInput.value = savedToken;
        if (savedChatId) telegramChatIdInput.value = savedChatId;

        openTelegramBtn.addEventListener('click', () => {
            telegramModal.style.display = 'block';
        });

        closeTelegramBtn.addEventListener('click', () => {
            telegramModal.style.display = 'none';
        });

        saveTelegramBtn.addEventListener('click', saveTelegramSettings);
        testTelegramBtn.addEventListener('click', testTelegramSettings);

        window.addEventListener('click', (event) => {
            if (event.target === telegramModal) {
                telegramModal.style.display = 'none';
            }
        });
    }

    // Сохранение настроек Telegram
    async function saveTelegramSettings() {
        const token = telegramTokenInput.value.trim();
        const chatId = telegramChatIdInput.value.trim();
        
        if (!token || !chatId) {
            showTelegramTestResult('Заполните все поля', 'error');
            return;
        }

        try {
            await window.electronAPI.initTelegramBot(token, chatId);
            localStorage.setItem('telegramToken', token);
            localStorage.setItem('telegramChatId', chatId);
            showTelegramTestResult('Настройки сохранены!', 'success');
        } catch (error) {
            showTelegramTestResult(`Ошибка: ${error.message}`, 'error');
        }
    }

    // Тестирование Telegram бота
    async function testTelegramSettings() {
        const token = telegramTokenInput.value.trim();
        const chatId = telegramChatIdInput.value.trim();
        
        if (!token || !chatId) {
            showTelegramTestResult('Заполните все поля', 'error');
            return;
        }

        try {
            const result = await window.electronAPI.testTelegramBot(token, chatId);
            showTelegramTestResult(result, 'success');
        } catch (error) {
            showTelegramTestResult(`Ошибка: ${error.message}`, 'error');
        }
    }

    // Показ результата теста Telegram
    function showTelegramTestResult(message, type) {
        telegramTestResult.textContent = message;
        telegramTestResult.style.display = 'block';
        telegramTestResult.style.backgroundColor = type === 'success' ? '#d4edda' : '#f8d7da';
        telegramTestResult.style.color = type === 'success' ? '#155724' : '#721c24';
    }

    // Установка дат по умолчанию
    function setupDefaultDates() {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        dateFromInput.valueAsDate = yesterday;
        dateToInput.valueAsDate = today;
    }

    // Восстановление параметров поиска
    function restoreSearchParams() {
        const params = JSON.parse(localStorage.getItem('avitoParserSearchParams')) || {};
        if (params.keyword) keywordInput.value = params.keyword;
        if (params.price) priceInput.value = params.price;
        if (params.city) cityInput.value = params.city;
        if (params.limit) limitInput.value = params.limit;
        if (params.dateFilter) dateFilter.value = params.dateFilter;
        if (params.dateFrom) dateFromInput.value = params.dateFrom;
        if (params.dateTo) dateToInput.value = params.dateTo;
        
        customDates.style.display = dateFilter.value === 'custom' ? 'block' : 'none';
    }

    // Сохранение параметров поиска
    function saveSearchParams() {
        const params = {
            keyword: keywordInput.value.trim(),
            price: priceInput.value.trim(),
            city: cityInput.value.trim(),
            limit: limitInput.value,
            dateFilter: dateFilter.value,
            dateFrom: dateFromInput.value,
            dateTo: dateToInput.value
        };
        localStorage.setItem('avitoParserSearchParams', JSON.stringify(params));
    }

    // Загрузка сохраненных объявлений
    async function loadSavedAds() {
        showStatusMessage('Загрузка сохраненных объявлений...', 'info');
        try {
            const loadedAds = await window.electronAPI.getSavedAds();
            console.log('Получено объявлений:', loadedAds.length);
            
            savedAds = loadedAds.map(ad => ({
                ...ad,
                priceNum: parseInt((ad.price || '0').replace(/\D/g, '')) || 0,
                description: ad.description || '',
                location: ad.location || ''
            }));
            
            displaySavedAds(sortData(savedAds, savedSort.field, savedSort.order));
            
            if (savedAds.length > 0) {
                showStatusMessage(`Загружено ${savedAds.length} сохраненных объявлений`, 'success');
            } else {
                showStatusMessage('Нет сохраненных объявлений', 'info');
                document.getElementById('empty-saved').style.display = '';
            }
        } catch (error) {
            console.error('Ошибка загрузки:', error);
            showStatusMessage('Ошибка загрузки сохраненных объявлений', 'error');
        }
    }

    // Отображение сохраненных объявлений
    function displaySavedAds(ads) {
        const emptyRow = document.getElementById('empty-saved');
        const tbody = document.getElementById('saved-body');
        
        // Очищаем таблицу (кроме строки пустого состояния)
        tbody.querySelectorAll('tr:not(#empty-saved)').forEach(row => row.remove());
        
        if (ads.length === 0) {
            if (emptyRow) emptyRow.style.display = '';
            return;
        }

        // Скрываем пустое состояние
        if (emptyRow) emptyRow.style.display = 'none';
        
        // Добавляем объявления
        ads.forEach(ad => {
            const row = document.createElement('tr');
            row.dataset.id = ad.id;
            row.innerHTML = `
                <td>${escapeHtml(ad.title)}${ad.description ? `<br><small>${escapeHtml(ad.description)}</small>` : ''}</td>
                <td>${formatPrice(ad.price)}</td>
                <td>${formatDateTime(ad.date)}${ad.location ? `<br><small>${escapeHtml(ad.location)}</small>` : ''}</td>
                <td>${formatDateTime(ad.saved_at)}</td>
                <td>
                    <a href="${ad.link}" target="_blank" class="action-btn">Открыть</a>
                    <button class="action-btn delete-btn">Удалить</button>
                </td>
            `;
            tbody.appendChild(row);
        });

        // Назначаем обработчики удаления
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Вы уверены, что хотите удалить это объявление?')) {
                    const row = e.target.closest('tr');
                    const id = row.dataset.id;
                    await deleteSavedAd(id);
                    row.remove();
                    
                    // Показываем пустое состояние если удалили последнее
                    if (document.querySelectorAll('#saved-body tr:not(#empty-saved)').length === 0) {
                        document.getElementById('empty-saved').style.display = '';
                        showStatusMessage('Нет сохраненных объявлений', 'info');
                    }
                }
            });
        });
    }

    // Удаление сохраненного объявления
    async function deleteSavedAd(id) {
        try {
            await window.electronAPI.deleteAd(id);
            savedAds = savedAds.filter(ad => ad.id !== id);
            showStatusMessage('Объявление удалено', 'success');
        } catch (error) {
            console.error('Ошибка удаления объявления:', error);
            showStatusMessage('Ошибка удаления объявления', 'error');
        }
    }

    // Отображение результатов поиска
    function displayResults(results) {
        resultsBody.innerHTML = results.map(item => `
            <tr data-id="${item.id}">
                <td>${escapeHtml(item.title)}${item.description ? `<br><small>${escapeHtml(item.description)}</small>` : ''}</td>
                <td>${formatPrice(item.price)}</td>
                <td>${formatDateTime(item.date)}${item.location ? `<br><small>${escapeHtml(item.location)}</small>` : ''}</td>
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
            
            showStatusMessage(`Объявление сохранено: "${ad.title}"`, 'success');
        } catch (error) {
            console.error('Ошибка сохранения объявления:', error);
            showStatusMessage(`Ошибка сохранения: ${error.message}`, 'error');
        }
    }

    // Экспорт в Excel
    async function exportToExcel() {
        try {
            const { filePath } = await window.electronAPI.showSaveDialog({
                title: 'Экспорт в Excel',
                defaultPath: `avito_ads_${new Date().toISOString().slice(0,10)}.xlsx`,
                filters: [
                    { name: 'Excel Files', extensions: ['xlsx'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });

            if (!filePath) return;

            const result = await window.electronAPI.exportToExcel(filePath);
            if (result.success) {
                showStatusMessage(`Данные экспортированы в ${filePath}`, 'success');
            } else {
                showStatusMessage(`Ошибка экспорта: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Ошибка экспорта:', error);
            showStatusMessage('Ошибка при экспорте данных', 'error');
        }
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
                minute: '2-digit',
                hour12: false
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

    // Показ статусного сообщения
    function showStatusMessage(message, type = 'info') {
        const existingStatus = document.querySelector('.status-indicator');
        if (existingStatus) existingStatus.remove();
        
        const status = document.createElement('div');
        status.className = `status-indicator status-${type}`;
        status.textContent = message;
        outputDiv.appendChild(status);
        
        setTimeout(() => {
            status.style.opacity = '0';
            setTimeout(() => status.remove(), 500);
        }, 3000);
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
        if (isParsing) return;
        
        const keyword = keywordInput.value.trim();
        const price = priceInput.value.trim();
        const city = cityInput.value.trim() || 'rossiya';
        const limit = parseInt(limitInput.value) || 50;
        const filterType = dateFilter.value;
        const dateFrom = dateFromInput.value;
        const dateTo = dateToInput.value;

        if (!keyword) {
            showStatusMessage('Введите ключевые слова для поиска', 'warning');
            return;
        }

        try {
            isParsing = true;
            startBtn.disabled = true;
            clearBtn.disabled = true;
            startBtn.innerHTML = 'Поиск... <span class="loader"></span>';
            showStatusMessage('Идет поиск объявлений...', 'info');

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
            
            showStatusMessage(`Найдено объявлений: ${filteredResults.length}`, 'success');
            saveSearchParams();
        } catch (error) {
            console.error('Ошибка при парсинге:', error);
            showStatusMessage(`Ошибка: ${error.message}`, 'error');
        } finally {
            isParsing = false;
            startBtn.disabled = false;
            clearBtn.disabled = false;
            startBtn.textContent = 'Начать поиск';
        }
    }

    // Очистка результатов
    function clearResults() {
        resultsBody.innerHTML = '';
        currentResults = [];
        showStatusMessage('Результаты очищены', 'info');
    }

    // Запускаем приложение
    init();
});