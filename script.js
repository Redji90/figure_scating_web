// Глобальные переменные
let currentPdfFile = null;
let currentPdfData = null;
let savedResults = JSON.parse(localStorage.getItem('figureSkatingResults')) || [];
let debugMessages = []; // Массив для хранения отладочных сообщений (старая переменная, не используется)
let results = null; // Глобальная переменная для хранения результатов парсинга PDF

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    initializeEventListeners();
    
    // Инициализируем базу данных
    try {
        await initDatabase();
    } catch (error) {
        console.error('Ошибка инициализации базы данных:', error);
    }
    
    // Загружаем сохраненные результаты только если мы на странице поиска
    if (document.getElementById('searchPage') && 
        document.getElementById('searchPage').style.display !== 'none') {
        loadSavedResults();
        loadCompetitionsFromDB();
    }
});

// Инициализация обработчиков событий
function initializeEventListeners() {
    const pdfInput = document.getElementById('pdfInput');
    const uploadArea = document.getElementById('uploadArea');
    const browseLink = document.getElementById('browseLink');
    const clearFileBtn = document.getElementById('clearFile');
    const parseBtn = document.getElementById('parseBtn');
    const saveResultsBtn = document.getElementById('saveResultsBtn');
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const exportAllBtn = document.getElementById('exportAllBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const skaterSearchInput = document.getElementById('skaterSearch');

    // Загрузка файла
    browseLink.addEventListener('click', () => pdfInput.click());
    pdfInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    
    // Очистка файла
    clearFileBtn.addEventListener('click', clearFile);
    
    // Парсинг
    parseBtn.addEventListener('click', parsePdf);
    
    // Переключение отладочной информации
    const toggleDebugBtn = document.getElementById('toggleDebugBtn');
    if (toggleDebugBtn) {
        toggleDebugBtn.addEventListener('click', () => {
            const debugSection = document.getElementById('debugSection');
            if (debugSection.style.display === 'none') {
                debugSection.style.display = 'block';
                toggleDebugBtn.textContent = 'Скрыть';
            } else {
                debugSection.style.display = 'none';
                toggleDebugBtn.textContent = 'Показать';
            }
        });
    }
    
    // Кнопка показа отладки в настройках
    const showDebugBtn = document.getElementById('showDebugBtn');
    if (showDebugBtn) {
        showDebugBtn.addEventListener('click', () => {
            const debugSection = document.getElementById('debugSection');
            if (debugSection) {
                debugSection.style.display = 'block';
                debugSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                if (toggleDebugBtn) {
                    toggleDebugBtn.textContent = 'Скрыть';
                }
            }
        });
    }
    
    // Загрузка результатов ISU
    const loadIsuResultsBtn = document.getElementById('loadIsuResultsBtn');
    if (loadIsuResultsBtn) {
        loadIsuResultsBtn.addEventListener('click', loadIsuResults);
    }
    
    // Enter в поле URL
    const isuUrlInput = document.getElementById('isuUrl');
    if (isuUrlInput) {
        isuUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                loadIsuResults();
            }
        });
    }
    
    // Сохранение и экспорт
    saveResultsBtn.addEventListener('click', saveCurrentResults);
    exportBtn.addEventListener('click', exportToJSON);
    importBtn.addEventListener('click', importFromJSON);
    exportAllBtn.addEventListener('click', exportAllDatabase);
    clearAllBtn.addEventListener('click', clearAllSaved);
    
    // Поиск фигуристов
    if (skaterSearchInput) {
        let searchTimeout = null;
        skaterSearchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            
            if (query.length < 3) {
                hideSearchResults();
                return;
            }
            
            // Задержка для уменьшения количества запросов
            searchTimeout = setTimeout(() => {
                performSkaterSearch(query);
            }, 300);
        });
        
        // Скрываем результаты при клике вне области поиска
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                hideSearchResults();
            }
        });
    }
}

// Обработка выбора файла
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
        loadPdfFile(file);
    } else {
        alert('Пожалуйста, выберите PDF файл');
    }
}

// Drag and drop обработчики
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('uploadArea').classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('uploadArea').classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('uploadArea').classList.remove('dragover');
    
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
        loadPdfFile(file);
    } else {
        alert('Пожалуйста, перетащите PDF файл');
    }
}

// Загрузка PDF файла
async function loadPdfFile(file) {
    currentPdfFile = file;
    
    // Отображение информации о файле
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileInfo').style.display = 'flex';
    document.getElementById('parseBtn').disabled = false;
    
    // Автоматический парсинг если включен
    if (document.getElementById('autoParse').checked) {
        await parsePdf();
    }
}

// Очистка файла
function clearFile() {
    currentPdfFile = null;
    currentPdfData = null;
    document.getElementById('pdfInput').value = '';
    document.getElementById('fileInfo').style.display = 'none';
    document.getElementById('parseBtn').disabled = true;
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('statsSection').style.display = 'none';
}

// Функция для добавления отладочного сообщения
// Глобальная переменная для отслеживания текущего номера фигуриста
let currentSkaterDebugIndex = -1;

function addDebugLog(message, type = 'info') {
    // Показываем только информацию по второму фигуристу (индекс 1)
    // Также показываем общие сообщения (когда currentSkaterDebugIndex = -1)
    if (currentSkaterDebugIndex !== 1 && currentSkaterDebugIndex !== -1) {
        return; // Пропускаем сообщения для других фигуристов
    }
    
    const timestamp = new Date().toLocaleTimeString();
    debugLog.push({ timestamp, message, type });
    
    // Вывод в консоль
    const consoleMethod = type === 'error' ? 'error' : type === 'success' ? 'log' : 'info';
    console[consoleMethod](`[${timestamp}] ${message}`);
    
    // Обновление интерфейса
    updateDebugDisplay();
}

// Обновление отображения отладочной информации
function updateDebugDisplay() {
    const debugInfo = document.getElementById('debugInfo');
    if (!debugInfo) return;
    
    const maxLines = 500; // Ограничение количества строк
    const recentLogs = debugLog.slice(-maxLines);
    
    debugInfo.innerHTML = recentLogs.map(log => {
        const className = `debug-${log.type}`;
        return `<div class="debug-line ${className}">[${log.timestamp}] ${escapeHtml(log.message)}</div>`;
    }).join('');
    
    // Прокрутка вниз
    debugInfo.scrollTop = debugInfo.scrollHeight;
    
    // Показываем секцию отладки
    const debugSection = document.getElementById('debugSection');
    if (debugSection) {
        debugSection.style.display = 'block';
    }
}

// Экранирование HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Парсинг PDF
async function parsePdf() {
    if (!currentPdfFile) {
        alert('Пожалуйста, загрузите PDF файл');
        return;
    }
    
    // Очищаем предыдущие логи
    debugLog = [];
    addDebugLog('Начало анализа PDF файла', 'info');
    
    const resultsContent = document.getElementById('resultsContent');
    resultsContent.innerHTML = '<div class="loading">Анализ PDF файла</div>';
    document.getElementById('resultsSection').style.display = 'block';
    
    try {
        const arrayBuffer = await currentPdfFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        let fullText = '';
        
        // Извлечение текста из всех страниц с сохранением структуры
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            
            // Группируем элементы по строкам для лучшего парсинга таблиц
            const items = textContent.items;
            let pageText = '';
            let lastY = null;
            const tolerance = 3; // Допуск для группировки в одну строку
            
            // Сортируем элементы по Y координате (сверху вниз)
            const sortedItems = [...items].sort((a, b) => {
                const yA = a.transform[5] || 0;
                const yB = b.transform[5] || 0;
                return yB - yA; // Обратный порядок (больше Y = выше на странице)
            });
            
            // Группируем элементы в строки
            const lines = [];
            let currentLine = [];
            let currentLineY = null;
            
            for (const item of sortedItems) {
                const currentY = item.transform[5] || 0;
                
                if (currentLineY === null || Math.abs(currentY - currentLineY) <= tolerance) {
                    // Добавляем к текущей строке
                    currentLine.push(item);
                    if (currentLineY === null) currentLineY = currentY;
                } else {
                    // Сохраняем предыдущую строку
                    if (currentLine.length > 0) {
                        lines.push(currentLine);
                    }
                    // Начинаем новую строку
                    currentLine = [item];
                    currentLineY = currentY;
                }
            }
            if (currentLine.length > 0) {
                lines.push(currentLine);
            }
            
            // Формируем текст из строк, сортируя элементы в строке по X координате
            for (const line of lines) {
                line.sort((a, b) => {
                    const xA = a.transform[4] || 0;
                    const xB = b.transform[4] || 0;
                    return xA - xB;
                });
                
                const lineText = line.map(item => item.str).join(' ').trim();
                if (lineText.length > 0) {
                    pageText += lineText + '\n';
                }
            }
            
            fullText += pageText + '\n';
        }
        
        // Сохраняем извлеченный текст для отладки
        addDebugLog(`Извлечено ${fullText.length} символов из PDF`, 'info');
        addDebugLog(`Первые 500 символов: ${fullText.substring(0, 500)}`, 'info');
        
        // Проверяем формат файла (ISU или российский)
        let parsedData;
        if (fullText.includes('JUDGES DETAILS PER SKATER') || fullText.match(/\d+\s+[A-Z][a-z]+\s+[A-Z]+\s+[A-Z]{3}\s+\d+/)) {
            addDebugLog('Обнаружен международный формат ISU', 'info');
            parsedData = parseISUFormat(fullText);
        } else {
            parsedData = parseSkatingResults(fullText);
        }
        
        currentPdfData = parsedData;
        
        addDebugLog(`Парсинг завершен. Найдено фигуристов: ${parsedData.skaters.length}`, 
                   parsedData.skaters.length > 0 ? 'success' : 'error');
        
        // Если не найдено фигуристов, показываем отладочную информацию
        if (!parsedData.skaters || parsedData.skaters.length === 0) {
            const debugInfo = `
                <div class="error-message">
                    <strong>Не удалось извлечь данные о фигуристах</strong><br><br>
                    <details>
                        <summary style="cursor: pointer; margin-bottom: 10px;"><strong>Отладочная информация (нажмите для просмотра)</strong></summary>
                        <div style="background: #f5f5f5; padding: 15px; margin-top: 10px; border-radius: 5px; max-height: 400px; overflow-y: auto;">
                            <strong>Первые 1000 символов извлеченного текста:</strong><br>
                            <pre style="white-space: pre-wrap; font-size: 0.9rem;">${fullText.substring(0, 1000)}</pre>
                            <br>
                            <strong>Всего строк:</strong> ${fullText.split('\n').length}<br>
                            <strong>Всего символов:</strong> ${fullText.length}
                        </div>
                    </details>
                    <br>
                    <p>Попробуйте:</p>
                    <ul style="text-align: left; display: inline-block;">
                        <li>Убедитесь, что PDF содержит результаты в формате детализации судейских оценок</li>
                        <li>Проверьте, что файл не защищен паролем</li>
                        <li>Попробуйте другой PDF файл</li>
                    </ul>
                </div>
            `;
            resultsContent.innerHTML = debugInfo;
            return;
        }
        
        // Отображение результатов
        displayResults(parsedData);
        displayStatistics(parsedData);
        
    } catch (error) {
        console.error('Ошибка при парсинге PDF:', error);
        resultsContent.innerHTML = `
            <div class="error-message">
                <strong>Ошибка при анализе PDF:</strong><br>
                ${error.message}<br>
                Убедитесь, что файл содержит результаты соревнований по фигурному катанию.
            </div>
        `;
    }
}

// Парсинг результатов фигурного катания (формат детализации судейских оценок)
function parseSkatingResults(text) {
    // Сбрасываем индекс фигуриста для отладки
    currentSkaterDebugIndex = -1;
    
    // Извлечение первой строки (заголовок соревнования) полностью
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const firstLine = lines.length > 0 ? lines[0] : '';
    
    // Извлечение названия соревнования
    let competitionName = document.getElementById('competitionName').value;
    if (!competitionName || competitionName === '') {
        const patterns = [
            /Всероссийские соревнования\s+"([^"]+)"/,
            /соревнования\s+"([^"]+)"/,
            /"([^"]+)"\s*\([\d.]+-[\d.]+\)/,
            /([А-ЯЁ][а-яё\s]+соревнования[^"]*)/i
        ];
        
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                competitionName = match[1].trim();
                break;
            }
        }
        
        if (!competitionName || competitionName === '') {
            competitionName = firstLine || 'Не указано';
        }
    }
    
    results = {
        firstLine: firstLine, // Сохраняем первую строку полностью
        competitionName: competitionName,
        fileName: currentPdfFile.name,
        parsedAt: new Date().toISOString(),
        skaters: []
    };
    
    let currentSkater = null;
    let parsingState = 'searching'; // searching, skaterInfo, elements, components
    
    addDebugLog('=== НАЧАЛО ПАРСИНГА ===', 'info');
    addDebugLog(`Всего строк для обработки: ${lines.length}`, 'info');
    
    // Более гибкие паттерны для поиска фигуристов
    const skaterPatterns = [
        /^(\d+)\s+([А-ЯЁ][а-яё]+\s+[А-ЯЁА-ЯЁ]+(?:\s+[А-ЯЁА-ЯЁ]+)?)/,  // "1 Ильяс ХАЛИУЛЛИН"
        /^(\d+)\.\s*([А-ЯЁ][а-яё]+\s+[А-ЯЁА-ЯЁ]+)/,  // "1. Ильяс ХАЛИУЛЛИН"
        /Место[:\s]+(\d+)[\s]+([А-ЯЁ][а-яё]+\s+[А-ЯЁА-ЯЁ]+)/i,  // "Место: 1 Ильяс ХАЛИУЛЛИН"
        /^([А-ЯЁ][а-яё]+\s+[А-ЯЁА-ЯЁ]+(?:\s+[А-ЯЁА-ЯЁ]+)?)/  // Просто имя без номера
    ];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Поиск начала блока фигуриста с использованием нескольких паттернов
        let skaterNameMatch = null;
        let place = null;
        let name = null;
        
        for (const pattern of skaterPatterns) {
            const match = line.match(pattern);
            if (match) {
                skaterNameMatch = match;
                // Определяем место и имя в зависимости от паттерна
                if (pattern === skaterPatterns[0] || pattern === skaterPatterns[1]) {
                    place = parseInt(match[1]);
                    name = match[2].trim();
                } else if (pattern === skaterPatterns[2]) {
                    place = parseInt(match[1]);
                    name = match[2].trim();
                } else {
                    place = results.skaters.length + 1;
                    name = match[1].trim();
                }
                break;
            }
        }
        
        // Если нашли нового фигуриста и уже есть текущий, сохраняем предыдущего
        if (skaterNameMatch && currentSkater && currentSkater.name) {
            const newPlace = place;
            if (newPlace && newPlace !== currentSkater.place) {
                results.skaters.push(currentSkater);
                currentSkater = null;
            }
        }
        
        // Дополнительная проверка: ищем строки с именами в формате "Имя ФАМИЛИЯ"
        if (!skaterNameMatch) {
            const namePattern = /([А-ЯЁ][а-яё]+)\s+([А-ЯЁА-ЯЁ]{4,})/;
            const nameMatch = line.match(namePattern);
            // Проверяем, что это не просто случайное совпадение
            if (nameMatch && line.length < 80 && !line.match(/[0-9]{4}/)) {
                // Исключаем строки с ключевыми словами, которые не являются именами
                const excludeWords = ['Республика', 'Регион', 'Область', 'Край', 'Город', 
                                     'Старт', 'номер', 'Место', 'Выполненные', 'Компоненты',
                                     'Базовая', 'стоимость', 'GOE', 'Оценка', 'бригады',
                                     'Исполкома', 'ФФККР', 'РСШОР', 'МАФКК', 'школа',
                                     'Соревнования', 'Всероссийские', 'Правительство',
                                     'Министерство', 'Минспорт', 'Генеральный', 'Партнер'];
                const hasExcludeWord = excludeWords.some(word => line.includes(word));
                
                if (!hasExcludeWord) {
                    // Проверяем, что в строке нет слишком много чисел (это не таблица)
                    const numbers = line.match(/\d+/g);
                    if (!numbers || numbers.length < 2) {
                        // Проверяем, что имя содержит минимум 2 слова
                        const words = line.trim().split(/\s+/);
                        if (words.length >= 2 && words[0].match(/^[А-ЯЁ][а-яё]+$/) && 
                            words[1].match(/^[А-ЯЁА-ЯЁ]+$/)) {
                            place = results.skaters.length + 1;
                            name = line.trim();
                            skaterNameMatch = nameMatch;
                        }
                    }
                }
            }
        }
        
        if (skaterNameMatch && name) {
            // Дополнительная валидация имени
            const nameWords = name.split(/\s+/).filter(w => w.length > 0);
            // Имя должно содержать минимум 2 слова
            if (nameWords.length >= 2) {
                // Второе слово должно быть фамилией (заглавными буквами, минимум 4 символа)
                const lastName = nameWords[1];
                const isValidLastName = lastName.match(/^[А-ЯЁА-ЯЁ]{4,}$/);
                
                // Исключаем имена, которые слишком короткие или содержат служебные слова
                const excludeWords = ['Республика', 'Регион', 'Область', 'Край', 'Город', 'Старт', 'номер',
                                     'Исполкома', 'ФФККР', 'РСШОР', 'МАФКК', 'школа', 'Соревнования',
                                     'Всероссийские', 'Правительство', 'Министерство', 'Минспорт',
                                     'Генеральный', 'Партнер', 'Памяти', 'ЗТР', 'Тарасова'];
                const hasExcludeWord = excludeWords.some(word => name.includes(word));
                
                // Дополнительная проверка: первое слово должно быть именем (не организацией)
                const firstName = nameWords[0];
                const isOrganizationWord = ['Исполкома', 'Правительство', 'Министерство', 'Соревнования',
                                          'Всероссийские', 'Памяти', 'Генеральный'].some(word => 
                                          firstName.includes(word) || firstName === word);
                
                // Проверяем, что имя не слишком короткое и не является частью другого текста
                const isTooShort = nameWords.some(w => w.length < 2);
                const hasValidStructure = isValidLastName && name.length > 8 && !hasExcludeWord && 
                                         !isTooShort && !isOrganizationWord;
                
                if (hasValidStructure) {
                    // Очищаем имя от лишних частей (например, коды регионов)
                    // Убираем короткие заглавные слова в конце (коды регионов типа "ТАТ", "МОС")
                    name = name.replace(/\s+[А-ЯЁ]{2,4}$/, '').trim();
                    
                    // Дополнительная проверка: имя не должно быть слишком коротким после очистки
                    const cleanedWords = name.split(/\s+/);
                    if (cleanedWords.length >= 2 && cleanedWords[0].length >= 3 && cleanedWords[1].length >= 4) {
                        // Сохраняем предыдущего фигуриста
                        if (currentSkater && currentSkater.name) {
                            results.skaters.push(currentSkater);
                        }
                        
                    // Создаём нового фигуриста
                    currentSkater = {
                        place: place,
                        name: name,
                        scores: {
                            deductions: 0.00,
                            elements: [],
                            programComponents: []
                        }
                    };
                    // Обновляем индекс текущего фигуриста для отладки
                    currentSkaterDebugIndex = results.skaters.length; // Индекс будет 0, 1, 2...
                    
                    addDebugLog(`НАЙДЕН ФИГУРИСТ: ${name} (место: ${place})`, 'success');
                    // После создания фигуриста сразу переходим в режим поиска элементов
                    parsingState = 'elements';
                    continue;
                    }
                }
            }
        }
        
        if (!currentSkater) continue;
        
        // Поиск "Общая сумма снижений"
        if ((line.includes('снижений') || line.includes('снижение')) && line.includes('Общая')) {
            const dedMatch = line.match(/(\d+[.,]\d+)/);
            if (dedMatch) {
                currentSkater.scores.deductions = parseFloat(dedMatch[1].replace(',', '.'));
            }
        }
        
        // Если встретили заголовок таблицы элементов, переключаемся на парсинг элементов
        if (line.includes('Выполненные элементы') || (line.includes('Базовая') && line.includes('стоимость'))) {
            addDebugLog(`Заголовок элементов: "${line.substring(0, 50)}"`, 'info');
            parsingState = 'elements';
            // НЕ делаем continue, чтобы не пропустить возможный элемент в этой же строке
        }
        
        // Если встретили заголовок компонентов, переключаемся на парсинг компонентов
        // ТОЛЬКО при явном заголовке "Компоненты программы" и если уже есть элементы
        if (line.includes('Компоненты программы') && currentSkater && currentSkater.scores.elements.length > 0) {
            addDebugLog(`✓ Переключение на компоненты. Найдено элементов: ${currentSkater.scores.elements.length}`, 'success');
            parsingState = 'components';
            // НЕ делаем continue, чтобы не пропустить возможный компонент в этой же строке
        }
        
        // Также переключаемся на компоненты, если встретили название компонента после элементов
        // Это для случаев, когда заголовок "Компоненты программы" отсутствует
        if (currentSkater && parsingState === 'elements' && currentSkater.scores.elements.length > 0) {
            const componentNamesCheck = ['Композиция', 'Представление', 'Мастерство катания', 
                                         'Связующие элементы', 'Интерпретация'];
            for (const compName of componentNamesCheck) {
                if (line.includes(compName) && line.match(/\d+[.,]\d+/)) {
                    // Проверяем, что это действительно компонент (есть числа после названия)
                    const numbers = line.match(/(\d+[.,]\d+)/g);
                    if (numbers && numbers.length >= 2) {
                        addDebugLog(`✓ Автоматическое переключение на компоненты (найден: ${compName})`, 'success');
                        parsingState = 'components';
                        break;
                    }
                }
            }
        }
        
        // Поиск элементов: номер, название, базовая стоимость, GOE, J1..Jn, оценка бригады
        // Формат: "1 3A 8.00 2.24 3 2 2 3 2 2 3 10.24"
        // Формат с бонусом: "4 3Lz+3T 11.11 x 1.18 2 2 2 3 2 2 2 12.29"
        // Более гибкие паттерны для элементов
        const elementPatterns = [
            /^(\d+)\s+([A-Z][A-Z0-9a-z+]*[a-z]?\d?[x]?)\s+([\d.,]+)\s+(x\s+)?([\d.,-]+)/,  // С учетом "x" для бонуса
            /^(\d+)\s+([A-Z][A-Z0-9a-z+]*[a-z]?\d?[x]?)\s+([\d.,]+)\s+([\d.,-]+)/,  // Стандартный формат
            /^(\d+)\s+([A-Z][A-Z0-9a-z+]*[a-z]?\d?[x]?)\s+([\d.,]+)/,  // Без GOE
            /([A-Z][A-Z0-9a-z+]*[a-z]?\d?[x]?)\s+([\d.,]+)\s+([\d.,-]+)/  // Без номера
        ];
        
        // Проверяем, что это действительно элемент (содержит типичные обозначения элементов)
        // Более гибкая проверка - ищем строки, которые могут быть элементами
        // Исключаем строки с компонентами программы
        const isComponentLine = line.includes('Композиция') || line.includes('Представление') || 
                                line.includes('Мастерство') || line.includes('Связующие') || 
                                line.includes('Интерпретация') || line.includes('Компоненты программы');
        
        const isElementLine = !isComponentLine && (
                             line.match(/[0-9][A-Z]/) || 
                             line.includes('3A') || line.includes('3Lo') || line.includes('CCSp') || 
                             line.includes('3Lz') || line.includes('StSq') || line.includes('CCoSp') || 
                             line.includes('FSSp') || line.includes('FCCoSp') || line.includes('USp') ||
                             line.includes('ChSq') || line.includes('ChSp') || line.includes('LSp') ||
                             line.match(/\b[1-4][A-Z][a-z]?\d?[x]?\b/) ||
                             // Также проверяем строки, которые начинаются с цифры и содержат буквы и числа
                             (line.match(/^\d+\s+[A-Z]/) && line.match(/\d+[.,]\d+/) && line.split(/\s+/).length >= 4));
        
        let elementMatch = null;
        // Ищем элементы если мы в режиме поиска элементов или если уже есть элементы у текущего фигуриста
        // НЕ переключаемся на компоненты, пока не встретим явный заголовок компонентов
        if (currentSkater && (parsingState === 'elements' || currentSkater.scores.elements.length > 0 || parsingState === 'skaterInfo')) {
            // Переключаемся на компоненты ТОЛЬКО при явном заголовке "Компоненты программы"
            // НЕ переключаемся просто при встрече слова "Композиция", так как это может быть часть элемента
            if (line.includes('Компоненты программы') && currentSkater.scores.elements.length > 0) {
                console.log(`[${i}] Переключение на компоненты (внутренняя проверка)`);
                parsingState = 'components';
            } else if (parsingState !== 'components') {
                // Пробуем найти элемент, если строка похожа на элемент
                // Сначала пробуем строгие паттерны
                if (isElementLine) {
                    addDebugLog(`Проверка как элемент (isElementLine=true): "${line.substring(0, 80)}"`, 'info');
                    for (const pattern of elementPatterns) {
                        const match = line.match(pattern);
                        if (match) {
                            elementMatch = match;
                            addDebugLog(`✓ Найден элемент через паттерн: ${match[0]}`, 'success');
                            break;
                        }
                    }
                }
                
                // Если не нашли через паттерны, но строка начинается с цифры и содержит буквы и числа - пробуем парсить
                if (!elementMatch && line.match(/^\d+\s+[A-Z]/) && line.match(/\d+[.,]\d+/) && 
                    line.split(/\s+/).length >= 4 && !isComponentLine) {
                    addDebugLog(`Попытка гибкого поиска элемента: "${line.substring(0, 80)}"`, 'info');
                    // Пробуем более гибкий подход - ищем любую строку с номером, буквами и числами
                    for (const pattern of elementPatterns) {
                        const match = line.match(pattern);
                        if (match) {
                            elementMatch = match;
                            addDebugLog(`✓ Найден элемент через гибкий поиск: ${match[0]}`, 'success');
                            break;
                        }
                    }
                }
                
                if (!elementMatch && isElementLine) {
                    addDebugLog(`✗ Элемент не распознан, хотя isElementLine=true: "${line.substring(0, 80)}"`, 'error');
                }
            }
        }
        
        if (elementMatch || isElementLine) {
            // Разбиваем строку на части
            const allValues = line.split(/\s+/).filter(part => part.length > 0);
            
            if (allValues.length >= 4) {
                // Формат: "1 3A 8.00 2.24 3 3 3 3 3 2 2 10.24"
                // Формат с бонусом: "4 3Lz+3T 11.11 x 1.18 2 2 2 3 2 2 2 12.29"
                
                let elementNumber = null;
                let elementName = null;
                let baseValue = null;
                let goe = null;
                const judgeScores = [];
                let panelScore = null;
                
                // Ищем номер элемента (первое число, обычно 1-7)
                if (allValues[0].match(/^\d+$/)) {
                    elementNumber = parseInt(allValues[0]);
                }
                
                // Парсим строку вручную для более точного извлечения данных
                addDebugLog(`  Все значения в строке: [${allValues.join(', ')}]`, 'info');
                
                // Упрощенная логика: идем по порядку и находим каждое значение
                let currentIndex = 0;
                
                // 1. Пропускаем номер элемента (если есть)
                if (elementNumber && allValues[currentIndex] === elementNumber.toString()) {
                    currentIndex++;
                }
                
                // 2. Находим название элемента - первое значение с заглавными буквами
                while (currentIndex < allValues.length) {
                    const val = allValues[currentIndex];
                    // Название элемента должно содержать заглавные буквы
                    if (val.match(/[A-Z]/) && 
                        !val.match(/^\d+[.,]\d+$/) && 
                        !val.match(/^-?\d+$/) && 
                        val !== 'x' && val !== '<' && val !== '>' && val !== '-') {
                        elementName = val;
                        addDebugLog(`  Название элемента: ${elementName}`, 'info');
                        currentIndex++;
                        break;
                    }
                    currentIndex++;
                }
                
                // 3. Пропускаем "<" или ">" после названия (если есть)
                while (currentIndex < allValues.length && 
                       (allValues[currentIndex] === '<' || allValues[currentIndex] === '>')) {
                    currentIndex++;
                }
                
                // 4. Находим базовую стоимость - первое десятичное число после названия
                while (currentIndex < allValues.length) {
                    const val = allValues[currentIndex];
                    if (val.match(/^\d+[.,]\d+$/)) {
                        baseValue = parseFloat(val.replace(',', '.'));
                        addDebugLog(`  Базовая стоимость: ${baseValue}`, 'info');
                        currentIndex++;
                        break;
                    }
                    currentIndex++;
                }
                
                // 5. Пропускаем "<" или ">" после базовой стоимости (если есть)
                while (currentIndex < allValues.length && 
                       (allValues[currentIndex] === '<' || allValues[currentIndex] === '>')) {
                    currentIndex++;
                }
                
                // 6. Пропускаем "x" (бонус) если есть
                if (currentIndex < allValues.length && allValues[currentIndex] === 'x') {
                    addDebugLog(`  Найден бонус "x"`, 'info');
                    currentIndex++;
                }
                
                // 7. Находим GOE - следующее десятичное число (может быть отрицательным)
                while (currentIndex < allValues.length) {
                    const val = allValues[currentIndex];
                    if (val.match(/^[\d.,-]+$/)) {
                        const goeValue = parseFloat(val.replace(',', '.'));
                        if (goeValue >= -5 && goeValue <= 5 && Math.abs(goeValue - baseValue) > 0.01) {
                            goe = goeValue;
                            addDebugLog(`  GOE: ${goe}`, 'info');
                            currentIndex++;
                            break;
                        }
                    }
                    currentIndex++;
                }
                
                // 8. Находим оценки судей - все целые числа от -5 до 5 после GOE
                while (currentIndex < allValues.length) {
                    const val = allValues[currentIndex];
                    
                    // Пропускаем специальные символы
                    if (val === '<' || val === '>' || val === 'x' || val === '-') {
                        currentIndex++;
                        continue;
                    }
                    
                    // Если это целое число от -5 до 5 - это оценка судьи
                    if (val.match(/^-?\d+$/)) {
                        const judgeScore = parseInt(val);
                        if (!isNaN(judgeScore) && judgeScore >= -5 && judgeScore <= 5) {
                            judgeScores.push(judgeScore);
                            addDebugLog(`  Оценка судьи ${judgeScores.length}: ${judgeScore}`, 'info');
                            currentIndex++;
                            // Продолжаем искать оценки судей, но не более 9
                            if (judgeScores.length >= 9) {
                                break;
                            }
                            continue;
                        }
                    }
                    
                    // Если это десятичное число - это может быть оценка бригады
                    if (val.match(/^\d+[.,]\d+$/)) {
                        const panelScoreValue = parseFloat(val.replace(',', '.'));
                        // Оценка бригады должна быть близка к базовой стоимости + GOE
                        // Или просто последнее большое число (больше 3, меньше 20)
                        const expectedScore = (baseValue !== null && goe !== null) ? 
                            baseValue + goe : null;
                        
                        if (panelScoreValue >= 3 && panelScoreValue < 20 &&
                            (baseValue === null || Math.abs(panelScoreValue - baseValue) > 0.1) &&
                            (goe === null || Math.abs(panelScoreValue - Math.abs(goe)) > 0.1)) {
                            // Если есть ожидаемая оценка, проверяем близость
                            if (expectedScore === null || Math.abs(panelScoreValue - expectedScore) < 0.5) {
                                panelScore = panelScoreValue;
                                addDebugLog(`  Оценка бригады найдена: ${panelScore} (ожидалось: ${expectedScore ? expectedScore.toFixed(2) : 'N/A'})`, 'info');
                                break;
                            }
                        }
                    }
                    
                    currentIndex++;
                }
                
                // Если оценка бригады не найдена, ищем в обратном порядке
                // Оценка бригады = базовая стоимость + GOE (с небольшой погрешностью)
                if (!panelScore && baseValue !== null && goe !== null) {
                    const expectedScore = baseValue + goe;
                    addDebugLog(`  Ищем оценку бригады в обратном порядке (ожидаем: ${expectedScore.toFixed(2)})`, 'info');
                    
                    // Ищем в обратном порядке, начиная с конца строки
                    addDebugLog(`  Обратный поиск: проверяем ${allValues.length} значений`, 'info');
                    for (let i = allValues.length - 1; i >= 0; i--) {
                        const val = allValues[i];
                        addDebugLog(`  [${i}] Проверяем значение: "${val}"`, 'info');
                        
                        // Пропускаем специальные символы
                        if (val === '<' || val === '>' || val === 'x' || val === '-') {
                            addDebugLog(`    Пропускаем специальный символ: ${val}`, 'info');
                            continue;
                        }
                        
                        // Пропускаем оценки судей (только целые числа, не десятичные!)
                        // Проверяем, что это целое число, а не десятичное
                        if (val.match(/^-?\d+$/)) {
                            const judgeScore = parseInt(val);
                            if (!isNaN(judgeScore) && judgeScore >= -5 && judgeScore <= 5) {
                                addDebugLog(`    Пропускаем оценку судьи: ${judgeScore}`, 'info');
                                continue;
                            }
                        }
                        
                        // Пропускаем номер элемента
                        if (elementNumber && val === elementNumber.toString()) {
                            addDebugLog(`    Пропускаем номер элемента: ${val}`, 'info');
                            continue;
                        }
                        
                        // Пропускаем название элемента
                        if (elementName && val === elementName) {
                            addDebugLog(`    Пропускаем название элемента: ${val}`, 'info');
                            continue;
                        }
                        
                        // Пропускаем "nS" и другие служебные символы
                        if (val === 'nS' || val === 'F' || val === 'e' || val === 'COMBO') {
                            addDebugLog(`    Пропускаем служебный символ: ${val}`, 'info');
                            continue;
                        }
                        
                        // Ищем десятичное число, близкое к базовой стоимости + GOE
                        if (val.match(/^\d+[.,]\d+$/)) {
                            const num = parseFloat(val.replace(',', '.'));
                            
                            // Пропускаем GOE, только если он не равен базовой стоимости
                            // (при GOE=0 оценка = базовая стоимость, и это нормально)
                            if (goe !== null && Math.abs(num - goe) < 0.01 && Math.abs(num - baseValue) > 0.01) {
                                addDebugLog(`  Пропускаем GOE: ${num}`, 'info');
                                continue;
                            }
                            
                            // Пропускаем базовую стоимость только если GOE != 0
                            // (при GOE=0 оценка = базовая стоимость)
                            const isGoeZero = goe !== null && Math.abs(goe) < 0.01;
                            const isBaseValue = baseValue !== null && Math.abs(num - baseValue) < 0.01;
                            if (!isGoeZero && isBaseValue) {
                                addDebugLog(`  Пропускаем базовую стоимость (GOE != 0): ${num}`, 'info');
                                continue; // Пропускаем базовую стоимость, если GOE != 0
                            }
                            
                            // Оценка бригады должна быть близка к базовой стоимости + GOE
                            // С погрешностью до 0.5 балла
                            // Также принимаем числа от 1.0 (для очень низких оценок, например 2.20)
                            if (num >= 1.0 && num < 20) {
                                const diff = Math.abs(num - expectedScore);
                                addDebugLog(`  Проверяем число: ${num}, ожидалось: ${expectedScore.toFixed(2)}, разница: ${diff.toFixed(2)}, базовая: ${baseValue}, GOE: ${goe}`, 'info');
                                // Проверяем, что это не базовая стоимость (если GOE != 0)
                                // И что это близко к ожидаемой оценке
                                if (diff < 0.5 && (!isBaseValue || isGoeZero)) {
                                    panelScore = num;
                                    addDebugLog(`  Оценка бригады найдена (обратный поиск): ${panelScore} (ожидалось: ${expectedScore.toFixed(2)})`, 'info');
                                    break;
                                } else {
                                    addDebugLog(`  Не подходит: diff=${diff.toFixed(2)} (нужно <0.5), isBaseValue=${isBaseValue}, isGoeZero=${isGoeZero}`, 'info');
                                }
                            }
                        }
                    }
                    
                    // Если не нашли по формуле, ищем просто последнее большое число
                    if (!panelScore) {
                        addDebugLog(`  Второй поиск: проверяем ${allValues.length} значений`, 'info');
                        for (let i = allValues.length - 1; i >= 0; i--) {
                            const val = allValues[i];
                            addDebugLog(`  [${i}] Второй поиск, значение: "${val}"`, 'info');
                            
                            // Пропускаем специальные символы
                            if (val === '<' || val === '>' || val === 'x' || val === '-') {
                                addDebugLog(`    Пропускаем специальный символ: ${val}`, 'info');
                                continue;
                            }
                            
                            // Пропускаем оценки судей (только целые числа, не десятичные!)
                            // Проверяем, что это целое число, а не десятичное
                            if (val.match(/^-?\d+$/)) {
                                const judgeScore = parseInt(val);
                                if (!isNaN(judgeScore) && judgeScore >= -5 && judgeScore <= 5) {
                                    addDebugLog(`    Пропускаем оценку судьи: ${judgeScore}`, 'info');
                                    continue;
                                }
                            }
                            
                            // Пропускаем номер элемента
                            if (elementNumber && val === elementNumber.toString()) {
                                addDebugLog(`    Пропускаем номер элемента: ${val}`, 'info');
                                continue;
                            }
                            
                            // Пропускаем название элемента
                            if (elementName && val === elementName) {
                                addDebugLog(`    Пропускаем название элемента: ${val}`, 'info');
                                continue;
                            }
                            
                            // Пропускаем "nS" и другие служебные символы
                            if (val === 'nS' || val === 'F' || val === 'e' || val === 'COMBO') {
                                addDebugLog(`    Пропускаем служебный символ: ${val}`, 'info');
                                continue;
                            }
                            
                            // Ищем последнее десятичное число, которое может быть оценкой бригады
                            if (val.match(/^\d+[.,]\d+$/)) {
                                const num = parseFloat(val.replace(',', '.'));
                                
                                // Пропускаем GOE, только если он не равен базовой стоимости
                                if (goe !== null && Math.abs(num - goe) < 0.01 && Math.abs(num - baseValue) > 0.01) {
                                    addDebugLog(`  Пропускаем GOE (второй поиск): ${num}`, 'info');
                                    continue;
                                }
                                
                                // Берем последнее большое число (от 1.0 для очень низких оценок, например 2.20)
                                if (num >= 1.0 && num < 20) {
                                    // Если GOE = 0, то оценка бригады = базовая стоимость, и это нормально
                                    // Если GOE != 0, то оценка бригады != базовой стоимости
                                    const isGoeZero = goe !== null && Math.abs(goe) < 0.01;
                                    const isBaseValue = baseValue !== null && Math.abs(num - baseValue) < 0.01;
                                    
                                    addDebugLog(`  Проверяем число (второй поиск): ${num}, GOE=0: ${isGoeZero}, базовая: ${isBaseValue}`, 'info');
                                    
                                    if (!isGoeZero && isBaseValue) {
                                        // Пропускаем, если это базовая стоимость, а GOE не 0
                                        addDebugLog(`  Пропускаем базовую стоимость (GOE != 0): ${num}`, 'info');
                                        continue;
                                    }
                                    
                                    // Если GOE = 0 и число = базовой стоимости, это и есть оценка бригады
                                    if (isGoeZero && isBaseValue) {
                                        panelScore = num;
                                        addDebugLog(`  Оценка бригады найдена (GOE=0, равна базовой стоимости): ${panelScore}`, 'info');
                                        break;
                                    }
                                    
                                    // Проверяем, что это близко к ожидаемой оценке (если есть)
                                    if (expectedScore !== null) {
                                        const diff = Math.abs(num - expectedScore);
                                        addDebugLog(`  Проверяем близость к expectedScore: ${num}, ожидалось: ${expectedScore.toFixed(2)}, разница: ${diff.toFixed(2)}`, 'info');
                                        if (diff < 0.5) {
                                            panelScore = num;
                                            addDebugLog(`  Оценка бригады найдена (последнее число, ожидалось: ${expectedScore.toFixed(2)}): ${panelScore}`, 'info');
                                            break;
                                        }
                                    } else {
                                        // Если нет ожидаемой оценки, берем последнее число
                                        // Но не базовую стоимость, если GOE != 0
                                        if (!isBaseValue || isGoeZero) {
                                            panelScore = num;
                                            addDebugLog(`  Оценка бригады найдена (последнее число): ${panelScore}`, 'info');
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    if (!panelScore) {
                        addDebugLog(`  Оценка бригады не найдена (ожидалось: ${expectedScore.toFixed(2)})`, 'warning');
                    }
                } else if (!panelScore) {
                    addDebugLog(`  Оценка бригады не найдена (нет базовой стоимости или GOE)`, 'warning');
                }
                
                // Создаем элемент только если нашли название и базовую стоимость
                if (elementName && baseValue !== null && !isNaN(baseValue)) {
                    // Дополнительная проверка: название должно содержать буквы
                    if (elementName.match(/[A-Z]/)) {
                        // Проверяем, что такого элемента еще нет (по названию и базовой стоимости)
                        const exists = currentSkater.scores.elements.some(e => 
                            e.name === elementName && Math.abs(e.baseValue - baseValue) < 0.01
                        );
                        
                        if (!exists) {
                            const element = {
                                name: elementName, // Выполненный элемент
                                baseValue: baseValue, // Базовая стоимость
                                goe: goe, // GOE
                                judgeScores: judgeScores, // J1..Jn
                                panelScore: panelScore // Оценка бригады
                            };
                            
                            addDebugLog(`✓ ДОБАВЛЕН ЭЛЕМЕНТ: ${elementName}, базовая: ${baseValue}, GOE: ${goe}, судей: ${judgeScores.length} [${judgeScores.join(', ')}], оценка: ${panelScore || 'нет'}`, 'success');
                            currentSkater.scores.elements.push(element);
                            parsingState = 'elements';
                            continue;
                        } else {
                            addDebugLog(`✗ Элемент ${elementName} уже существует, пропускаем`, 'warning');
                        }
                    } else {
                        addDebugLog(`✗ Название элемента не содержит букв: "${elementName}"`, 'error');
                    }
                } else {
                    addDebugLog(`✗ Не удалось извлечь данные элемента. Название: "${elementName}", Базовая: ${baseValue}`, 'error');
                }
            }
        }
        
        // Поиск компонентов программы
        // Формат: "Композиция 1.67 7.25 7.50 7.00 7.25 7.00 7.25 7.00 7.25"
        const componentNames = [
            'Композиция', 'Представление', 'Мастерство катания', 
            'Связующие элементы', 'Интерпретация',
            'Composition', 'Presentation', 'Skating Skills', 
            'Transitions', 'Interpretation'
        ];
        
        // Ищем компоненты если:
        // 1. Мы в режиме поиска компонентов ИЛИ
        // 2. Уже есть элементы и найдена строка с названием компонента
        // Продолжаем искать компоненты, пока не встретим следующего фигуриста
        const shouldCheckComponents = currentSkater && 
            currentSkater.scores.elements.length > 0 &&
            !line.match(/^\d+\s+[А-ЯЁ]/) && // Не начало нового фигуриста
            !line.includes('Выполненные элементы'); // Не заголовок элементов
        
        if (shouldCheckComponents) {
            // Проверяем, есть ли в строке название компонента
            let foundComponentName = null;
            for (const compName of componentNames) {
                // Более гибкий поиск: ищем частичное совпадение
                // Например, "Мастерство катания" может быть написано как "Мастерство"
                const compNameParts = compName.split(' ');
                let matches = true;
                for (const part of compNameParts) {
                    if (part.length > 3 && !line.includes(part)) {
                        matches = false;
                        break;
                    }
                }
                
                if (matches && !line.includes('Компоненты программы') && 
                    !line.includes('компоненты программы')) {
                    foundComponentName = compName;
                    addDebugLog(`  Проверка компонента "${compName}": найдено совпадение в строке "${line.substring(0, 80)}"`, 'info');
                    break;
                }
            }
            
            // Если нашли название компонента, переключаемся на режим компонентов
            if (foundComponentName && parsingState !== 'components') {
                addDebugLog(`✓ Автоматическое переключение на компоненты (найден: ${foundComponentName})`, 'success');
                parsingState = 'components';
            }
            
            // Если мы в режиме компонентов или нашли название компонента, парсим компонент
            if ((parsingState === 'components' || foundComponentName) && foundComponentName) {
                addDebugLog(`Проверка строки на компоненты: "${line.substring(0, 100)}"`, 'info');
                addDebugLog(`  Найдено название компонента: ${foundComponentName}`, 'info');
                
                // Извлекаем все числа из строки
                const numbers = line.match(/(\d+[.,]\d+)/g);
                
                addDebugLog(`  Найдено чисел в строке: ${numbers ? numbers.length : 0}`, 'info');
                if (numbers) {
                    addDebugLog(`  Числа: [${numbers.join(', ')}]`, 'info');
                }
                
                if (numbers && numbers.length >= 2) {
                    const component = {
                        name: foundComponentName,
                        factor: parseFloat(numbers[0].replace(',', '.')), // Фактор
                        judgeScores: [], // J1..Jn
                        averageScore: null // Средняя оценка
                    };
                    
                    // Оценки судей - все числа между фактором и последним числом
                    for (let j = 1; j < numbers.length - 1; j++) {
                        const score = parseFloat(numbers[j].replace(',', '.'));
                        if (score >= 0 && score <= 10) {
                            component.judgeScores.push(score);
                        }
                    }
                    
                    // Последнее число - средняя оценка
                    if (numbers.length > 1) {
                        component.averageScore = parseFloat(numbers[numbers.length - 1].replace(',', '.'));
                    }
                    
                    // Проверяем, что такого компонента еще нет
                    const exists = currentSkater.scores.programComponents.some(c => c.name === foundComponentName);
                    if (!exists) {
                        addDebugLog(`✓ ДОБАВЛЕН КОМПОНЕНТ: ${foundComponentName}, фактор: ${component.factor}, судей: ${component.judgeScores.length} [${component.judgeScores.join(', ')}], средняя: ${component.averageScore}`, 'success');
                        currentSkater.scores.programComponents.push(component);
                        parsingState = 'components';
                    } else {
                        addDebugLog(`✗ Компонент ${foundComponentName} уже существует, пропускаем`, 'warning');
                    }
                } else {
                    addDebugLog(`✗ Недостаточно чисел для компонента ${foundComponentName} (нужно минимум 2, найдено: ${numbers ? numbers.length : 0})`, 'warning');
                }
            } else if (parsingState === 'components') {
                // В режиме компонентов, но не нашли название - проверяем все возможные варианты
                addDebugLog(`  В режиме компонентов, проверяю строку: "${line.substring(0, 80)}"`, 'info');
            }
        }
    }
    
    // Добавляем последнего фигуриста
    if (currentSkater && currentSkater.name) {
        addDebugLog(`Добавление последнего фигуриста: ${currentSkater.name}`, 'info');
        addDebugLog(`  Элементов: ${currentSkater.scores.elements.length}`, 'info');
        addDebugLog(`  Компонентов: ${currentSkater.scores.programComponents.length}`, 'info');
        results.skaters.push(currentSkater);
    }
    
    addDebugLog(`=== РЕЗУЛЬТАТЫ ПАРСИНГА ===`, 'info');
    addDebugLog(`Найдено фигуристов: ${results.skaters.length}`, results.skaters.length > 0 ? 'success' : 'error');
    results.skaters.forEach((skater, idx) => {
        addDebugLog(`${idx + 1}. ${skater.name}: элементов=${skater.scores.elements.length}, компонентов=${skater.scores.programComponents.length}`, 'info');
        skater.scores.elements.forEach((el, elIdx) => {
            addDebugLog(`  Элемент ${elIdx + 1}: ${el.name} (базовая: ${el.baseValue})`, 'info');
        });
    });
    
    // Если не нашли фигуристов основным методом, пробуем альтернативный
    if (results.skaters.length === 0) {
        addDebugLog('Основной парсер не нашел фигуристов, пробуем альтернативный метод...', 'warning');
        const altSkaters = parseAlternativeFormat(text);
        if (altSkaters.length > 0) {
            results.skaters = altSkaters;
            addDebugLog(`Альтернативный метод нашел ${altSkaters.length} фигуристов`, 'success');
        }
    }
    
    return results;
}

// Альтернативный метод парсинга
function parseAlternativeFormat(text) {
    const skaters = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Более гибкие паттерны для поиска имен
    const namePatterns = [
        /^(\d+)\s+([А-ЯЁ][а-яё]+\s+[А-ЯЁА-ЯЁ]+)/,  // "1 Ильяс ХАЛИУЛЛИН"
        /^([А-ЯЁ][а-яё]+\s+[А-ЯЁА-ЯЁ]+)/,  // "Ильяс ХАЛИУЛЛИН"
        /([А-ЯЁ][а-яё]+)\s+([А-ЯЁ]{4,})/,  // "Ильяс ХАЛИУЛЛИН" (более гибкий)
    ];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Пропускаем строки, которые явно не являются именами
        if (line.length > 100 || line.match(/^\d+[.,]\d+/) || 
            line.includes('Выполненные элементы') || line.includes('Компоненты программы') ||
            line.includes('Базовая стоимость') || line.includes('GOE')) {
            continue;
        }
        
        let name = null;
        let place = null;
        
        for (const pattern of namePatterns) {
            const match = line.match(pattern);
            if (match) {
                if (match.length === 3 && !isNaN(parseInt(match[1]))) {
                    place = parseInt(match[1]);
                    name = match[2] ? match[2].trim() : match[1].trim();
                } else if (match.length >= 2) {
                    name = (match[2] || match[1]).trim();
                    place = null;
                }
                
                // Проверяем, что это действительно имя (не слишком длинное, содержит буквы)
                if (name && name.length < 50 && name.match(/[А-ЯЁа-яё]/)) {
                    // Ищем элементы и компоненты в следующих строках
                    const skater = {
                        name: name,
                        place: place || (skaters.length + 1),
                        scores: {
                            deductions: 0.00,
                            elements: [],
                            programComponents: []
                        }
                    };
                    
                    // Ищем элементы в следующих строках
                    for (let j = i + 1; j < Math.min(i + 50, lines.length); j++) {
                        const nextLine = lines[j];
                        
                        // Если встретили следующего фигуриста, останавливаемся
                        if (nextLine.match(/^(\d+)\s+[А-ЯЁ]/)) break;
                        
                        // Поиск элементов
                        const elemMatch = nextLine.match(/([A-Z0-9+]+[a-z]?\d?[x]?)\s+([\d.,]+)/);
                        if (elemMatch && (nextLine.includes('3A') || nextLine.includes('3Lo') || 
                            nextLine.match(/[0-9][A-Z]/))) {
                            const numbers = nextLine.match(/(\d+[.,]\d+|\d+)/g);
                            if (numbers && numbers.length >= 2) {
                                skater.scores.elements.push({
                                    name: elemMatch[1],
                                    baseValue: parseFloat(numbers[0].replace(',', '.')),
                                    goe: numbers.length > 1 ? parseFloat(numbers[1].replace(',', '.')) : null,
                                    judgeScores: [],
                                    panelScore: numbers.length > 2 ? parseFloat(numbers[numbers.length - 1].replace(',', '.')) : null
                                });
                            }
                        }
                        
                        // Поиск компонентов
                        if (nextLine.includes('Композиция') || nextLine.includes('Представление') ||
                            nextLine.includes('Мастерство')) {
                            const numbers = nextLine.match(/(\d+[.,]\d+)/g);
                            if (numbers && numbers.length >= 2) {
                                const compName = nextLine.match(/([А-ЯЁа-яё]+)/);
                                skater.scores.programComponents.push({
                                    name: compName ? compName[0] : 'Компонент',
                                    factor: parseFloat(numbers[0].replace(',', '.')),
                                    judgeScores: [],
                                    averageScore: parseFloat(numbers[numbers.length - 1].replace(',', '.'))
                                });
                            }
                        }
                    }
                    
                    if (skater.scores.elements.length > 0 || skater.scores.programComponents.length > 0) {
                        skaters.push(skater);
                        break;
                    }
                }
            }
        }
    }
    
    return skaters;
}

// Парсинг международного формата ISU
function parseISUFormat(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    results = {
        firstLine: lines.length > 0 ? lines[0] : '',
        competitionName: extractISUCompetitionName(text),
        fileName: currentPdfFile.name,
        parsedAt: new Date().toISOString(),
        skaters: []
    };
    
    let currentSkater = null;
    let parsingState = 'searching'; // searching, elements, components
    
    addDebugLog('=== ПАРСИНГ ISU ФОРМАТА ===', 'info');
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // СНАЧАЛА проверяем, не является ли строка новым фигуристом (даже если мы в режиме компонентов)
        // Это критично, чтобы не пропустить фигуристов и не приписать их компоненты предыдущему
        let skaterMatch = null;
        
        // Поиск строки с фигуристом: "1 Yuma KAGIYAMA JPN 5 108.77 61.54 47.23 0.00"
        // Или: "5 Adam SIAO HIM FA FRA 3 78.49 37.43 42.06 1.00"
        // Формат: Rank Name Surname Nation StartingNumber TotalScore ElementScore ComponentScore Deductions
        // Имя может быть с заглавной буквы (Yuma, Adam), фамилия может быть полностью заглавными (KAGIYAMA, SIAO HIM FA)
        // Более гибкий паттерн: номер, имя (может быть несколько слов), фамилия (может быть несколько слов), нация (3 буквы), номер старта, 4 числа
        // Используем более гибкий паттерн, который допускает разные форматы имен
        
        // Сначала пробуем строгий паттерн
        let skaterPattern = /^(\d+)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\s+([A-Z]+(?:\s+[A-Z]+)*)\s+([A-Z]{3})\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.+-]+)$/;
        skaterMatch = line.match(skaterPattern);
        
        // Если не нашли, пробуем более гибкий паттерн (допускаем смешанный регистр в фамилии)
        if (!skaterMatch) {
            // Паттерн, который допускает любые буквы в имени и фамилии после первой буквы
            skaterPattern = /^(\d+)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)\s+([A-Z]{3})\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.+-]+)$/;
            skaterMatch = line.match(skaterPattern);
        }
        
        // Если все еще не нашли, пробуем еще более гибкий - просто ищем строку, которая начинается с числа и содержит 3-буквенный код нации
        if (!skaterMatch && /^\d+\s+[A-Z]/.test(line)) {
            // Разбиваем строку на части и проверяем вручную
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 9) {
                const rank = parseInt(parts[0]);
                // Ищем 3-буквенный код нации (обычно это код страны)
                let nationIndex = -1;
                for (let j = 1; j < parts.length; j++) {
                    if (parts[j].length === 3 && /^[A-Z]{3}$/.test(parts[j])) {
                        nationIndex = j;
                        break;
                    }
                }
                
                if (nationIndex > 0 && nationIndex < parts.length - 5 && !isNaN(rank) && rank > 0) {
                    // Проверяем, что после нации идут числа (номер старта и оценки)
                    const startNum = parseInt(parts[nationIndex + 1]);
                    const totalScore = parseFloat(parts[nationIndex + 2]);
                    
                    if (!isNaN(startNum) && !isNaN(totalScore) && totalScore > 0) {
                        // Это похоже на строку с фигуристом
                        // Разделяем имя и фамилию: имя - слова с первой заглавной и остальными строчными (Adam)
                        // Фамилия - все остальные слова до нации, обычно все заглавные (SIAO HIM FA)
                        const nameParts = parts.slice(1, nationIndex);
                        let firstNameParts = [];
                        let lastNameParts = [];
                        let foundLastName = false;
                        
                        for (let k = 0; k < nameParts.length; k++) {
                            const part = nameParts[k];
                            // Если слово полностью заглавными или начинается с заглавной и содержит строчные - это имя
                            // Если слово полностью заглавными и длина > 1 - это фамилия
                            if (!foundLastName && /^[A-Z][a-z]+$/.test(part)) {
                                // Слово с первой заглавной и остальными строчными - это имя
                                firstNameParts.push(part);
                            } else if (/^[A-Z]+$/.test(part) && part.length > 1) {
                                // Слово полностью заглавными - это фамилия
                                foundLastName = true;
                                lastNameParts.push(part);
                            } else if (foundLastName) {
                                // Если уже нашли фамилию, все последующие слова - тоже фамилия
                                lastNameParts.push(part);
                            } else {
                                // Неопределенный случай - добавляем к имени
                                firstNameParts.push(part);
                            }
                        }
                        
                        // Если не нашли фамилию, берем последнее слово как фамилию
                        if (lastNameParts.length === 0 && nameParts.length > 0) {
                            lastNameParts = [nameParts[nameParts.length - 1]];
                            firstNameParts = nameParts.slice(0, nameParts.length - 1);
                        }
                        
                        // Если имя пустое, берем первое слово как имя
                        if (firstNameParts.length === 0 && nameParts.length > 0) {
                            firstNameParts = [nameParts[0]];
                            lastNameParts = nameParts.slice(1);
                        }
                        
                        const firstName = firstNameParts.join(' ');
                        const lastName = lastNameParts.join(' ');
                        const nation = parts[nationIndex];
                        const startingNumber = startNum;
                        const elementScore = parseFloat(parts[nationIndex + 3]);
                        const componentScore = parseFloat(parts[nationIndex + 4]);
                        const deductions = parseFloat(parts[nationIndex + 5]);
                        
                        // Проверяем, что все значения валидны (deductions может быть отрицательным)
                        if (!isNaN(elementScore) && !isNaN(componentScore) && !isNaN(deductions)) {
                            // Создаем объект match вручную
                            skaterMatch = [
                                line,
                                rank.toString(),
                                firstName,
                                lastName,
                                nation,
                                startingNumber.toString(),
                                totalScore.toString(),
                                elementScore.toString(),
                                componentScore.toString(),
                                deductions.toString()
                            ];
                            
                            addDebugLog(`⚠️ Фигурист найден альтернативным методом: ${firstName} ${lastName} (место: ${rank}, нация: ${nation})`, 'warning');
                        }
                    }
                }
            }
        }
        
        // Дополнительная проверка: если строка похожа на фигуриста, но не распознана, пробуем альтернативный метод
        // ВАЖНО: эта проверка должна выполняться ДО проверки на компоненты, чтобы не пропустить фигуристов
        if (!skaterMatch && /^\d+\s+[A-Z]/.test(line)) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 9) { // Минимум: место, имя, фамилия, нация, номер старта, 4 оценки
                const rank = parseInt(parts[0]);
                // Проверяем, есть ли 3-буквенный код нации
                let nationIndex = -1;
                for (let j = 1; j < parts.length; j++) {
                    if (parts[j].length === 3 && /^[A-Z]{3}$/.test(parts[j])) {
                        nationIndex = j;
                        break;
                    }
                }
                
                if (!isNaN(rank) && rank > 0 && rank <= 10 && nationIndex > 0 && nationIndex < parts.length - 5) {
                    // Пробуем альтернативный метод парсинга
                    const startNum = parseInt(parts[nationIndex + 1]);
                    const totalScore = parseFloat(parts[nationIndex + 2]);
                    
                    // Проверяем, что это валидные числа (totalScore может быть любым, deductions может быть отрицательным)
                    if (!isNaN(startNum) && !isNaN(totalScore) && totalScore > 0) {
                        const nameParts = parts.slice(1, nationIndex);
                        let firstNameParts = [];
                        let lastNameParts = [];
                        let foundLastName = false;
                        
                        for (let k = 0; k < nameParts.length; k++) {
                            const part = nameParts[k];
                            if (!foundLastName && /^[A-Z][a-z]+$/.test(part)) {
                                firstNameParts.push(part);
                            } else if (/^[A-Z]+$/.test(part) && part.length > 1) {
                                foundLastName = true;
                                lastNameParts.push(part);
                            } else if (foundLastName) {
                                lastNameParts.push(part);
                            } else {
                                firstNameParts.push(part);
                            }
                        }
                        
                        if (lastNameParts.length === 0 && nameParts.length > 0) {
                            lastNameParts = [nameParts[nameParts.length - 1]];
                            firstNameParts = nameParts.slice(0, nameParts.length - 1);
                        }
                        
                        if (firstNameParts.length === 0 && nameParts.length > 0) {
                            firstNameParts = [nameParts[0]];
                            lastNameParts = nameParts.slice(1);
                        }
                        
                        const firstName = firstNameParts.join(' ');
                        const lastName = lastNameParts.join(' ');
                        const nation = parts[nationIndex];
                        const startingNumber = startNum;
                        const elementScore = parseFloat(parts[nationIndex + 3]);
                        const componentScore = parseFloat(parts[nationIndex + 4]);
                        const deductions = parseFloat(parts[nationIndex + 5]);
                        
                        // Проверяем, что все значения валидны
                        if (!isNaN(elementScore) && !isNaN(componentScore) && !isNaN(deductions)) {
                            // Создаем объект match вручную
                            skaterMatch = [
                                line,
                                rank.toString(),
                                firstName,
                                lastName,
                                nation,
                                startingNumber.toString(),
                                totalScore.toString(),
                                elementScore.toString(),
                                componentScore.toString(),
                                deductions.toString()
                            ];
                            
                            addDebugLog(`⚠️ Фигурист найден альтернативным методом (дополнительная проверка): ${firstName} ${lastName} (место: ${rank}, нация: ${nation})`, 'warning');
                        }
                    }
                }
            }
        }
        
        if (skaterMatch) {
            // Сохраняем предыдущего фигуриста
            if (currentSkater && currentSkater.name) {
                results.skaters.push(currentSkater);
                addDebugLog(`✓ Сохранен фигурист: ${currentSkater.name} (элементов: ${currentSkater.scores.elements.length}, компонентов: ${currentSkater.scores.programComponents.length})`, 'info');
            }
            
            const rank = parseInt(skaterMatch[1]);
            let firstName = skaterMatch[2];
            let lastName = skaterMatch[3];
            const nation = skaterMatch[4];
            const startingNumber = parseInt(skaterMatch[5]);
            const totalScore = parseFloat(skaterMatch[6]);
            const elementScore = parseFloat(skaterMatch[7]);
            const componentScore = parseFloat(skaterMatch[8]);
            const deductions = parseFloat(skaterMatch[9]);
            
            // Если фамилия содержит несколько слов (например, "SIAO HIM FA"), объединяем их
            // Проверяем, не является ли следующее слово после firstName частью фамилии
            if (skaterMatch.length > 10) {
                // Это альтернативный метод парсинга, где мы уже правильно разделили имя и фамилию
                // firstName и lastName уже правильные
            } else {
                // Стандартный метод - проверяем, нужно ли объединить несколько слов в фамилию
                // Если после lastName идет еще одно слово с заглавными буквами до нации, это часть фамилии
            }
            
            currentSkater = {
                place: rank,
                name: `${firstName} ${lastName}`,
                nation: nation,
                startingNumber: startingNumber,
                totalScore: totalScore,
                elementScore: elementScore,
                componentScore: componentScore,
                scores: {
                    deductions: deductions,
                    elements: [],
                    programComponents: []
                }
            };
            
            addDebugLog(`НАЙДЕН ФИГУРИСТ ISU: ${currentSkater.name} (место: ${rank}, нация: ${nation})`, 'success');
            parsingState = 'elements';
            continue;
        }
        
        // Также проверяем на начало нового фигуриста даже в режиме компонентов
        // Это нужно, если предыдущий фигурист не был распознан, но его компоненты парсятся
        if (parsingState === 'components' && !skaterMatch) {
            // Пробуем более мягкий паттерн для поиска фигуриста
            // Формат может быть: "5 Adam SIAO HIM FA FRA 3 78.49..."
            const softSkaterPattern = /^(\d+)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\s+([A-Z]+(?:\s+[A-Z]+)*)\s+([A-Z]{3})\s+(\d+)\s+([\d.]+)/;
            const softMatch = line.match(softSkaterPattern);
            
            if (softMatch && softMatch[1] && parseInt(softMatch[1]) > 0) {
                const rank = parseInt(softMatch[1]);
                // Проверяем, что это не компонент и не элемент
                if (!line.match(/^(Composition|Presentation|Skating Skills|Performance|Interpretation)/i) &&
                    !/^\d+\s+[A-Z0-9]/.test(line)) {
                    // Это может быть новый фигурист
                    addDebugLog(`⚠️ Возможный новый фигурист в режиме компонентов: ${line.substring(0, 80)}`, 'warning');
                }
            }
        }
        
        if (!currentSkater) continue;
        
        // Парсинг элементов: "1 4T+3T 13.70 3.94 4 3 4 3 4 4 5 5 5 17.64"
        // Формат: # ElementName BaseValue GOE J1 J2 J3 J4 J5 J6 J7 J8 J9 Score
        // Может быть 7 или 9 судей
        if (parsingState === 'elements') {
            // Проверяем, не начались ли компоненты (но только если это точно компонент, а не элемент с похожим названием)
            // Компонент должен начинаться с названия и содержать фактор и оценки судей
            const componentStartPattern = /^(Composition|Presentation|Skating Skills|Performance|Interpretation)\s+[\d.]+\s+[\d.]+/i;
            if (line.match(componentStartPattern)) {
                addDebugLog(`✓ Переключение на компоненты (найдено: ${line.substring(0, 30)})`, 'info');
                parsingState = 'components';
                // Продолжаем выполнение, чтобы обработать компонент в блоке компонентов ниже
            } else {
                // Проверяем, что строка начинается с цифры (номер элемента)
                if (!/^\d+\s+/.test(line)) {
                    continue; // Пропускаем строки, которые не начинаются с номера элемента
                }
            }
            
            // Если мы переключились на компоненты, выходим из блока элементов
            if (parsingState === 'components') {
                // Продолжаем выполнение, чтобы обработать компонент в блоке компонентов ниже
                // НЕ обрабатываем эту строку как элемент
            } else {
                // Более гибкий парсинг: разбиваем строку на части и анализируем
            const parts = line.trim().split(/\s+/);
            if (parts.length < 5) continue; // Минимум: номер, название, базовая, GOE, оценка
            
            // Номер элемента - первое число
            const elementNumber = parseInt(parts[0]);
            if (isNaN(elementNumber)) continue;
            
            // Ищем базовую стоимость и GOE (это числа с точкой)
            let baseValueIndex = -1;
            let goeIndex = -1;
            let panelScoreIndex = -1;
            
            for (let i = 1; i < parts.length; i++) {
                const part = parts[i];
                // Базовая стоимость - число с точкой, обычно после названия элемента
                if (baseValueIndex === -1 && /^\d+\.\d+$/.test(part)) {
                    baseValueIndex = i;
                }
                // GOE - число с точкой или знак +/-, обычно после базовой стоимости
                else if (baseValueIndex !== -1 && goeIndex === -1 && /^[+-]?\d+\.\d+$/.test(part)) {
                    goeIndex = i;
                }
            }
            
            // Последнее число с точкой - это оценка бригады
            for (let i = parts.length - 1; i >= 0; i--) {
                if (/^\d+\.\d+$/.test(parts[i])) {
                    panelScoreIndex = i;
                    break;
                }
            }
            
            if (baseValueIndex === -1 || goeIndex === -1 || panelScoreIndex === -1) {
                if (/^\d+\s+[A-Z0-9]/.test(line)) {
                    addDebugLog(`⚠️ Не удалось найти базовую стоимость, GOE или оценку в строке: ${line.substring(0, 100)}`, 'warning');
                }
                continue;
            }
            
            // Название элемента - все части между номером и базовой стоимостью
            const elementNameParts = parts.slice(1, baseValueIndex);
            let elementName = elementNameParts.join(' ');
            
            // Убираем маркеры качества из названия (q, e, <, <<, x) - они будут в отдельном поле
            const qualityMarkers = [];
            const cleanedNameParts = [];
            for (const part of elementNameParts) {
                if (/^[qex<>!]+$/i.test(part)) {
                    qualityMarkers.push(part);
                } else {
                    cleanedNameParts.push(part);
                }
            }
            elementName = cleanedNameParts.join(' ');
            
            // Проверяем наличие "x" между базовой стоимостью и GOE
            let hasBonus = false;
            if (goeIndex > baseValueIndex + 1) {
                const betweenParts = parts.slice(baseValueIndex + 1, goeIndex);
                if (betweenParts.includes('x') || betweenParts.some(p => p.toLowerCase() === 'x')) {
                    hasBonus = true;
                }
            }
            
            // Проверяем наличие "x" в названии
            if (!hasBonus && (elementName.includes('x') || qualityMarkers.some(m => m.toLowerCase() === 'x'))) {
                hasBonus = true;
                elementName = elementName.replace(/\s*x\s*/gi, ' ').trim();
            }
            
            const baseValue = parseFloat(parts[baseValueIndex]);
            const goe = parseFloat(parts[goeIndex]);
            const panelScore = parseFloat(parts[panelScoreIndex]);
            
            // Судьи - все числа между GOE и оценкой бригады
            const judgeScores = [];
            for (let i = goeIndex + 1; i < panelScoreIndex; i++) {
                const score = parseInt(parts[i]);
                if (!isNaN(score) && score >= -5 && score <= 5) {
                    judgeScores.push(score);
                }
            }
            
            // Если нашли все необходимые данные, создаем элемент
            if (!isNaN(baseValue) && !isNaN(goe) && !isNaN(panelScore) && judgeScores.length > 0) {
                currentSkater.scores.elements.push({
                    number: elementNumber,
                    name: elementName,
                    baseValue: baseValue,
                    GOE: goe,  // Сохраняем как GOE для совместимости
                    goe: goe,  // Также сохраняем как goe для ISU формата
                    judgeScores: judgeScores,
                    panelScore: panelScore,
                    bonus: hasBonus
                });
                
                addDebugLog(`✓ Элемент ISU: ${elementName}, базовая: ${baseValue}, GOE: ${goe}, судей: ${judgeScores.length}, оценка: ${panelScore}`, 'success');
            } else {
                if (/^\d+\s+[A-Z0-9]/.test(line)) {
                    addDebugLog(`⚠️ Не удалось распарсить элемент (базовая: ${baseValue}, GOE: ${goe}, оценка: ${panelScore}, судей: ${judgeScores.length}): ${line.substring(0, 100)}`, 'warning');
                }
            }
            }
        }
        
        // Парсинг компонентов: "Composition 1.67 9.25 8.75 9.50 9.00 9.50 9.25 9.50 9.50 9.50 9.36"
        // Формат: ComponentName Factor J1 J2 J3 J4 J5 J6 J7 J8 J9 AverageScore
        // Может быть 7 или 9 судей
        if (parsingState === 'components') {
            // СНАЧАЛА проверяем, не начался ли новый фигурист
            // Это важно, чтобы компоненты не приписывались неправильному фигуристу
            let newSkaterMatch = null;
            
            // Пробуем основной паттерн (допускаем отрицательные deductions)
            const newSkaterPattern = /^(\d+)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\s+([A-Z]+(?:\s+[A-Z]+)*)\s+([A-Z]{3})\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.+-]+)$/;
            newSkaterMatch = line.match(newSkaterPattern);
            
            // Если не нашли, пробуем альтернативный метод (как выше)
            if (!newSkaterMatch && /^\d+\s+[A-Z]/.test(line)) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 9) {
                    const rank = parseInt(parts[0]);
                    let nationIndex = -1;
                    for (let j = 1; j < parts.length; j++) {
                        if (parts[j].length === 3 && /^[A-Z]{3}$/.test(parts[j])) {
                            nationIndex = j;
                            break;
                        }
                    }
                    
                    if (nationIndex > 0 && nationIndex < parts.length - 5 && !isNaN(rank) && rank > 0) {
                        const startNum = parseInt(parts[nationIndex + 1]);
                        const totalScore = parseFloat(parts[nationIndex + 2]);
                        
                        if (!isNaN(startNum) && !isNaN(totalScore) && totalScore > 0) {
                            const nameParts = parts.slice(1, nationIndex);
                            let firstNameParts = [];
                            let lastNameParts = [];
                            let foundLastName = false;
                            
                            for (let k = 0; k < nameParts.length; k++) {
                                const part = nameParts[k];
                                if (!foundLastName && /^[A-Z][a-z]+$/.test(part)) {
                                    firstNameParts.push(part);
                                } else if (/^[A-Z]+$/.test(part) && part.length > 1) {
                                    foundLastName = true;
                                    lastNameParts.push(part);
                                } else if (foundLastName) {
                                    lastNameParts.push(part);
                                } else {
                                    firstNameParts.push(part);
                                }
                            }
                            
                            if (lastNameParts.length === 0 && nameParts.length > 0) {
                                lastNameParts = [nameParts[nameParts.length - 1]];
                                firstNameParts = nameParts.slice(0, nameParts.length - 1);
                            }
                            
                            if (firstNameParts.length === 0 && nameParts.length > 0) {
                                firstNameParts = [nameParts[0]];
                                lastNameParts = nameParts.slice(1);
                            }
                            
                            const firstName = firstNameParts.join(' ');
                            const lastName = lastNameParts.join(' ');
                            const nation = parts[nationIndex];
                            const startingNumber = startNum;
                            const elementScore = parseFloat(parts[nationIndex + 3]);
                            const componentScore = parseFloat(parts[nationIndex + 4]);
                            const deductions = parseFloat(parts[nationIndex + 5]);
                            
                            newSkaterMatch = [
                                line,
                                rank.toString(),
                                firstName,
                                lastName,
                                nation,
                                startingNumber.toString(),
                                totalScore.toString(),
                                elementScore.toString(),
                                componentScore.toString(),
                                deductions.toString()
                            ];
                            
                            addDebugLog(`⚠️ Фигурист найден альтернативным методом (в режиме компонентов): ${firstName} ${lastName} (место: ${rank}, нация: ${nation})`, 'warning');
                        }
                    }
                }
            }
            
            if (newSkaterMatch) {
                // Сохраняем предыдущего фигуриста
                if (currentSkater && currentSkater.name) {
                    results.skaters.push(currentSkater);
                    addDebugLog(`✓ Сохранен фигурист после компонентов: ${currentSkater.name} (элементов: ${currentSkater.scores.elements.length}, компонентов: ${currentSkater.scores.programComponents.length})`, 'info');
                }
                
                const rank = parseInt(newSkaterMatch[1]);
                const firstName = newSkaterMatch[2];
                const lastName = newSkaterMatch[3];
                const nation = newSkaterMatch[4];
                const startingNumber = parseInt(newSkaterMatch[5]);
                const totalScore = parseFloat(newSkaterMatch[6]);
                const elementScore = parseFloat(newSkaterMatch[7]);
                const componentScore = parseFloat(newSkaterMatch[8]);
                const deductions = parseFloat(newSkaterMatch[9]);
                
                currentSkater = {
                    place: rank,
                    name: `${firstName} ${lastName}`,
                    nation: nation,
                    startingNumber: startingNumber,
                    totalScore: totalScore,
                    elementScore: elementScore,
                    componentScore: componentScore,
                    scores: {
                        deductions: deductions,
                        elements: [],
                        programComponents: []
                    }
                };
                
                addDebugLog(`НАЙДЕН ФИГУРИСТ ISU (в режиме компонентов): ${currentSkater.name} (место: ${rank}, нация: ${nation})`, 'success');
                parsingState = 'elements';
                continue;
            }
            
            // Пробуем сначала с 9 судьями
            let componentPattern = /^(Composition|Presentation|Skating Skills|Performance|Interpretation)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)$/i;
            let componentMatch = line.match(componentPattern);
            let judgeCount = 9;
            
            if (!componentMatch) {
                // Пробуем с 7 судьями
                componentPattern = /^(Composition|Presentation|Skating Skills|Performance|Interpretation)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)$/i;
                componentMatch = line.match(componentPattern);
                if (componentMatch) {
                    judgeCount = 7;
                }
            }
            
            // Если не нашли компонент, но строка начинается с названия компонента, пробуем более гибкий парсинг
            if (!componentMatch && !newSkaterMatch && /^(Composition|Presentation|Skating Skills|Performance|Interpretation)/i.test(line)) {
                addDebugLog(`⚠️ Строка похожа на компонент, но не распознана стандартным паттерном: ${line.substring(0, 120)}`, 'warning');
                // Пробуем более гибкий парсинг компонента
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 3) {
                    const componentName = parts[0];
                    const factor = parseFloat(parts[1]);
                    if (!isNaN(factor) && factor > 0) {
                        // Пробуем извлечь оценки судей (все числа после фактора)
                        // Формат: ComponentName Factor J1 J2 J3 J4 J5 J6 J7 J8 J9 AverageScore
                        const allNumbers = [];
                        for (let i = 2; i < parts.length; i++) {
                            const num = parseFloat(parts[i]);
                            if (!isNaN(num)) {
                                allNumbers.push(num);
                            }
                        }
                        
                        // Если нашли достаточно чисел (минимум 8: 7-9 судей + средняя)
                        if (allNumbers.length >= 8) {
                            // Последнее число - это средняя оценка
                            const averageScore = allNumbers[allNumbers.length - 1];
                            // Все остальные - оценки судей
                            const judgeScores = allNumbers.slice(0, allNumbers.length - 1);
                            
                            // Проверяем, что оценки судей в допустимом диапазоне (0-10)
                            const validJudgeScores = judgeScores.filter(s => s >= 0 && s <= 10);
                            
                            if (validJudgeScores.length >= 7 && averageScore >= 0 && averageScore <= 10) {
                                const componentNames = {
                                    'Composition': 'Композиция',
                                    'Presentation': 'Представление',
                                    'Skating Skills': 'Мастерство катания',
                                    'Performance': 'Представление',
                                    'Interpretation': 'Интерпретация'
                                };
                                
                                currentSkater.scores.programComponents.push({
                                    name: componentNames[componentName] || componentName,
                                    factor: factor,
                                    judgeScores: validJudgeScores,
                                    averageScore: averageScore
                                });
                                
                                addDebugLog(`✓ Компонент ISU (гибкий парсинг): ${componentName}, фактор: ${factor}, средняя: ${averageScore}, судей: ${validJudgeScores.length}`, 'success');
                                componentMatch = true; // Помечаем, что компонент обработан
                            } else {
                                addDebugLog(`  Недостаточно валидных оценок: найдено ${validJudgeScores.length} валидных из ${judgeScores.length}, средняя: ${averageScore}`, 'warning');
                            }
                        } else {
                            addDebugLog(`  Недостаточно чисел: найдено ${allNumbers.length}, нужно минимум 8`, 'warning');
                        }
                    }
                }
            }
            
            if (componentMatch) {
                const componentName = componentMatch[1];
                const factor = parseFloat(componentMatch[2]);
                let judgeScores = [];
                let averageScore;
                
                if (judgeCount === 9) {
                    judgeScores = [
                        parseFloat(componentMatch[3]),
                        parseFloat(componentMatch[4]),
                        parseFloat(componentMatch[5]),
                        parseFloat(componentMatch[6]),
                        parseFloat(componentMatch[7]),
                        parseFloat(componentMatch[8]),
                        parseFloat(componentMatch[9]),
                        parseFloat(componentMatch[10]),
                        parseFloat(componentMatch[11])
                    ];
                    averageScore = parseFloat(componentMatch[12]);
                } else {
                    // 7 судей
                    judgeScores = [
                        parseFloat(componentMatch[3]),
                        parseFloat(componentMatch[4]),
                        parseFloat(componentMatch[5]),
                        parseFloat(componentMatch[6]),
                        parseFloat(componentMatch[7]),
                        parseFloat(componentMatch[8]),
                        parseFloat(componentMatch[9])
                    ];
                    averageScore = parseFloat(componentMatch[10]);
                }
                
                // Переводим названия компонентов на русский
                const componentNames = {
                    'Composition': 'Композиция',
                    'Presentation': 'Представление',
                    'Skating Skills': 'Мастерство катания',
                    'Performance': 'Представление',
                    'Interpretation': 'Интерпретация'
                };
                
                currentSkater.scores.programComponents.push({
                    name: componentNames[componentName] || componentName,
                    factor: factor,
                    judgeScores: judgeScores,
                    averageScore: averageScore
                });
                
                addDebugLog(`✓ Компонент ISU: ${componentName}, фактор: ${factor}, средняя: ${averageScore}, судей: ${judgeScores.length}`, 'success');
            } else if (!newSkaterMatch && /^(Composition|Presentation|Skating Skills|Performance|Interpretation)/i.test(line)) {
                // Строка начинается с названия компонента, но не соответствует паттерну
                addDebugLog(`⚠️ Строка похожа на компонент, но не распознана: ${line.substring(0, 120)}`, 'warning');
            }
        }
    }
    
    // Добавляем последнего фигуриста
    if (currentSkater && currentSkater.name) {
        results.skaters.push(currentSkater);
    }
    
    return results;
}

// Извлечение названия соревнования из ISU формата
function extractISUCompetitionName(text) {
    const patterns = [
        /ISU\s+(?:Grand Prix|Junior Grand Prix|Championships|World Championships|European Championships|Four Continents Championships)[^0-9]+/i,
        /([A-Z\s]+(?:Grand Prix|Championships)[^0-9]+)/i
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            return match[0].trim();
        }
    }
    
    return 'ISU Competition';
}

// Извлечение страны из строки
function extractCountry(line) {
    const countryPattern = /(RUS|USA|CAN|JPN|CHN|KOR|FRA|ITA|GER|GBR|ESP|SWE|FIN|NOR|DEN|NED|BEL|AUT|SUI|CZE|POL|HUN|ROU|BUL|UKR|BLR|KAZ|UZB|GEO|ARM|AZE|ISR|AUS|NZL|BRA|ARG|MEX|RSA)/i;
    const match = line.match(countryPattern);
    return match ? match[1].toUpperCase() : null;
}

// Извлечение числа из строки
function extractNumber(line) {
    const match = line.match(/(\d+[.,]\d+)/);
    return match ? parseFloat(match[1].replace(',', '.')) : null;
}

// Отображение результатов
function displayResults(data) {
    const resultsContent = document.getElementById('resultsContent');
    
    if (!data.skaters || data.skaters.length === 0) {
        resultsContent.innerHTML = `
            <div class="error-message">
                Не удалось извлечь данные о фигуристах из PDF файла.<br>
                Убедитесь, что файл содержит результаты соревнований в структурированном формате.
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="success-message">
            <strong>Первая строка:</strong> ${data.firstLine || 'Не найдена'}<br>
            <strong>Соревнование:</strong> ${data.competitionName}<br>
            <strong>Найдено фигуристов:</strong> ${data.skaters.length}
        </div>
    `;
    
    // Добавляем детализацию для каждого фигуриста
    html += '<div class="skater-details">';
    data.skaters.forEach((skater, index) => {
        // Вычисляем суммы для сводной информации
        let technicalTotal = 0; // Сумма в технической оценке
        if (skater.scores.elements && skater.scores.elements.length > 0) {
            technicalTotal = skater.scores.elements.reduce((sum, el) => {
                if (el.panelScore !== null && !isNaN(el.panelScore)) {
                    return sum + el.panelScore;
                } else if (el.baseValue !== null && !isNaN(el.baseValue)) {
                    const goe = (el.goe !== null && !isNaN(el.goe)) ? el.goe : 0;
                    return sum + el.baseValue + goe;
                }
                return sum;
            }, 0);
        }
        
        let componentsTotal = 0; // Сумма за компоненты (умноженная)
        if (skater.scores.programComponents && skater.scores.programComponents.length > 0) {
            componentsTotal = skater.scores.programComponents.reduce((sum, comp) => {
                const componentScore = (comp.averageScore !== null && !isNaN(comp.averageScore) ? comp.averageScore : 0) *
                                      (comp.factor !== null && !isNaN(comp.factor) ? comp.factor : 0);
                return sum + componentScore;
            }, 0);
        }
        
        const deductions = skater.scores.deductions || 0;
        const totalScore = technicalTotal + componentsTotal - deductions; // Общая сумма за вид
        
        html += `
            <div class="detail-section">
                <h3>${skater.place || (index + 1)}. ${skater.name}</h3>
                
                <!-- Сводная информация -->
                <div class="summary-scores">
                    <table class="summary-table">
                        <thead>
                            <tr>
                                <th>Общая сумма за вид</th>
                                <th>Сумма в технической оценке</th>
                                <th>Сумма за компоненты (умноженная)</th>
                                <th>Общая сумма снижений</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><strong>${totalScore.toFixed(2)}</strong></td>
                                <td><strong>${technicalTotal.toFixed(2)}</strong></td>
                                <td><strong>${componentsTotal.toFixed(2)}</strong></td>
                                <td><strong>${deductions.toFixed(2)}</strong></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
        `;
        
        // Детализация элементов
        if (skater.scores.elements && skater.scores.elements.length > 0) {
            html += `
                <h4>Выполненные элементы:</h4>
                <table class="detail-table">
                    <thead>
                        <tr>
                            <th>Элемент</th>
                            <th>Базовая стоимость</th>
                            <th>GOE</th>
                            <th>J1</th>
                            <th>J2</th>
                            <th>J3</th>
                            <th>J4</th>
                            <th>J5</th>
                            <th>J6</th>
                            <th>J7</th>
                            <th>Оценка бригады</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            skater.scores.elements.forEach((element, idx) => {
                const judgeCells = [];
                for (let j = 0; j < 7; j++) {
                    judgeCells.push(element.judgeScores[j] !== undefined ? element.judgeScores[j] : '-');
                }
                html += `
                    <tr>
                        <td><strong>${element.name || (idx + 1)}</strong></td>
                        <td>${element.baseValue !== null && !isNaN(element.baseValue) ? element.baseValue.toFixed(2) : '-'}</td>
                        <td>${(element.goe !== null && !isNaN(element.goe)) ? (element.goe >= 0 ? '+' : '') + element.goe.toFixed(2) : 
                            ((element.GOE !== null && !isNaN(element.GOE)) ? (element.GOE >= 0 ? '+' : '') + element.GOE.toFixed(2) : '-')}</td>
                        <td>${judgeCells[0]}</td>
                        <td>${judgeCells[1]}</td>
                        <td>${judgeCells[2]}</td>
                        <td>${judgeCells[3]}</td>
                        <td>${judgeCells[4]}</td>
                        <td>${judgeCells[5]}</td>
                        <td>${judgeCells[6]}</td>
                        <td><strong>${element.panelScore !== null ? element.panelScore.toFixed(2) : '-'}</strong></td>
                    </tr>
                `;
            });
            html += `</tbody></table>`;
        }
        
        // Детализация компонентов
        if (skater.scores.programComponents && skater.scores.programComponents.length > 0) {
            html += `
                <h4>Компоненты программы:</h4>
                <table class="detail-table">
                    <thead>
                        <tr>
                            <th>Компонент</th>
                            <th>Фактор</th>
                            <th>J1</th>
                            <th>J2</th>
                            <th>J3</th>
                            <th>J4</th>
                            <th>J5</th>
                            <th>J6</th>
                            <th>J7</th>
                            <th>Средняя</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            skater.scores.programComponents.forEach(component => {
                const judgeCells = [];
                for (let j = 0; j < 7; j++) {
                    judgeCells.push(component.judgeScores[j] !== undefined ? component.judgeScores[j].toFixed(2) : '-');
                }
                html += `
                    <tr>
                        <td><strong>${component.name}</strong></td>
                        <td>${component.factor.toFixed(2)}</td>
                        <td>${judgeCells[0]}</td>
                        <td>${judgeCells[1]}</td>
                        <td>${judgeCells[2]}</td>
                        <td>${judgeCells[3]}</td>
                        <td>${judgeCells[4]}</td>
                        <td>${judgeCells[5]}</td>
                        <td>${judgeCells[6]}</td>
                        <td><strong>${component.averageScore !== null ? component.averageScore.toFixed(2) : '-'}</strong></td>
                    </tr>
                `;
            });
            html += `</tbody></table>`;
        }
        
        // Снижения
        html += `
            <div class="deductions-section">
                <h4>Снижения:</h4>
                <p><strong>Общая сумма снижений:</strong> ${skater.scores.deductions.toFixed(2)}</p>
            </div>
        `;
        
        html += `</div>`;
    });
    html += '</div>';
    
    resultsContent.innerHTML = html;
}

// Отображение статистики
function displayStatistics(data) {
    if (!data.skaters || data.skaters.length === 0) return;
    
    const statsGrid = document.getElementById('statsGrid');
    const skaters = data.skaters;
    
    // Вычисляем общий балл для каждого фигуриста
    const skatersWithScores = skaters.map(skater => {
        // Сумма оценок бригады за элементы
        let elementsTotal = 0;
        if (skater.scores.elements && skater.scores.elements.length > 0) {
            elementsTotal = skater.scores.elements.reduce((sum, el) => {
                // Используем panelScore, если есть, иначе вычисляем из базовой стоимости + GOE
                if (el.panelScore !== null && !isNaN(el.panelScore)) {
                    return sum + el.panelScore;
                } else if (el.baseValue !== null && !isNaN(el.baseValue)) {
                    // Проверяем оба варианта: goe (ISU) и GOE (российский формат)
                    const goe = (el.goe !== null && !isNaN(el.goe)) ? el.goe : 
                                ((el.GOE !== null && !isNaN(el.GOE)) ? el.GOE : 0);
                    return sum + el.baseValue + goe;
                }
                return sum;
            }, 0);
        }
        
        // Сумма компонентов (средняя оценка * фактор)
        let componentsTotal = 0;
        if (skater.scores.programComponents && skater.scores.programComponents.length > 0) {
            componentsTotal = skater.scores.programComponents.reduce((sum, comp) => {
                const componentScore = (comp.averageScore !== null && !isNaN(comp.averageScore) ? comp.averageScore : 0) *
                                      (comp.factor !== null && !isNaN(comp.factor) ? comp.factor : 0);
                return sum + componentScore;
            }, 0);
        }
        
        // Общий балл = элементы + компоненты - снижения
        const total = elementsTotal + componentsTotal - (skater.scores.deductions || 0);
        
        return {
            ...skater,
            calculatedTotal: total
        };
    });
    
    const totalSkaters = skaters.length;
    const scoresWithTotal = skatersWithScores.filter(s => s.calculatedTotal > 0);
    const avgScore = scoresWithTotal.length > 0
        ? scoresWithTotal.reduce((sum, s) => sum + s.calculatedTotal, 0) / scoresWithTotal.length
        : 0;
    const maxScore = scoresWithTotal.length > 0
        ? Math.max(...scoresWithTotal.map(s => s.calculatedTotal))
        : 0;
    const minScore = scoresWithTotal.length > 0
        ? Math.min(...scoresWithTotal.map(s => s.calculatedTotal))
        : 0;
    
    statsGrid.innerHTML = `
        <div class="stat-card">
            <div class="stat-label">Всего фигуристов</div>
            <div class="stat-value">${totalSkaters}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Средний балл</div>
            <div class="stat-value">${avgScore.toFixed(2)}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Максимальный балл</div>
            <div class="stat-value">${maxScore.toFixed(2)}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Минимальный балл</div>
            <div class="stat-value">${minScore.toFixed(2)}</div>
        </div>
    `;
    
    document.getElementById('statsSection').style.display = 'block';
}

// Сохранение текущих результатов
async function saveCurrentResults() {
    if (!currentPdfData) {
        alert('Нет данных для сохранения');
        return;
    }
    
    try {
        // Сохраняем в IndexedDB
        await initDatabase();
        const result = await saveCompetitionData(currentPdfData);
        
        // Также сохраняем в localStorage для обратной совместимости
        savedResults.push(currentPdfData);
        localStorage.setItem('figureSkatingResults', JSON.stringify(savedResults));
        
        loadSavedResults();
        loadCompetitionsFromDB();
        
        alert('Результаты сохранены в базу данных!');
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        console.error('Детали ошибки:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        let errorMessage = `Ошибка при сохранении в базу данных: ${error.message || 'Неизвестная ошибка'}`;
        
        // Если ошибка связана с открытием БД, предлагаем сброс
        if (error.message && (error.message.includes('backing store') || error.message.includes('Internal error'))) {
            errorMessage += '\n\nВозможно, база данных повреждена. Хотите сбросить базу данных?';
            if (confirm(errorMessage)) {
                try {
                    if (typeof window.resetDatabase === 'function') {
                        await window.resetDatabase();
                        alert('База данных сброшена. Попробуйте сохранить данные снова.');
                    } else {
                        // Если функция недоступна, предлагаем очистить вручную
                        alert('Для сброса базы данных:\n1. Откройте консоль браузера (F12)\n2. Введите: indexedDB.deleteDatabase("FigureSkatingDB")\n3. Обновите страницу');
                    }
                } catch (resetError) {
                    console.error('Ошибка сброса БД:', resetError);
                    alert('Не удалось сбросить базу данных. Очистите данные сайта в настройках браузера.');
                }
            }
        } else {
            alert(errorMessage + '\n\nПроверьте консоль браузера (F12) для подробностей.');
        }
    }
}

// Загрузка сохранённых результатов
function loadSavedResults() {
    const savedResultsDiv = document.getElementById('savedResults');
    
    if (savedResults.length === 0) {
        savedResultsDiv.innerHTML = '<p class="empty-message">Нет сохранённых результатов</p>';
        return;
    }
    
    let html = '';
    savedResults.forEach((result, index) => {
        const date = new Date(result.parsedAt).toLocaleString('ru-RU');
        html += `
            <div class="saved-item">
                <div class="saved-item-info">
                    <div class="saved-item-name">${result.competitionName}</div>
                    <div class="saved-item-meta">
                        Файл: ${result.fileName} | 
                        Фигуристов: ${result.skaters.length} | 
                        Дата: ${date}
                    </div>
                </div>
                <div class="saved-item-actions">
                    <button class="btn btn-secondary btn-small" onclick="loadSavedResult(${index})">Загрузить</button>
                    <button class="btn btn-danger btn-small" onclick="deleteSavedResult(${index})">Удалить</button>
                </div>
            </div>
        `;
    });
    
    savedResultsDiv.innerHTML = html;
}

// Загрузка сохранённого результата
function loadSavedResult(index) {
    if (index >= 0 && index < savedResults.length) {
        currentPdfData = savedResults[index];
        displayResults(currentPdfData);
        displayStatistics(currentPdfData);
        document.getElementById('resultsSection').style.display = 'block';
        document.getElementById('statsSection').style.display = 'block';
        document.getElementById('competitionName').value = currentPdfData.competitionName;
    }
}

// Удаление сохранённого результата
function deleteSavedResult(index) {
    if (confirm('Вы уверены, что хотите удалить этот результат?')) {
        savedResults.splice(index, 1);
        localStorage.setItem('figureSkatingResults', JSON.stringify(savedResults));
        loadSavedResults();
    }
}

// Очистка всех сохранённых результатов
function clearAllSaved() {
    if (confirm('Вы уверены, что хотите удалить все сохранённые результаты?')) {
        savedResults = [];
        localStorage.setItem('figureSkatingResults', JSON.stringify(savedResults));
        loadSavedResults();
    }
}

// Экспорт в JSON
async function exportToJSON() {
    if (!currentPdfData) {
        alert('Нет данных для экспорта');
        return;
    }
    
    const jsonContent = JSON.stringify(currentPdfData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `figure_skating_results_${Date.now()}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Экспорт всей базы данных
async function exportAllDatabase() {
    try {
        await initDatabase();
        const dbData = await exportDatabase();
        const jsonContent = JSON.stringify(dbData, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `figure_skating_database_${Date.now()}.json`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert('База данных экспортирована!');
    } catch (error) {
        console.error('Ошибка экспорта:', error);
        alert('Ошибка при экспорте базы данных');
    }
}

// Импорт из JSON
function importFromJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            // Если это данные соревнования
            if (data.skaters && Array.isArray(data.skaters)) {
                currentPdfData = data;
                await saveCurrentResults();
                displayResults(data);
                displayStatistics(data);
                document.getElementById('resultsSection').style.display = 'block';
                document.getElementById('statsSection').style.display = 'block';
                alert('Данные импортированы и сохранены!');
            } else if (data.competitions) {
                // Если это экспорт базы данных
                await importDatabase(data);
                loadCompetitionsFromDB();
                alert('База данных импортирована!');
            } else {
                alert('Неверный формат файла');
            }
        } catch (error) {
            console.error('Ошибка импорта:', error);
            alert('Ошибка при импорте файла');
        }
    };
    
    input.click();
}

// Загрузка соревнований из базы данных
async function loadCompetitionsFromDB() {
    try {
        await initDatabase();
        const competitions = await getAllCompetitions();
        
        // Обновляем список сохраненных результатов
        const savedResultsDiv = document.getElementById('savedResults');
        
        if (competitions.length === 0 && savedResults.length === 0) {
            savedResultsDiv.innerHTML = '<p class="empty-message">Нет сохранённых результатов</p>';
            return;
        }
        
        let html = '';
        
        // Показываем соревнования из IndexedDB
        for (const comp of competitions) {
            const date = new Date(comp.date).toLocaleString('ru-RU');
            html += `
                <div class="saved-item">
                    <div class="saved-item-info">
                        <div class="saved-item-name">${comp.name} [БД]</div>
                        <div class="saved-item-meta">
                            Файл: ${comp.fileName || 'N/A'} | 
                            Дата: ${date}
                        </div>
                    </div>
                    <div class="saved-item-actions">
                        <button class="btn btn-secondary btn-small" onclick="loadCompetitionFromDB(${comp.id})">Загрузить</button>
                        <button class="btn btn-danger btn-small" onclick="deleteCompetitionFromDB(${comp.id})">Удалить</button>
                    </div>
                </div>
            `;
        }
        
        // Показываем результаты из localStorage
        savedResults.forEach((result, index) => {
            const date = new Date(result.parsedAt).toLocaleString('ru-RU');
            html += `
                <div class="saved-item">
                    <div class="saved-item-info">
                        <div class="saved-item-name">${result.competitionName} [LocalStorage]</div>
                        <div class="saved-item-meta">
                            Файл: ${result.fileName} | 
                            Фигуристов: ${result.skaters.length} | 
                            Дата: ${date}
                        </div>
                    </div>
                    <div class="saved-item-actions">
                        <button class="btn btn-secondary btn-small" onclick="loadSavedResult(${index})">Загрузить</button>
                        <button class="btn btn-danger btn-small" onclick="deleteSavedResult(${index})">Удалить</button>
                    </div>
                </div>
            `;
        });
        
        savedResultsDiv.innerHTML = html;
    } catch (error) {
        console.error('Ошибка загрузки из БД:', error);
    }
}

// Загрузка соревнования из базы данных
async function loadCompetitionFromDB(competitionId) {
    try {
        await initDatabase();
        const competitionData = await getCompetitionData(competitionId);
        
        // Преобразуем в формат для отображения
        currentPdfData = {
            competitionName: competitionData.name,
            fileName: competitionData.fileName,
            firstLine: competitionData.firstLine,
            parsedAt: competitionData.date,
            skaters: competitionData.skaters
        };
        
        displayResults(currentPdfData);
        displayStatistics(currentPdfData);
        document.getElementById('resultsSection').style.display = 'block';
        document.getElementById('statsSection').style.display = 'block';
        document.getElementById('competitionName').value = currentPdfData.competitionName;
    } catch (error) {
        console.error('Ошибка загрузки соревнования:', error);
        alert('Ошибка при загрузке соревнования');
    }
}

// Удаление соревнования из базы данных
async function deleteCompetitionFromDB(competitionId) {
    if (confirm('Вы уверены, что хотите удалить это соревнование из базы данных?')) {
        try {
            await initDatabase();
            await deleteCompetition(competitionId);
            loadCompetitionsFromDB();
            alert('Соревнование удалено из базы данных');
        } catch (error) {
            console.error('Ошибка удаления:', error);
            alert('Ошибка при удалении соревнования');
        }
    }
}

// Поиск фигуристов
async function performSkaterSearch(query) {
    try {
        await initDatabase();
        const results = await searchSkaters(query);
        displaySearchResults(results);
    } catch (error) {
        console.error('Ошибка поиска:', error);
        hideSearchResults();
    }
}

// Отображение результатов поиска
function displaySearchResults(skaters) {
    const resultsDiv = document.getElementById('searchResults');
    
    if (!skaters || skaters.length === 0) {
        resultsDiv.innerHTML = '<div class="search-result-item">Фигуристы не найдены</div>';
        resultsDiv.classList.add('show');
        return;
    }
    
    let html = '';
    skaters.forEach(skater => {
        html += `
            <div class="search-result-item" onclick="selectSkater(${skater.id})">
                <div class="search-result-name">${skater.name}</div>
                <div class="search-result-meta">ID: ${skater.id}</div>
            </div>
        `;
    });
    
    resultsDiv.innerHTML = html;
    resultsDiv.classList.add('show');
}

// Скрытие результатов поиска
function hideSearchResults() {
    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.classList.remove('show');
}

// Выбор фигуриста из результатов поиска
async function selectSkater(skaterId) {
    try {
        await initDatabase();
        const skaterInfo = await getSkaterFullInfo(skaterId);
        displaySkaterInfo(skaterInfo);
        hideSearchResults();
        document.getElementById('skaterSearch').value = '';
    } catch (error) {
        console.error('Ошибка загрузки информации о фигуристе:', error);
        alert('Ошибка при загрузке информации о фигуристе');
    }
}

// Отображение информации о фигуристе
function displaySkaterInfo(skaterInfo) {
    const infoDiv = document.getElementById('skaterInfo');
    const { skater, competitions, statistics } = skaterInfo;
    
    let competitionsHtml = '';
    if (competitions.length === 0) {
        competitionsHtml = '<p>Нет данных о соревнованиях</p>';
    } else {
        competitions.forEach(comp => {
            const date = new Date(comp.competition.date).toLocaleDateString('ru-RU');
            const elementsCount = comp.elements.length;
            const componentsCount = comp.components.length;
            const totalElements = comp.elements.reduce((sum, e) => sum + (e.panelScore || 0), 0);
            const totalComponents = comp.components.reduce((sum, c) => 
                sum + ((c.averageScore || 0) * (c.factor || 0)), 0);
            const totalScore = totalElements + totalComponents - (comp.deductions || 0);
            
            competitionsHtml += `
                <div class="competition-item">
                    <div class="competition-item-header">
                        <div class="competition-item-name">${comp.competition.name}</div>
                        ${comp.place ? `<div class="competition-item-place">Место: ${comp.place}</div>` : ''}
                    </div>
                    <div class="competition-item-date">${date}</div>
                    <div class="competition-item-stats">
                        <div class="competition-stat">Элементов: <strong>${elementsCount}</strong></div>
                        <div class="competition-stat">Компонентов: <strong>${componentsCount}</strong></div>
                        <div class="competition-stat">Техническая: <strong>${totalElements.toFixed(2)}</strong></div>
                        <div class="competition-stat">Компоненты: <strong>${totalComponents.toFixed(2)}</strong></div>
                        <div class="competition-stat">Общий балл: <strong>${totalScore.toFixed(2)}</strong></div>
                    </div>
                </div>
            `;
        });
    }
    
    infoDiv.innerHTML = `
        <div class="skater-info-header">
            <div class="skater-info-name">${skater.name}</div>
            <button class="btn btn-secondary btn-small" onclick="closeSkaterInfo()">Закрыть</button>
        </div>
        
        <div class="skater-stats">
            <div class="skater-stat-card">
                <div class="skater-stat-label">Всего соревнований</div>
                <div class="skater-stat-value">${competitions.length}</div>
            </div>
            <div class="skater-stat-card">
                <div class="skater-stat-label">Всего элементов</div>
                <div class="skater-stat-value">${statistics.totalElements}</div>
            </div>
            <div class="skater-stat-card">
                <div class="skater-stat-label">Средний балл (элементы)</div>
                <div class="skater-stat-value">${statistics.averagePanelScore !== undefined && statistics.averagePanelScore !== null ? statistics.averagePanelScore.toFixed(2) : '0.00'}</div>
            </div>
            <div class="skater-stat-card">
                <div class="skater-stat-label">Средний балл (компоненты)</div>
                <div class="skater-stat-value">${statistics.averageComponentScore !== undefined && statistics.averageComponentScore !== null ? statistics.averageComponentScore.toFixed(2) : '0.00'}</div>
            </div>
        </div>
        
        <div class="skater-competitions-list">
            <h4 style="margin-bottom: 15px; color: #1e3c72;">Соревнования:</h4>
            ${competitionsHtml}
        </div>
    `;
    
    infoDiv.style.display = 'block';
    
    // Прокручиваем к информации о фигуристе
    infoDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Закрытие информации о фигуристе
function closeSkaterInfo() {
    const infoDiv = document.getElementById('skaterInfo');
    infoDiv.style.display = 'none';
}

// Переменные для сравнения фигуристов
let selectedSkater1 = null;
let selectedSkater2 = null;

// Инициализация поиска для сравнения
// Глобальные переменные для обработчиков поиска
let compareSearchTimeout1 = null;
let compareSearchTimeout2 = null;
let compareHandleSearch1 = null;
let compareHandleSearch2 = null;

// Функция для логирования в визуальную консоль
function debugLog(message, type = 'info') {
    const consoleContent = document.getElementById('debugConsoleContent');
    if (!consoleContent) return;
    
    const timestamp = new Date().toLocaleTimeString('ru-RU');
    const logEntry = document.createElement('div');
    logEntry.className = `debug-log debug-${type}`;
    logEntry.textContent = `[${timestamp}] ${message}`;
    consoleContent.appendChild(logEntry);
    consoleContent.scrollTop = consoleContent.scrollHeight;
    
    // Также логируем в обычную консоль
    if (type === 'error') {
        console.error(message);
    } else if (type === 'success') {
        console.log('✅', message);
    } else {
        console.log(message);
    }
}

// Очистка визуальной консоли
function clearDebugConsole() {
    const consoleContent = document.getElementById('debugConsoleContent');
    if (consoleContent) {
        consoleContent.innerHTML = '<div class="debug-log">Консоль очищена</div>';
    }
}

// Делаем функцию доступной глобально
window.clearDebugConsole = clearDebugConsole;

function initializeCompareSearch() {
    debugLog('🟢 === Инициализация поиска для сравнения ===', 'info');
    console.log('🟢 === Инициализация поиска для сравнения ===');
    const skater1Input = document.getElementById('skater1Search');
    const skater2Input = document.getElementById('skater2Search');
    
    debugLog(`Поиск элементов: skater1Input=${!!skater1Input}, skater2Input=${!!skater2Input}`, 'info');
    console.log('🟢 Поиск элементов:', {
        skater1Input: !!skater1Input,
        skater2Input: !!skater2Input,
        allInputs: document.querySelectorAll('input').length
    });
    
    if (!skater1Input || !skater2Input) {
        debugLog('❌ Поля поиска не найдены!', 'error');
        console.error('❌ Поля поиска не найдены!', { 
            skater1Input: !!skater1Input, 
            skater2Input: !!skater2Input,
            page: document.getElementById('comparePage') ? 'страница найдена' : 'страница НЕ найдена'
        });
        return;
    }
    
    debugLog('✅ Элементы найдены, проверяем базу данных...', 'success');
    // Проверяем наличие данных в базе при инициализации
    checkDatabaseForSkaters();
    
    // Удаляем старые обработчики, если есть
    if (compareHandleSearch1) {
        skater1Input.removeEventListener('input', compareHandleSearch1);
    }
    if (compareHandleSearch2) {
        skater2Input.removeEventListener('input', compareHandleSearch2);
    }
    
    // Создаем новые обработчики
    compareHandleSearch1 = (e) => {
        clearTimeout(compareSearchTimeout1);
        const query = e.target.value.trim();
        
        debugLog(`🔍 Поиск фигуриста 1: "${query}" (длина: ${query.length})`, 'info');
        console.log('🔍 Поиск фигуриста 1:', query, 'длина:', query.length);
        
        if (query.length < 3) {
            debugLog('⏸️ Запрос слишком короткий (минимум 3 символа), скрываем результаты', 'info');
            console.log('🔍 Запрос слишком короткий, скрываем результаты');
            hideCompareSearchResults('skater1Results');
            return;
        }
        
        debugLog('⏳ Запускаем поиск через 300мс...', 'info');
        console.log('🔍 Запускаем поиск через 300мс...');
        compareSearchTimeout1 = setTimeout(() => {
            debugLog(`🔎 Выполняем поиск для фигуриста 1: "${query}"`, 'info');
            console.log('🔍 Выполняем поиск для фигуриста 1:', query);
            performCompareSearch(query, 'skater1');
        }, 300);
    };
    
    compareHandleSearch2 = (e) => {
        clearTimeout(compareSearchTimeout2);
        const query = e.target.value.trim();
        
        debugLog(`🔍 Поиск фигуриста 2: "${query}" (длина: ${query.length})`, 'info');
        console.log('🔍 Поиск фигуриста 2:', query, 'длина:', query.length);
        
        if (query.length < 3) {
            debugLog('⏸️ Запрос слишком короткий (минимум 3 символа), скрываем результаты', 'info');
            console.log('🔍 Запрос слишком короткий, скрываем результаты');
            hideCompareSearchResults('skater2Results');
            return;
        }
        
        debugLog('⏳ Запускаем поиск через 300мс...', 'info');
        console.log('🔍 Запускаем поиск через 300мс...');
        compareSearchTimeout2 = setTimeout(() => {
            debugLog(`🔎 Выполняем поиск для фигуриста 2: "${query}"`, 'info');
            console.log('🔍 Выполняем поиск для фигуриста 2:', query);
            performCompareSearch(query, 'skater2');
        }, 300);
    };
    
    // Добавляем новые обработчики
    skater1Input.addEventListener('input', compareHandleSearch1);
    skater2Input.addEventListener('input', compareHandleSearch2);
    
    debugLog('✅ Обработчики событий привязаны к полям ввода', 'success');
    console.log('🟢 Обработчики событий привязаны к полям ввода');
    
    // Тестируем, что обработчики работают
    debugLog('Готов к поиску. Введите текст в поле поиска (минимум 3 символа)', 'info');
    console.log('🟢 Тест: попробуйте ввести текст в поле поиска');
    
    // Если в полях уже есть текст, выполняем поиск сразу
    if (skater1Input.value && skater1Input.value.trim().length >= 3) {
        console.log('🟢 В поле 1 уже есть текст:', skater1Input.value.trim(), '- выполняем поиск');
        setTimeout(() => {
            performCompareSearch(skater1Input.value.trim(), 'skater1');
        }, 500);
    }
    
    if (skater2Input.value && skater2Input.value.trim().length >= 3) {
        console.log('🟢 В поле 2 уже есть текст:', skater2Input.value.trim(), '- выполняем поиск');
        setTimeout(() => {
            performCompareSearch(skater2Input.value.trim(), 'skater2');
        }, 500);
    }
    
    console.log('=== Поиск для сравнения инициализирован ===');
    console.log('Элементы найдены:', {
        skater1Input: !!skater1Input,
        skater2Input: !!skater2Input
    });
    console.log('Текущие значения:', {
        value1: skater1Input.value,
        value2: skater2Input.value
    });
    console.log('Обработчики привязаны:', {
        handler1: !!compareHandleSearch1,
        handler2: !!compareHandleSearch2
    });
    
    // Тест: проверяем, что обработчики работают
    console.log('Тест: попробуйте ввести текст в поле поиска и посмотрите сообщения в консоли');
}

// Проверка наличия фигуристов в базе данных
async function checkDatabaseForSkaters() {
    try {
        debugLog('=== Начало проверки базы данных ===', 'info');
        console.log('=== Начало проверки базы данных ===');
        
        let initFunc = null;
        if (typeof initDatabase === 'function') {
            initFunc = initDatabase;
        } else if (typeof window.initDatabase === 'function') {
            initFunc = window.initDatabase;
        } else {
            console.error('Функция initDatabase не найдена!');
            return;
        }
        
        await initFunc();
        console.log('База данных инициализирована');
        
        let getAllFunction = null;
        if (typeof getAllSkaters === 'function') {
            getAllFunction = getAllSkaters;
        } else if (typeof window.getAllSkaters === 'function') {
            getAllFunction = window.getAllSkaters;
        } else {
            console.error('Функция getAllSkaters не найдена!');
            return;
        }
        
        const allSkaters = await getAllFunction();
        debugLog(`=== Результаты проверки базы данных ===`, 'info');
        debugLog(`Всего фигуристов: ${allSkaters.length}`, allSkaters.length > 0 ? 'success' : 'error');
        if (allSkaters.length > 0) {
            debugLog(`Имена: ${allSkaters.slice(0, 5).map(s => s.name).join(', ')}${allSkaters.length > 5 ? '...' : ''}`, 'info');
        }
        console.log('=== Результаты проверки базы данных ===');
        console.log('Всего фигуристов:', allSkaters.length);
        console.log('Имена фигуристов:', allSkaters.map(s => s.name));
        
        if (allSkaters.length === 0) {
            debugLog('⚠️ База данных пуста! Загрузите PDF файлы и сохраните результаты.', 'error');
            console.warn('⚠️ База данных пуста! Загрузите PDF файлы и сохраните результаты.');
        } else {
            debugLog(`✅ База данных содержит ${allSkaters.length} фигуристов`, 'success');
            console.log('✅ База данных содержит данные');
        }
    } catch (error) {
        debugLog(`❌ Ошибка проверки базы данных: ${error.message}`, 'error');
        console.error('❌ Ошибка проверки базы данных:', error);
    }
}

// Поиск для сравнения
async function performCompareSearch(query, skaterNumber) {
    try {
        debugLog(`🔎 === Начало поиска фигуриста ${skaterNumber}: "${query}" ===`, 'info');
        console.log(`🔎 === Начало поиска фигуриста ${skaterNumber}: "${query}" ===`);
        
        // Инициализируем базу данных
        if (typeof initDatabase === 'function') {
            await initDatabase();
        } else if (typeof window.initDatabase === 'function') {
            await window.initDatabase();
        } else {
            throw new Error('Функция initDatabase недоступна');
        }
        
        // Используем функцию поиска
        let searchFunction = null;
        if (typeof searchSkaters === 'function') {
            searchFunction = searchSkaters;
        } else if (typeof window.searchSkaters === 'function') {
            searchFunction = window.searchSkaters;
        } else {
            throw new Error('Функция searchSkaters недоступна. Проверьте, что database.js загружен.');
        }
        
        debugLog('🔍 Выполняем поиск в базе данных...', 'info');
        const results = await searchFunction(query);
        debugLog(`✅ Найдено фигуристов: ${results.length}`, results.length > 0 ? 'success' : 'info');
        console.log(`Найдено фигуристов: ${results.length}`, results);
        
        if (results.length === 0) {
            // Проверяем, есть ли вообще фигуристы в базе
            let allSkaters = [];
            if (typeof getAllSkaters === 'function') {
                allSkaters = await getAllSkaters();
            } else if (typeof window.getAllSkaters === 'function') {
                allSkaters = await window.getAllSkaters();
            }
            console.log(`Всего фигуристов в БД: ${allSkaters.length}`);
            
            if (allSkaters.length === 0) {
                const resultsDiv = document.getElementById(`${skaterNumber}Results`);
                if (resultsDiv) {
                    resultsDiv.innerHTML = '<div class="search-result-item" style="color: orange;">База данных пуста. Загрузите PDF файлы и сохраните результаты.</div>';
                    resultsDiv.classList.add('show');
                }
                return;
            }
        }
        
        displayCompareSearchResults(results, skaterNumber);
    } catch (error) {
        console.error('Ошибка поиска:', error);
        hideCompareSearchResults(`${skaterNumber}Results`);
        
        // Показываем сообщение об ошибке
        const resultsDiv = document.getElementById(`${skaterNumber}Results`);
        if (resultsDiv) {
            resultsDiv.innerHTML = `<div class="search-result-item" style="color: red;">Ошибка поиска: ${error.message}<br><small>Проверьте консоль (F12) для подробностей</small></div>`;
            resultsDiv.classList.add('show');
        }
    }
}

// Отображение результатов поиска для сравнения
function displayCompareSearchResults(skaters, skaterNumber) {
    debugLog(`Отображение результатов поиска для фигуриста ${skaterNumber}: ${skaters ? skaters.length : 0} результатов`, 'info');
    console.log('Отображение результатов поиска:', { skaters, skaterNumber });
    // skaterNumber уже содержит "skater1" или "skater2", поэтому просто добавляем "Results"
    const resultsId = `${skaterNumber}Results`;
    const resultsDiv = document.getElementById(resultsId);
    
    if (!resultsDiv) {
        debugLog(`❌ Элемент результатов не найден: ${resultsId}`, 'error');
        console.error('Элемент результатов не найден:', resultsId);
        return;
    }
    
    if (!skaters || skaters.length === 0) {
        debugLog('⏸️ Результаты пусты, показываем сообщение "Фигуристы не найдены"', 'info');
        console.log('Результаты пусты, показываем сообщение');
        resultsDiv.innerHTML = '<div class="search-result-item">Фигуристы не найдены</div>';
        resultsDiv.style.display = 'block';
        resultsDiv.classList.add('show');
        return;
    }
    
    debugLog(`✅ Отображаем ${skaters.length} результатов: ${skaters.map(s => s.name).join(', ')}`, 'success');
    console.log(`Отображаем ${skaters.length} результатов`);
    let html = '';
    skaters.forEach(skater => {
        html += `
            <div class="search-result-item" onclick="selectSkaterForCompare(${skater.id}, '${skaterNumber}')">
                <div class="search-result-name">${skater.name}</div>
                <div class="search-result-meta">ID: ${skater.id}</div>
            </div>
        `;
    });
    
    resultsDiv.innerHTML = html;
    resultsDiv.style.display = 'block';
    resultsDiv.classList.add('show');
    debugLog(`✅ Результаты отображены в элементе ${resultsId}`, 'success');
    console.log('Результаты отображены, элемент:', resultsDiv);
}

// Скрытие результатов поиска для сравнения
function hideCompareSearchResults(resultsId) {
    const resultsDiv = document.getElementById(resultsId);
    if (resultsDiv) {
        resultsDiv.classList.remove('show');
        resultsDiv.style.display = 'none';
    }
}

// Выбор фигуриста для сравнения
async function selectSkaterForCompare(skaterId, skaterNumber) {
    try {
        await initDatabase();
        const skaterInfo = await getSkaterFullInfo(skaterId);
        
        if (skaterNumber === 'skater1') {
            selectedSkater1 = skaterInfo;
            displaySelectedSkater(skaterInfo, 'skater1');
        } else {
            selectedSkater2 = skaterInfo;
            displaySelectedSkater(skaterInfo, 'skater2');
        }
        
        hideCompareSearchResults(`${skaterNumber}Results`);
        document.getElementById(`${skaterNumber}Search`).value = '';
        
        // Если оба фигуриста выбраны, показываем сравнение
        if (selectedSkater1 && selectedSkater2) {
            performComparison();
        }
    } catch (error) {
        console.error('Ошибка загрузки информации о фигуристе:', error);
        alert('Ошибка при загрузке информации о фигуристе');
    }
}

// Отображение выбранного фигуриста
function displaySelectedSkater(skaterInfo, skaterNumber) {
    const infoDiv = document.getElementById(`${skaterNumber}Info`);
    const { skater, statistics } = skaterInfo;
    
    infoDiv.innerHTML = `
        <div class="selected-skater-name">${skater.name}</div>
        <div class="selected-skater-stats">
            <div>Соревнований: <strong>${statistics.totalElements > 0 ? Math.round(statistics.totalElements / 7) : 0}</strong></div>
            <div>Элементов: <strong>${statistics.totalElements}</strong></div>
            <div>Средний балл: <strong>${statistics.averagePanelScore !== undefined && statistics.averagePanelScore !== null ? statistics.averagePanelScore.toFixed(2) : '0.00'}</strong></div>
            <div>Средний компонент: <strong>${statistics.averageComponentScore !== undefined && statistics.averageComponentScore !== null ? statistics.averageComponentScore.toFixed(2) : '0.00'}</strong></div>
        </div>
        <button class="btn btn-danger btn-small" style="margin-top: 10px;" onclick="clearSkaterSelection('${skaterNumber}')">Очистить</button>
    `;
    
    infoDiv.style.display = 'block';
}

// Очистка выбора фигуриста
function clearSkaterSelection(skaterNumber) {
    if (skaterNumber === 'skater1') {
        selectedSkater1 = null;
        document.getElementById('skater1Info').style.display = 'none';
        document.getElementById('skater1Search').value = '';
    } else {
        selectedSkater2 = null;
        document.getElementById('skater2Info').style.display = 'none';
        document.getElementById('skater2Search').value = '';
    }
    
    document.getElementById('compareResults').style.display = 'none';
}

// Выполнение сравнения
function performComparison() {
    if (!selectedSkater1 || !selectedSkater2) {
        return;
    }
    
    const resultsDiv = document.getElementById('compareResults');
    
    // Вычисляем статистику для сравнения
    const stats1 = calculateComparisonStats(selectedSkater1);
    const stats2 = calculateComparisonStats(selectedSkater2);
    
    // Создаем HTML для сравнения
    let html = `
        <div class="compare-header">
            <h3>${selectedSkater1.skater.name} vs ${selectedSkater2.skater.name}</h3>
        </div>
        
        <div class="compare-stats-grid">
            ${createCompareStatCard('Всего соревнований', stats1.competitionsCount, stats2.competitionsCount, 'competitions')}
            ${createCompareStatCard('Средний балл (элементы)', stats1.avgElementScore, stats2.avgElementScore, 'avgElement')}
            ${createCompareStatCard('Средний балл (компоненты)', stats1.avgComponentScore, stats2.avgComponentScore, 'avgComponent')}
            ${createCompareStatCard('Средняя сумма GOE', stats1.avgGOETotal, stats2.avgGOETotal, 'avgGOE')}
            ${createCompareStatCard('Соотношение техника/компоненты', stats1.avgTechToComponentRatio, stats2.avgTechToComponentRatio, 'techToComponent')}
            ${createCompareStatCard('Максимальный балл', stats1.maxScore, stats2.maxScore, 'maxScore')}
            ${createCompareStatCard('Минимальный балл', stats1.minScore, stats2.minScore, 'minScore')}
        </div>
        
        <h4 style="color: #1e3c72; margin: 30px 0 15px 0;">Сравнение по элементам</h4>
        ${createElementsComparisonTable(selectedSkater1, selectedSkater2)}
        
        <h4 style="color: #1e3c72; margin: 30px 0 15px 0;">Сравнение по компонентам</h4>
        ${createComponentsComparisonTable(selectedSkater1, selectedSkater2)}
    `;
    
    resultsDiv.innerHTML = html;
    resultsDiv.style.display = 'block';
    
    // Прокручиваем к результатам
    resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Вычисление статистики для сравнения
function calculateComparisonStats(skaterInfo) {
    const { competitions, statistics } = skaterInfo;
    
    // Собираем все оценки элементов
    const allElementScores = [];
    const allComponentScores = [];
    const allTotalScores = [];
    const allTechnicalTotals = []; // Общая техническая сумма (элементы) за каждое соревнование
    const allComponentTotals = []; // Общая сумма компонентов за каждое соревнование
    const allGOETotals = []; // Сумма GOE за каждое соревнование (техническая - базовая)
    
    competitions.forEach(comp => {
        let technicalTotal = 0; // Сумма всех элементов за соревнование (panelScore)
        let baseValueTotal = 0; // Сумма базовых стоимостей за соревнование
        
        comp.elements.forEach(el => {
            if (el.panelScore !== null && !isNaN(el.panelScore)) {
                allElementScores.push(el.panelScore);
                technicalTotal += el.panelScore;
            }
            if (el.baseValue !== null && !isNaN(el.baseValue)) {
                baseValueTotal += el.baseValue;
            }
        });
        
        // Сумма GOE = техническая сумма - базовая стоимость
        const goeTotal = technicalTotal - baseValueTotal;
        allGOETotals.push(goeTotal);
        
        let componentTotal = 0;
        comp.components.forEach(comp => {
            // Для среднего компонента используем averageScore (без фактора)
            if (comp.averageScore !== null && !isNaN(comp.averageScore) && comp.averageScore > 0) {
                allComponentScores.push(comp.averageScore);
            }
            // Для общей суммы компонентов используем averageScore * factor
            const score = (comp.averageScore || 0) * (comp.factor || 0);
            if (score > 0) {
                componentTotal += score;
            }
        });
        
        allTechnicalTotals.push(technicalTotal);
        allComponentTotals.push(componentTotal);
        
        // Общий балл за соревнование
        const elementsTotal = comp.elements.reduce((sum, e) => sum + (e.panelScore || 0), 0);
        const componentsTotal = comp.components.reduce((sum, c) => 
            sum + ((c.averageScore || 0) * (c.factor || 0)), 0);
        const total = elementsTotal + componentsTotal - (comp.deductions || 0);
        if (total > 0) {
            allTotalScores.push(total);
        }
    });
    
    // Средняя сумма GOE (рассчитывается для каждого соревнования отдельно)
    const avgGOETotal = allGOETotals.length > 0
        ? allGOETotals.reduce((a, b) => a + b, 0) / allGOETotals.length
        : 0;
    
    // Среднее соотношение технической суммы к компонентам
    const techToComponentRatios = [];
    for (let i = 0; i < allTechnicalTotals.length && i < allComponentTotals.length; i++) {
        if (allComponentTotals[i] > 0) {
            techToComponentRatios.push(allTechnicalTotals[i] / allComponentTotals[i]);
        }
    }
    const avgTechToComponentRatio = techToComponentRatios.length > 0
        ? techToComponentRatios.reduce((a, b) => a + b, 0) / techToComponentRatios.length
        : 0;
    
    return {
        competitionsCount: competitions.length,
        totalElements: statistics.totalElements,
        avgElementScore: allElementScores.length > 0 
            ? allElementScores.reduce((a, b) => a + b, 0) / allElementScores.length 
            : 0,
        avgComponentScore: allComponentScores.length > 0
            ? allComponentScores.reduce((a, b) => a + b, 0) / allComponentScores.length
            : 0, // Среднее из averageScore (без фактора), как в карточке фигуриста
        maxScore: allTotalScores.length > 0 ? Math.max(...allTotalScores) : 0,
        minScore: allTotalScores.length > 0 ? Math.min(...allTotalScores) : 0,
        avgGOETotal: avgGOETotal, // Средняя сумма GOE (техническая - базовая)
        avgTechToComponentRatio: avgTechToComponentRatio // Среднее соотношение технической суммы к компонентам
    };
}

// Создание карточки сравнения статистики
function createCompareStatCard(label, value1, value2, statType) {
    const diff = value1 - value2;
    const isEqual = Math.abs(diff) < 0.01;
    const winner1 = diff > 0.01;
    const winner2 = diff < -0.01;
    
    let diffClass = '';
    let diffText = '';
    if (isEqual) {
        diffClass = 'equal';
        diffText = 'Равны';
    } else if (winner1) {
        diffClass = 'positive';
        diffText = `+${diff.toFixed(2)}`;
    } else {
        diffClass = 'negative';
        diffText = diff.toFixed(2);
    }
    
    const skater1Name = selectedSkater1 ? selectedSkater1.skater.name : 'Фигурист 1';
    const skater2Name = selectedSkater2 ? selectedSkater2.skater.name : 'Фигурист 2';
    
    return `
        <div class="compare-stat-card ${winner1 ? 'winner' : ''}">
            <div class="compare-stat-label">${label}</div>
            <div class="compare-stat-values">
                <div class="compare-stat-value ${winner1 ? 'winner' : (winner2 ? 'loser' : '')}">
                    <div class="compare-stat-value-name">${skater1Name}</div>
                    <div class="compare-stat-value-number">${value1.toFixed(2)}</div>
                </div>
                <div class="compare-stat-value ${winner2 ? 'winner' : (winner1 ? 'loser' : '')}">
                    <div class="compare-stat-value-name">${skater2Name}</div>
                    <div class="compare-stat-value-number">${value2.toFixed(2)}</div>
                </div>
            </div>
            <div class="compare-diff ${diffClass}">Разница: ${diffText}</div>
        </div>
    `;
}

// Создание таблицы сравнения элементов
function createElementsComparisonTable(skater1, skater2) {
    // Собираем все уникальные элементы с детальной информацией и позициями
    const elements1 = {};
    const elements2 = {};
    
    // Собираем информацию о позициях элементов в программах
    const positions1 = {}; // {elementName: [позиции]}
    const positions2 = {}; // {elementName: [позиции]}
    
    skater1.competitions.forEach(comp => {
        comp.elements.forEach((el, index) => {
            const position = index + 1; // Позиция элемента в программе (1, 2, 3...)
            
            if (!elements1[el.name]) {
                elements1[el.name] = {
                    scores: [],
                    baseValues: [],
                    goes: [],
                    judgeScores: [],
                    count: 0,
                    positions: []
                };
                positions1[el.name] = [];
            }
            
            if (el.panelScore !== null && !isNaN(el.panelScore)) {
                elements1[el.name].scores.push(el.panelScore);
                elements1[el.name].count++;
                elements1[el.name].positions.push(position);
                positions1[el.name].push(position);
            }
            if (el.baseValue !== null && !isNaN(el.baseValue)) {
                elements1[el.name].baseValues.push(el.baseValue);
            }
            if (el.GOE !== null && !isNaN(el.GOE)) {
                elements1[el.name].goes.push(el.GOE);
            }
            if (el.judgeScores && Array.isArray(el.judgeScores)) {
                elements1[el.name].judgeScores.push(...el.judgeScores);
            }
        });
    });
    
    skater2.competitions.forEach(comp => {
        comp.elements.forEach((el, index) => {
            const position = index + 1; // Позиция элемента в программе (1, 2, 3...)
            
            if (!elements2[el.name]) {
                elements2[el.name] = {
                    scores: [],
                    baseValues: [],
                    goes: [],
                    judgeScores: [],
                    count: 0,
                    positions: []
                };
                positions2[el.name] = [];
            }
            
            if (el.panelScore !== null && !isNaN(el.panelScore)) {
                elements2[el.name].scores.push(el.panelScore);
                elements2[el.name].count++;
                elements2[el.name].positions.push(position);
                positions2[el.name].push(position);
            }
            if (el.baseValue !== null && !isNaN(el.baseValue)) {
                elements2[el.name].baseValues.push(el.baseValue);
            }
            if (el.GOE !== null && !isNaN(el.GOE)) {
                elements2[el.name].goes.push(el.GOE);
            }
            if (el.judgeScores && Array.isArray(el.judgeScores)) {
                elements2[el.name].judgeScores.push(...el.judgeScores);
            }
        });
    });
    
    const allElements = new Set([...Object.keys(elements1), ...Object.keys(elements2)]);
    const skater1Name = skater1.skater.name;
    const skater2Name = skater2.skater.name;
    
    let html = `
        <table class="compare-table">
            <thead>
                <tr>
                    <th>Элемент</th>
                    <th>${skater1Name}</th>
                    <th>${skater2Name}</th>
                    <th>Разница</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    // Сначала создаем таблицу сравнения по позициям (1-й элемент vs 1-й элемент и т.д.)
    html += `
        <tr style="background: #e3f2fd; font-weight: bold;">
            <td colspan="4" style="text-align: center; padding: 15px;">
                Сравнение элементов по позициям в программе
            </td>
        </tr>
    `;
    
    // Находим максимальное количество элементов в программе
    let maxElements = 0;
    skater1.competitions.forEach(comp => {
        if (comp.elements.length > maxElements) maxElements = comp.elements.length;
    });
    skater2.competitions.forEach(comp => {
        if (comp.elements.length > maxElements) maxElements = comp.elements.length;
    });
    
    // Сравниваем элементы по позициям
    for (let pos = 1; pos <= maxElements; pos++) {
        // Находим элементы, которые выполнялись на позиции pos
        const elementsAtPos1 = [];
        const elementsAtPos2 = [];
        
        skater1.competitions.forEach(comp => {
            if (comp.elements[pos - 1]) {
                const el = comp.elements[pos - 1];
                if (el.panelScore !== null && !isNaN(el.panelScore)) {
                    elementsAtPos1.push({
                        name: el.name,
                        score: el.panelScore,
                        baseValue: el.baseValue,
                        GOE: el.GOE,
                        judgeScores: el.judgeScores || []
                    });
                }
            }
        });
        
        skater2.competitions.forEach(comp => {
            if (comp.elements[pos - 1]) {
                const el = comp.elements[pos - 1];
                if (el.panelScore !== null && !isNaN(el.panelScore)) {
                    elementsAtPos2.push({
                        name: el.name,
                        score: el.panelScore,
                        baseValue: el.baseValue,
                        GOE: el.GOE,
                        judgeScores: el.judgeScores || []
                    });
                }
            }
        });
        
        if (elementsAtPos1.length > 0 || elementsAtPos2.length > 0) {
            // Средние значения для этой позиции
            const avgScore1 = elementsAtPos1.length > 0 
                ? elementsAtPos1.reduce((sum, e) => sum + e.score, 0) / elementsAtPos1.length 
                : 0;
            const avgScore2 = elementsAtPos2.length > 0 
                ? elementsAtPos2.reduce((sum, e) => sum + e.score, 0) / elementsAtPos2.length 
                : 0;
            
            // Находим наиболее частый элемент на этой позиции
            let mostCommon1 = null;
            if (elementsAtPos1.length > 0) {
                const elementCount1 = {};
                elementsAtPos1.forEach(e => {
                    elementCount1[e.name] = (elementCount1[e.name] || 0) + 1;
                });
                const keys1 = Object.keys(elementCount1);
                if (keys1.length > 0) {
                    mostCommon1 = keys1.reduce((a, b) => 
                        elementCount1[a] > elementCount1[b] ? a : b);
                }
            }
            
            let mostCommon2 = null;
            if (elementsAtPos2.length > 0) {
                const elementCount2 = {};
                elementsAtPos2.forEach(e => {
                    elementCount2[e.name] = (elementCount2[e.name] || 0) + 1;
                });
                const keys2 = Object.keys(elementCount2);
                if (keys2.length > 0) {
                    mostCommon2 = keys2.reduce((a, b) => 
                        elementCount2[a] > elementCount2[b] ? a : b);
                }
            }
            
            const diff = avgScore1 - avgScore2;
            let rowClass = '';
            if (Math.abs(diff) < 0.01) {
                rowClass = 'equal';
            } else if (diff > 0.01) {
                rowClass = 'better';
            } else {
                rowClass = 'worse';
            }
            
            const info1 = elementsAtPos1.length > 0 ? `
                <div style="font-size: 0.9em; line-height: 1.6;">
                    <div><strong>${mostCommon1 || 'Разные'}</strong></div>
                    <div><strong>Средняя оценка:</strong> ${avgScore1.toFixed(2)}</div>
                    <div><strong>Выполнений:</strong> ${elementsAtPos1.length}</div>
                </div>
            ` : '<div style="color: #999;">Не выполнялся</div>';
            
            const info2 = elementsAtPos2.length > 0 ? `
                <div style="font-size: 0.9em; line-height: 1.6;">
                    <div><strong>${mostCommon2 || 'Разные'}</strong></div>
                    <div><strong>Средняя оценка:</strong> ${avgScore2.toFixed(2)}</div>
                    <div><strong>Выполнений:</strong> ${elementsAtPos2.length}</div>
                </div>
            ` : '<div style="color: #999;">Не выполнялся</div>';
            
            html += `
                <tr class="${rowClass}">
                    <td><strong>Позиция ${pos}</strong></td>
                    <td>${info1}</td>
                    <td>${info2}</td>
                    <td style="font-weight: bold; font-size: 1.1em;">
                        ${diff !== 0 ? (diff > 0 ? '<span style="color: #28a745;">+' : '<span style="color: #dc3545;">') + diff.toFixed(2) + '</span>' : '<span style="color: #6c757d;">0.00</span>'}
                    </td>
                </tr>
            `;
        }
    }
    
    // Теперь создаем таблицу сравнения по типам элементов
    html += `
        <tr style="background: #fff3e0; font-weight: bold;">
            <td colspan="4" style="text-align: center; padding: 15px;">
                Сравнение элементов по типам
            </td>
        </tr>
    `;
    
    Array.from(allElements).sort().forEach(elementName => {
        const data1 = elements1[elementName] || { scores: [], baseValues: [], goes: [], judgeScores: [], count: 0, positions: [] };
        const data2 = elements2[elementName] || { scores: [], baseValues: [], goes: [], judgeScores: [], count: 0, positions: [] };
        
        // Средние значения
        const avg1 = data1.scores.length > 0 ? data1.scores.reduce((a, b) => a + b, 0) / data1.scores.length : 0;
        const avg2 = data2.scores.length > 0 ? data2.scores.reduce((a, b) => a + b, 0) / data2.scores.length : 0;
        const diff = avg1 - avg2;
        
        // Минимальные и максимальные значения
        const min1 = data1.scores.length > 0 ? Math.min(...data1.scores) : 0;
        const max1 = data1.scores.length > 0 ? Math.max(...data1.scores) : 0;
        const min2 = data2.scores.length > 0 ? Math.min(...data2.scores) : 0;
        const max2 = data2.scores.length > 0 ? Math.max(...data2.scores) : 0;
        
        // Средняя базовая стоимость
        const avgBase1 = data1.baseValues.length > 0 ? data1.baseValues.reduce((a, b) => a + b, 0) / data1.baseValues.length : 0;
        const avgBase2 = data2.baseValues.length > 0 ? data2.baseValues.reduce((a, b) => a + b, 0) / data2.baseValues.length : 0;
        
        // Средний GOE
        const avgGOE1 = data1.goes.length > 0 ? data1.goes.reduce((a, b) => a + b, 0) / data1.goes.length : 0;
        const avgGOE2 = data2.goes.length > 0 ? data2.goes.reduce((a, b) => a + b, 0) / data2.goes.length : 0;
        
        // Средняя оценка судей
        const avgJudge1 = data1.judgeScores.length > 0 ? data1.judgeScores.reduce((a, b) => a + b, 0) / data1.judgeScores.length : 0;
        const avgJudge2 = data2.judgeScores.length > 0 ? data2.judgeScores.reduce((a, b) => a + b, 0) / data2.judgeScores.length : 0;
        
        let rowClass = '';
        if (Math.abs(diff) < 0.01) {
            rowClass = 'equal';
        } else if (diff > 0.01) {
            rowClass = 'better';
        } else {
            rowClass = 'worse';
        }
        
        // Определяем наиболее частые позиции
        const posCount1 = {};
        if (data1.positions && data1.positions.length > 0) {
            data1.positions.forEach(pos => {
                posCount1[pos] = (posCount1[pos] || 0) + 1;
            });
        }
        const mostCommonPos1 = Object.keys(posCount1).length > 0 
            ? Object.keys(posCount1).reduce((a, b) => posCount1[a] > posCount1[b] ? a : b)
            : null;
        const posText1 = mostCommonPos1 
            ? `(чаще всего ${mostCommonPos1}-${mostCommonPos1 === '1' ? 'й' : mostCommonPos1 === '2' ? 'й' : mostCommonPos1 === '3' ? 'й' : 'й'})`
            : '';
        
        const posCount2 = {};
        if (data2.positions && data2.positions.length > 0) {
            data2.positions.forEach(pos => {
                posCount2[pos] = (posCount2[pos] || 0) + 1;
            });
        }
        const mostCommonPos2 = Object.keys(posCount2).length > 0 
            ? Object.keys(posCount2).reduce((a, b) => posCount2[a] > posCount2[b] ? a : b)
            : null;
        const posText2 = mostCommonPos2 
            ? `(чаще всего ${mostCommonPos2}-${mostCommonPos2 === '1' ? 'й' : mostCommonPos2 === '2' ? 'й' : mostCommonPos2 === '3' ? 'й' : 'й'})`
            : '';
        
        // Формируем детальную информацию для каждого фигуриста
        const info1 = data1.count > 0 ? `
            <div style="font-size: 0.9em; line-height: 1.6;">
                <div><strong>Средняя оценка:</strong> ${avg1.toFixed(2)}</div>
                <div><strong>Выполнений:</strong> ${data1.count} ${posText1}</div>
                ${avgBase1 > 0 ? `<div><strong>Базовая:</strong> ${avgBase1.toFixed(2)}</div>` : ''}
                ${avgGOE1 !== 0 ? `<div><strong>GOE:</strong> ${avgGOE1 > 0 ? '+' : ''}${avgGOE1.toFixed(2)}</div>` : ''}
                ${data1.scores.length > 1 ? `<div><strong>Диапазон:</strong> ${min1.toFixed(2)} - ${max1.toFixed(2)}</div>` : ''}
                ${avgJudge1 !== 0 ? `<div><strong>Средняя оценка судей:</strong> ${avgJudge1 > 0 ? '+' : ''}${avgJudge1.toFixed(2)}</div>` : ''}
            </div>
        ` : '<div style="color: #999;">Не выполнялся</div>';
        
        const info2 = data2.count > 0 ? `
            <div style="font-size: 0.9em; line-height: 1.6;">
                <div><strong>Средняя оценка:</strong> ${avg2.toFixed(2)}</div>
                <div><strong>Выполнений:</strong> ${data2.count} ${posText2}</div>
                ${avgBase2 > 0 ? `<div><strong>Базовая:</strong> ${avgBase2.toFixed(2)}</div>` : ''}
                ${avgGOE2 !== 0 ? `<div><strong>GOE:</strong> ${avgGOE2 > 0 ? '+' : ''}${avgGOE2.toFixed(2)}</div>` : ''}
                ${data2.scores.length > 1 ? `<div><strong>Диапазон:</strong> ${min2.toFixed(2)} - ${max2.toFixed(2)}</div>` : ''}
                ${avgJudge2 !== 0 ? `<div><strong>Средняя оценка судей:</strong> ${avgJudge2 > 0 ? '+' : ''}${avgJudge2.toFixed(2)}</div>` : ''}
            </div>
        ` : '<div style="color: #999;">Не выполнялся</div>';
        
        html += `
            <tr class="${rowClass}">
                <td><strong>${elementName}</strong></td>
                <td>${info1}</td>
                <td>${info2}</td>
                <td style="font-weight: bold; font-size: 1.1em;">
                    ${diff !== 0 ? (diff > 0 ? '<span style="color: #28a745;">+' : '<span style="color: #dc3545;">') + diff.toFixed(2) + '</span>' : '<span style="color: #6c757d;">0.00</span>'}
                </td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    return html;
}

// Создание таблицы сравнения компонентов
function createComponentsComparisonTable(skater1, skater2) {
    const components1 = {};
    const components2 = {};
    
    skater1.competitions.forEach(comp => {
        comp.components.forEach(comp => {
            if (!components1[comp.name]) {
                components1[comp.name] = [];
            }
            const score = (comp.averageScore || 0) * (comp.factor || 0);
            if (score > 0) {
                components1[comp.name].push(score);
            }
        });
    });
    
    skater2.competitions.forEach(comp => {
        comp.components.forEach(comp => {
            if (!components2[comp.name]) {
                components2[comp.name] = [];
            }
            const score = (comp.averageScore || 0) * (comp.factor || 0);
            if (score > 0) {
                components2[comp.name].push(score);
            }
        });
    });
    
    const allComponents = new Set([...Object.keys(components1), ...Object.keys(components2)]);
    const skater1Name = skater1.skater.name;
    const skater2Name = skater2.skater.name;
    
    let html = `
        <table class="compare-table">
            <thead>
                <tr>
                    <th>Компонент</th>
                    <th>${skater1Name}</th>
                    <th>${skater2Name}</th>
                    <th>Разница</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    Array.from(allComponents).sort().forEach(componentName => {
        const scores1 = components1[componentName] || [];
        const scores2 = components2[componentName] || [];
        const avg1 = scores1.length > 0 ? scores1.reduce((a, b) => a + b, 0) / scores1.length : 0;
        const avg2 = scores2.length > 0 ? scores2.reduce((a, b) => a + b, 0) / scores2.length : 0;
        const diff = avg1 - avg2;
        
        let rowClass = '';
        if (Math.abs(diff) < 0.01) {
            rowClass = 'equal';
        } else if (diff > 0.01) {
            rowClass = 'better';
        } else {
            rowClass = 'worse';
        }
        
        html += `
            <tr class="${rowClass}">
                <td><strong>${componentName}</strong></td>
                <td>${avg1 > 0 ? avg1.toFixed(2) : '-'} ${scores1.length > 0 ? `(${scores1.length})` : ''}</td>
                <td>${avg2 > 0 ? avg2.toFixed(2) : '-'} ${scores2.length > 0 ? `(${scores2.length})` : ''}</td>
                <td>${diff !== 0 ? (diff > 0 ? '+' : '') + diff.toFixed(2) : '0.00'}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    return html;
}

// Сброс базы данных (обертка для вызова функции из database.js)
async function resetDatabaseWrapper() {
    if (confirm('Вы уверены, что хотите сбросить базу данных? Все сохраненные данные будут удалены!')) {
        try {
            if (typeof window.resetDatabase === 'function') {
                await window.resetDatabase();
                alert('База данных успешно сброшена. Обновите страницу.');
                location.reload();
            } else {
                // Прямой вызов через indexedDB
                await new Promise((resolve, reject) => {
                    const deleteRequest = indexedDB.deleteDatabase('FigureSkatingDB');
                    deleteRequest.onsuccess = () => {
                        alert('База данных удалена. Обновите страницу для пересоздания.');
                        resolve();
                    };
                    deleteRequest.onerror = () => reject(deleteRequest.error);
                    deleteRequest.onblocked = () => {
                        alert('Удаление заблокировано. Закройте все вкладки с этим сайтом и попробуйте снова.');
                        reject(new Error('Удаление заблокировано'));
                    };
                });
                location.reload();
            }
        } catch (error) {
            console.error('Ошибка сброса БД:', error);
            alert('Ошибка при сбросе базы данных: ' + error.message);
        }
    }
}

// Функция для загрузки результатов ISU
async function loadIsuResults() {
    const isuUrlInput = document.getElementById('isuUrl');
    const isuResultsInfo = document.getElementById('isuResultsInfo');
    const isuResultsContent = document.getElementById('isuResultsContent');
    const loadBtn = document.getElementById('loadIsuResultsBtn');
    
    if (!isuUrlInput || !isuResultsInfo || !isuResultsContent) {
        return;
    }
    
    const url = isuUrlInput.value.trim();
    if (!url) {
        alert('Пожалуйста, введите ссылку на результаты ISU');
        return;
    }
    
    // Проверяем, что это ссылка на isuresults.com
    if (!url.includes('isuresults.com')) {
        alert('Пожалуйста, введите ссылку на результаты с сайта isuresults.com');
        return;
    }
    
    try {
        loadBtn.disabled = true;
        loadBtn.textContent = 'Загрузка...';
        isuResultsInfo.style.display = 'block';
        isuResultsContent.innerHTML = '<div style="color: #666;">Загрузка результатов...</div>';
        
        // Используем CORS proxy для обхода ограничений CORS
        // Можно использовать публичные прокси или попросить пользователя использовать расширение браузера
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        
        const response = await fetch(proxyUrl);
        const data = await response.json();
        
        if (!data.contents) {
            throw new Error('Не удалось загрузить страницу');
        }
        
        // Парсим HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(data.contents, 'text/html');
        
        // Ищем таблицу с результатами
        // На странице ISU результаты обычно в таблице с классом или в определенной структуре
        const skaters = [];
        
        // Пробуем найти таблицу с результатами
        // Формат: Pl. Name Nation TSS= TES+ PCS+ CO PR SK Ded.- StN.
        const tables = doc.querySelectorAll('table');
        
        for (const table of tables) {
            const rows = table.querySelectorAll('tr');
            
            for (const row of rows) {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 3) {
                    // Первая ячейка - место (Pl.)
                    const place = cells[0].textContent.trim();
                    // Вторая ячейка - имя (может быть ссылкой)
                    const nameCell = cells[1];
                    const nameLink = nameCell.querySelector('a');
                    const name = nameLink ? nameLink.textContent.trim() : nameCell.textContent.trim();
                    // Третья ячейка - нация
                    const nation = cells[2].textContent.trim();
                    
                    // Проверяем, что это валидная строка (место - число, имя не пустое)
                    if (place && !isNaN(parseInt(place)) && name && name.length > 0) {
                        skaters.push({
                            place: parseInt(place),
                            name: name,
                            nation: nation
                        });
                    }
                }
            }
        }
        
        // Если не нашли в таблице, пробуем другой формат
        if (skaters.length === 0) {
            // Ищем все ссылки на биографии фигуристов
            const bioLinks = doc.querySelectorAll('a[href*="/bios/isufs"]');
            bioLinks.forEach((link, index) => {
                const name = link.textContent.trim();
                if (name && name.length > 0) {
                    // Пытаемся найти место и нацию в родительской строке
                    const row = link.closest('tr');
                    if (row) {
                        const cells = row.querySelectorAll('td');
                        if (cells.length >= 3) {
                            const place = cells[0].textContent.trim();
                            const nation = cells[2] ? cells[2].textContent.trim() : '';
                            if (place && !isNaN(parseInt(place))) {
                                skaters.push({
                                    place: parseInt(place),
                                    name: name,
                                    nation: nation
                                });
                            }
                        }
                    }
                }
            });
        }
        
        // Сортируем по месту
        skaters.sort((a, b) => a.place - b.place);
        
        // Получаем количество распознанных фигуристов из PDF
        const parsedSkatersCount = results && results.skaters ? results.skaters.length : 0;
        
        // Формируем HTML для отображения
        let html = `<div style="margin-bottom: 10px;"><strong>Найдено фигуристов на сайте ISU: ${skaters.length}</strong></div>`;
        
        if (parsedSkatersCount > 0) {
            html += `<div style="margin-bottom: 10px;"><strong>Распознано из PDF: ${parsedSkatersCount}</strong></div>`;
            
            if (skaters.length !== parsedSkatersCount) {
                html += `<div style="color: #dc3545; margin-bottom: 10px;">
                    ⚠️ Количество не совпадает! Разница: ${Math.abs(skaters.length - parsedSkatersCount)}
                </div>`;
            } else {
                html += `<div style="color: #28a745; margin-bottom: 10px;">
                    ✓ Количество совпадает!
                </div>`;
            }
        }
        
        if (skaters.length > 0) {
            html += `<div style="margin-top: 15px;"><strong>Список фигуристов:</strong></div>`;
            html += `<div style="max-height: 300px; overflow-y: auto; margin-top: 10px;">`;
            html += `<table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">`;
            html += `<tr style="background: #f0f0f0;"><th style="padding: 5px; text-align: left; border: 1px solid #ddd;">Место</th><th style="padding: 5px; text-align: left; border: 1px solid #ddd;">Имя</th><th style="padding: 5px; text-align: left; border: 1px solid #ddd;">Нация</th></tr>`;
            
            skaters.forEach(skater => {
                // Проверяем, есть ли этот фигурист в распознанных
                const isFound = results && results.skaters ? 
                    results.skaters.some(s => s.name.toLowerCase().includes(skater.name.toLowerCase()) || 
                                             skater.name.toLowerCase().includes(s.name.toLowerCase())) : false;
                
                const rowStyle = isFound ? 'background: #d4edda;' : 'background: #fff;';
                html += `<tr style="${rowStyle}">
                    <td style="padding: 5px; border: 1px solid #ddd;">${skater.place}</td>
                    <td style="padding: 5px; border: 1px solid #ddd;">${skater.name}</td>
                    <td style="padding: 5px; border: 1px solid #ddd;">${skater.nation}</td>
                </tr>`;
            });
            
            html += `</table></div>`;
        } else {
            html += `<div style="color: #dc3545; margin-top: 10px;">Не удалось найти фигуристов на странице. Возможно, формат страницы изменился.</div>`;
        }
        
        isuResultsContent.innerHTML = html;
        
    } catch (error) {
        console.error('Ошибка загрузки результатов ISU:', error);
        isuResultsContent.innerHTML = `<div style="color: #dc3545;">
            Ошибка загрузки результатов: ${error.message}<br>
            <small style="color: #666;">Возможно, проблема с CORS. Попробуйте использовать расширение браузера для обхода CORS или скопируйте HTML страницы вручную.</small>
        </div>`;
    } finally {
        loadBtn.disabled = false;
        loadBtn.textContent = 'Загрузить';
    }
}

// Делаем функции сравнения доступными глобально
if (typeof window !== 'undefined') {
    window.selectSkaterForCompare = selectSkaterForCompare;
    window.clearSkaterSelection = clearSkaterSelection;
    window.initializeCompareSearch = initializeCompareSearch;
}

