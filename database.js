// Модуль для работы с базой данных IndexedDB
// Хранит данные о фигуристах, соревнованиях и оценках

const DB_NAME = 'FigureSkatingDB';
const DB_VERSION = 2; // Увеличена версия для добавления индекса 'name' в skaters

// Структура базы данных:
// - competitions: соревнования
// - skaters: фигуристы
// - scores: оценки (элементы и компоненты)
// - competitions_skaters: связь соревнований и фигуристов

let db = null;

// Инициализация базы данных
async function initDatabase() {
    return new Promise((resolve, reject) => {
        // Проверяем поддержку IndexedDB
        if (!window.indexedDB) {
            reject(new Error('IndexedDB не поддерживается в этом браузере'));
            return;
        }
        
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = (event) => {
            const error = request.error || event.target.error;
            console.error('Ошибка открытия IndexedDB:', error);
            
            // Если ошибка связана с версией, пытаемся удалить старую БД
            if (error.name === 'VersionError' || error.message.includes('version')) {
                console.warn('Проблема с версией БД. Пытаемся удалить старую БД...');
                indexedDB.deleteDatabase(DB_NAME).onsuccess = () => {
                    // Пытаемся открыть снова
                    const retryRequest = indexedDB.open(DB_NAME, DB_VERSION);
                    retryRequest.onsuccess = () => {
                        db = retryRequest.result;
                        resolve(db);
                    };
                    retryRequest.onerror = () => reject(retryRequest.error);
                    retryRequest.onupgradeneeded = (e) => createDatabaseSchema(e.target.result);
                };
            } else if (error.name === 'InvalidStateError' || error.message.includes('backing store')) {
                // Проблема с хранилищем - пытаемся удалить и пересоздать
                console.warn('Проблема с хранилищем БД. Пытаемся удалить и пересоздать...');
                indexedDB.deleteDatabase(DB_NAME).onsuccess = () => {
                    setTimeout(() => {
                        const retryRequest = indexedDB.open(DB_NAME, DB_VERSION);
                        retryRequest.onsuccess = () => {
                            db = retryRequest.result;
                            resolve(db);
                        };
                        retryRequest.onerror = () => reject(retryRequest.error);
                        retryRequest.onupgradeneeded = (e) => createDatabaseSchema(e.target.result);
                    }, 100);
                };
                indexedDB.deleteDatabase(DB_NAME).onerror = () => {
                    reject(new Error('Не удалось сбросить базу данных. Попробуйте очистить данные сайта в настройках браузера.'));
                };
            } else {
                reject(error);
            }
        };
        
        request.onsuccess = () => {
            db = request.result;
            
            // Обработка закрытия БД
            db.onerror = (event) => {
                console.error('Ошибка БД:', event.target.error);
            };
            
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            createDatabaseSchema(event.target.result);
        };
    });
}

// Создание схемы базы данных
function createDatabaseSchema(db) {
    try {
        // Хранилище соревнований
        if (!db.objectStoreNames.contains('competitions')) {
                const competitionStore = db.createObjectStore('competitions', { keyPath: 'id', autoIncrement: true });
                competitionStore.createIndex('name', 'name', { unique: false });
                competitionStore.createIndex('date', 'date', { unique: false });
            }
            
            // Хранилище фигуристов
            if (!db.objectStoreNames.contains('skaters')) {
                const skaterStore = db.createObjectStore('skaters', { keyPath: 'id', autoIncrement: true });
                skaterStore.createIndex('name', 'name', { unique: false });
            } else {
                // Если хранилище уже существует, проверяем наличие индекса
                const skaterStore = db.transaction(['skaters'], 'readonly').objectStore('skaters');
                if (!skaterStore.indexNames.contains('name')) {
                    // Индекс нужно добавить при следующем обновлении версии БД
                    console.warn('Индекс "name" отсутствует в хранилище "skaters". Может потребоваться обновление версии БД.');
                }
            }
            
            // Хранилище оценок (элементы)
            if (!db.objectStoreNames.contains('elements')) {
                const elementStore = db.createObjectStore('elements', { keyPath: 'id', autoIncrement: true });
                elementStore.createIndex('skaterId', 'skaterId', { unique: false });
                elementStore.createIndex('competitionId', 'competitionId', { unique: false });
            }
            
            // Хранилище компонентов
            if (!db.objectStoreNames.contains('components')) {
                const componentStore = db.createObjectStore('components', { keyPath: 'id', autoIncrement: true });
                componentStore.createIndex('skaterId', 'skaterId', { unique: false });
                componentStore.createIndex('competitionId', 'competitionId', { unique: false });
            }
            
            // Хранилище связей соревнований и фигуристов
            if (!db.objectStoreNames.contains('competition_skaters')) {
                const csStore = db.createObjectStore('competition_skaters', { keyPath: 'id', autoIncrement: true });
                csStore.createIndex('competitionId', 'competitionId', { unique: false });
                csStore.createIndex('skaterId', 'skaterId', { unique: false });
                csStore.createIndex('place', 'place', { unique: false });
            }
    } catch (error) {
        console.error('Ошибка создания схемы БД:', error);
        throw error;
    }
}

// Сохранение результатов парсинга в базу данных
async function saveCompetitionData(competitionData) {
    if (!db) await initDatabase();
    
    const transaction = db.transaction(['competitions', 'skaters', 'elements', 'components', 'competition_skaters'], 'readwrite');
    
    try {
        // 1. Сохраняем соревнование
        const competition = {
            name: competitionData.competitionName || 'Неизвестное соревнование',
            date: competitionData.parsedAt || new Date().toISOString(),
            fileName: competitionData.fileName || '',
            firstLine: competitionData.firstLine || '',
            createdAt: new Date().toISOString()
        };
        
        const competitionId = await new Promise((resolve, reject) => {
            const request = transaction.objectStore('competitions').add(competition);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        
        // 2. Сохраняем фигуристов и их оценки
        const skaterIds = [];
        
        for (const skaterData of competitionData.skaters || []) {
            // Находим или создаем фигуриста
            let skaterId = await findOrCreateSkater(skaterData.name, transaction);
            skaterIds.push({ skaterId, place: skaterData.place });
            
            // Сохраняем элементы
            if (skaterData.scores?.elements) {
                for (const element of skaterData.scores.elements) {
                    await new Promise((resolve, reject) => {
                        const elementRecord = {
                            skaterId: skaterId,
                            competitionId: competitionId,
                            name: element.name,
                            baseValue: element.baseValue,
                            goe: element.goe,
                            panelScore: element.panelScore,
                            judgeScores: element.judgeScores || [],
                            createdAt: new Date().toISOString()
                        };
                        const request = transaction.objectStore('elements').add(elementRecord);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    });
                }
            }
            
            // Сохраняем компоненты
            if (skaterData.scores?.programComponents) {
                for (const component of skaterData.scores.programComponents) {
                    await new Promise((resolve, reject) => {
                        const componentRecord = {
                            skaterId: skaterId,
                            competitionId: competitionId,
                            name: component.name,
                            factor: component.factor,
                            averageScore: component.averageScore,
                            judgeScores: component.judgeScores || [],
                            createdAt: new Date().toISOString()
                        };
                        const request = transaction.objectStore('components').add(componentRecord);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    });
                }
            }
            
            // Сохраняем связь соревнования и фигуриста
            await new Promise((resolve, reject) => {
                const csRecord = {
                    competitionId: competitionId,
                    skaterId: skaterId,
                    place: skaterData.place,
                    deductions: skaterData.scores?.deductions || 0,
                    createdAt: new Date().toISOString()
                };
                const request = transaction.objectStore('competition_skaters').add(csRecord);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
        
        await new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve(competitionId);
            transaction.onerror = () => reject(transaction.error);
        });
        
        return { success: true, competitionId };
    } catch (error) {
        console.error('Ошибка сохранения в базу данных:', error);
        throw error;
    }
}

// Поиск или создание фигуриста
async function findOrCreateSkater(name, transaction) {
    return new Promise((resolve, reject) => {
        try {
            const skaterStore = transaction.objectStore('skaters');
            
            // Пытаемся использовать индекс, если он есть
            let request;
            if (skaterStore.indexNames.contains('name')) {
                const index = skaterStore.index('name');
                request = index.getAll(name);
            } else {
                // Если индекса нет, ищем по всем записям
                request = skaterStore.getAll();
            }
            
            request.onsuccess = () => {
                let skaters = request.result;
                
                // Если использовали getAll, фильтруем по имени
                if (!skaterStore.indexNames.contains('name')) {
                    skaters = skaters.filter(s => s.name === name);
                }
                
                if (skaters.length > 0) {
                    // Найден существующий фигурист
                    resolve(skaters[0].id);
                } else {
                    // Создаем нового фигуриста
                    const newSkater = {
                        name: name,
                        createdAt: new Date().toISOString()
                    };
                    const addRequest = skaterStore.add(newSkater);
                    addRequest.onsuccess = () => resolve(addRequest.result);
                    addRequest.onerror = () => {
                        console.error('Ошибка добавления фигуриста:', addRequest.error);
                        reject(addRequest.error);
                    };
                }
            };
            request.onerror = () => {
                console.error('Ошибка поиска фигуриста:', request.error);
                reject(request.error);
            };
        } catch (error) {
            console.error('Ошибка в findOrCreateSkater:', error);
            reject(error);
        }
    });
}

// Получение всех соревнований
async function getAllCompetitions() {
    if (!db) await initDatabase();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['competitions'], 'readonly');
        const request = transaction.objectStore('competitions').getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Получение всех фигуристов
async function getAllSkaters() {
    if (!db) await initDatabase();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['skaters'], 'readonly');
        const request = transaction.objectStore('skaters').getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Поиск фигуристов по имени (минимум 3 символа)
async function searchSkaters(searchQuery) {
    if (!db) await initDatabase();
    
    if (!searchQuery || searchQuery.length < 3) {
        console.log('Поисковый запрос слишком короткий:', searchQuery);
        return [];
    }
    
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(['skaters'], 'readonly');
            const request = transaction.objectStore('skaters').getAll();
            
            request.onsuccess = () => {
                const allSkaters = request.result;
                console.log(`Всего фигуристов в БД: ${allSkaters.length}`);
                console.log('Все имена фигуристов:', allSkaters.map(s => s.name));
                
                const query = searchQuery.toLowerCase().trim();
                console.log('Ищем по запросу:', query);
                
                if (allSkaters.length === 0) {
                    console.warn('База данных пуста!');
                    resolve([]);
                    return;
                }
                
                // Фильтруем фигуристов по имени (поиск в имени и фамилии)
                const filtered = allSkaters.filter(skater => {
                    const name = skater.name.toLowerCase();
                    // Разбиваем имя на части (фамилия и имя)
                    const parts = name.split(/\s+/);
                    // Проверяем, начинается ли какая-то часть с запроса ИЛИ содержит запрос
                    const matches = parts.some(part => {
                        const startsWith = part.startsWith(query);
                        const includes = part.includes(query);
                        return startsWith || includes;
                    });
                    if (matches) {
                        console.log('✓ Найден фигурист:', skater.name, 'части:', parts, 'запрос:', query);
                    } else {
                        console.log('✗ Не подходит:', skater.name, 'части:', parts);
                    }
                    return matches;
                });
                
                console.log(`Найдено совпадений: ${filtered.length}`, filtered.map(f => f.name));
                // Ограничиваем результат 10 записями
                resolve(filtered.slice(0, 10));
            };
            
            request.onerror = () => {
                console.error('Ошибка при поиске фигуристов:', request.error);
                reject(request.error);
            };
        } catch (error) {
            console.error('Ошибка в searchSkaters:', error);
            reject(error);
        }
    });
}

// Получение полной информации о фигуристе со всеми соревнованиями
async function getSkaterFullInfo(skaterId) {
    if (!db) await initDatabase();
    
    return new Promise(async (resolve, reject) => {
        try {
            // Получаем фигуриста
            const skater = await new Promise((res, rej) => {
                const transaction = db.transaction(['skaters'], 'readonly');
                const request = transaction.objectStore('skaters').get(skaterId);
                request.onsuccess = () => res(request.result);
                request.onerror = () => rej(request.error);
            });
            
            if (!skater) {
                reject(new Error('Фигурист не найден'));
                return;
            }
            
            // Получаем все соревнования фигуриста
            const csRecords = await new Promise((res, rej) => {
                const transaction = db.transaction(['competition_skaters'], 'readonly');
                const index = transaction.objectStore('competition_skaters').index('skaterId');
                const request = index.getAll(skaterId);
                request.onsuccess = () => res(request.result);
                request.onerror = () => rej(request.error);
            });
            
            // Получаем информацию о соревнованиях
            const competitions = [];
            for (const cs of csRecords) {
                const competition = await new Promise((res, rej) => {
                    const transaction = db.transaction(['competitions'], 'readonly');
                    const request = transaction.objectStore('competitions').get(cs.competitionId);
                    request.onsuccess = () => res(request.result);
                    request.onerror = () => rej(request.error);
                });
                
                // Получаем элементы для этого соревнования
                const elements = await new Promise((res, rej) => {
                    const transaction = db.transaction(['elements'], 'readonly');
                    const index = transaction.objectStore('elements').index('skaterId');
                    const request = index.getAll(skaterId);
                    request.onsuccess = () => {
                        const allElements = request.result;
                        res(allElements.filter(e => e.competitionId === cs.competitionId));
                    };
                    request.onerror = () => rej(request.error);
                });
                
                // Получаем компоненты для этого соревнования
                const components = await new Promise((res, rej) => {
                    const transaction = db.transaction(['components'], 'readonly');
                    const index = transaction.objectStore('components').index('skaterId');
                    const request = index.getAll(skaterId);
                    request.onsuccess = () => {
                        const allComponents = request.result;
                        res(allComponents.filter(c => c.competitionId === cs.competitionId));
                    };
                    request.onerror = () => rej(request.error);
                });
                
                competitions.push({
                    competition: competition,
                    place: cs.place,
                    deductions: cs.deductions,
                    elements: elements,
                    components: components
                });
            }
            
            // Получаем статистику
            const statistics = await getSkaterStatistics(skaterId);
            
            resolve({
                skater: skater,
                competitions: competitions.sort((a, b) => new Date(b.competition.date) - new Date(a.competition.date)),
                statistics: statistics
            });
        } catch (error) {
            reject(error);
        }
    });
}

// Получение данных соревнования с фигуристами
async function getCompetitionData(competitionId) {
    if (!db) await initDatabase();
    
    return new Promise(async (resolve, reject) => {
        try {
            // Получаем соревнование
            const competition = await new Promise((res, rej) => {
                const transaction = db.transaction(['competitions'], 'readonly');
                const request = transaction.objectStore('competitions').get(competitionId);
                request.onsuccess = () => res(request.result);
                request.onerror = () => rej(request.error);
            });
            
            if (!competition) {
                reject(new Error('Соревнование не найдено'));
                return;
            }
            
            // Получаем связи соревнования и фигуристов
            const csRecords = await new Promise((res, rej) => {
                const transaction = db.transaction(['competition_skaters'], 'readonly');
                const index = transaction.objectStore('competition_skaters').index('competitionId');
                const request = index.getAll(competitionId);
                request.onsuccess = () => res(request.result);
                request.onerror = () => rej(request.error);
            });
            
            // Получаем данные фигуристов
            const skaters = [];
            for (const cs of csRecords) {
                const skater = await new Promise((res, rej) => {
                    const transaction = db.transaction(['skaters'], 'readonly');
                    const request = transaction.objectStore('skaters').get(cs.skaterId);
                    request.onsuccess = () => res(request.result);
                    request.onerror = () => rej(request.error);
                });
                
                // Получаем элементы
                const elements = await new Promise((res, rej) => {
                    const transaction = db.transaction(['elements'], 'readonly');
                    const index = transaction.objectStore('elements').index('skaterId');
                    const request = index.getAll(cs.skaterId);
                    request.onsuccess = () => {
                        const allElements = request.result;
                        res(allElements.filter(e => e.competitionId === competitionId));
                    };
                    request.onerror = () => rej(request.error);
                });
                
                // Получаем компоненты
                const components = await new Promise((res, rej) => {
                    const transaction = db.transaction(['components'], 'readonly');
                    const index = transaction.objectStore('components').index('skaterId');
                    const request = index.getAll(cs.skaterId);
                    request.onsuccess = () => {
                        const allComponents = request.result;
                        res(allComponents.filter(c => c.competitionId === competitionId));
                    };
                    request.onerror = () => rej(request.error);
                });
                
                skaters.push({
                    id: skater.id,
                    name: skater.name,
                    place: cs.place,
                    scores: {
                        elements: elements.map(e => ({
                            name: e.name,
                            baseValue: e.baseValue,
                            goe: e.goe,
                            panelScore: e.panelScore,
                            judgeScores: e.judgeScores
                        })),
                        programComponents: components.map(c => ({
                            name: c.name,
                            factor: c.factor,
                            averageScore: c.averageScore,
                            judgeScores: c.judgeScores
                        })),
                        deductions: cs.deductions
                    }
                });
            }
            
            resolve({
                ...competition,
                skaters: skaters.sort((a, b) => (a.place || 999) - (b.place || 999))
            });
        } catch (error) {
            reject(error);
        }
    });
}

// Удаление соревнования
async function deleteCompetition(competitionId) {
    if (!db) await initDatabase();
    
    const transaction = db.transaction(['competitions', 'elements', 'components', 'competition_skaters'], 'readwrite');
    
    try {
        // Удаляем связи
        const csRecords = await new Promise((res, rej) => {
            const index = transaction.objectStore('competition_skaters').index('competitionId');
            const request = index.getAll(competitionId);
            request.onsuccess = () => res(request.result);
            request.onerror = () => rej(request.error);
        });
        
        for (const cs of csRecords) {
            // Удаляем элементы
            const elements = await new Promise((res, rej) => {
                const index = transaction.objectStore('elements').index('skaterId');
                const request = index.getAll(cs.skaterId);
                request.onsuccess = () => {
                    const allElements = request.result;
                    res(allElements.filter(e => e.competitionId === competitionId));
                };
                request.onerror = () => rej(request.error);
            });
            
            for (const element of elements) {
                transaction.objectStore('elements').delete(element.id);
            }
            
            // Удаляем компоненты
            const components = await new Promise((res, rej) => {
                const index = transaction.objectStore('components').index('skaterId');
                const request = index.getAll(cs.skaterId);
                request.onsuccess = () => {
                    const allComponents = request.result;
                    res(allComponents.filter(c => c.competitionId === competitionId));
                };
                request.onerror = () => rej(request.error);
            });
            
            for (const component of components) {
                transaction.objectStore('components').delete(component.id);
            }
            
            // Удаляем связь
            transaction.objectStore('competition_skaters').delete(cs.id);
        }
        
        // Удаляем соревнование
        transaction.objectStore('competitions').delete(competitionId);
        
        await new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
        
        return { success: true };
    } catch (error) {
        console.error('Ошибка удаления соревнования:', error);
        throw error;
    }
}

// Получение статистики по фигуристу
async function getSkaterStatistics(skaterId) {
    if (!db) await initDatabase();
    
    // Получаем все элементы и компоненты фигуриста
    const elements = await new Promise((resolve, reject) => {
        const transaction = db.transaction(['elements'], 'readonly');
        const index = transaction.objectStore('elements').index('skaterId');
        const request = index.getAll(skaterId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    
    const components = await new Promise((resolve, reject) => {
        const transaction = db.transaction(['components'], 'readonly');
        const index = transaction.objectStore('components').index('skaterId');
        const request = index.getAll(skaterId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    
    // Рассчитываем средний компонент только из валидных значений
    const validComponents = components.filter(c => c.averageScore !== null && c.averageScore !== undefined && !isNaN(c.averageScore) && c.averageScore > 0);
    const averageComponentScore = validComponents.length > 0
        ? validComponents.reduce((sum, c) => sum + (c.averageScore || 0), 0) / validComponents.length
        : 0;
    
    return {
        totalElements: elements.length,
        totalComponents: components.length,
        averagePanelScore: elements.length > 0 
            ? elements.reduce((sum, e) => sum + (e.panelScore || 0), 0) / elements.length 
            : 0,
        averageComponentScore: averageComponentScore
    };
}

// Экспорт всей базы данных в JSON
async function exportDatabase() {
    if (!db) await initDatabase();
    
    const competitions = await getAllCompetitions();
    const skaters = await getAllSkaters();
    
    const exportData = {
        competitions: competitions,
        skaters: skaters,
        exportDate: new Date().toISOString()
    };
    
    return exportData;
}

// Импорт данных из JSON
async function importDatabase(jsonData) {
    if (!db) await initDatabase();
    
    // Очищаем базу данных
    const transaction = db.transaction(['competitions', 'skaters', 'elements', 'components', 'competition_skaters'], 'readwrite');
    
    transaction.objectStore('competitions').clear();
    transaction.objectStore('skaters').clear();
    transaction.objectStore('elements').clear();
    transaction.objectStore('components').clear();
    transaction.objectStore('competition_skaters').clear();
    
    await new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
    
    // Импортируем данные (упрощенная версия - нужно будет доработать)
    // Здесь можно добавить логику импорта из JSON
}

// Сброс базы данных (удаление и пересоздание)
async function resetDatabase() {
    return new Promise((resolve, reject) => {
        // Закрываем текущее соединение
        if (db) {
            db.close();
            db = null;
        }
        
        // Удаляем базу данных
        const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
        
        deleteRequest.onsuccess = () => {
            console.log('База данных удалена. Пересоздаем...');
            // Пересоздаем базу данных
            initDatabase()
                .then(() => {
                    console.log('База данных успешно пересоздана');
                    resolve();
                })
                .catch(reject);
        };
        
        deleteRequest.onerror = () => {
            reject(deleteRequest.error);
        };
        
        deleteRequest.onblocked = () => {
            console.warn('Удаление БД заблокировано. Закройте все вкладки с этим сайтом.');
            reject(new Error('Удаление БД заблокировано. Закройте все вкладки с этим сайтом.'));
        };
    });
}

// Делаем функции доступными глобально
if (typeof window !== 'undefined') {
    window.resetDatabase = resetDatabase;
    window.initDatabase = initDatabase;
    window.saveCompetitionData = saveCompetitionData;
    window.getAllCompetitions = getAllCompetitions;
    window.getAllSkaters = getAllSkaters;
    window.searchSkaters = searchSkaters;
    window.getSkaterFullInfo = getSkaterFullInfo;
    window.getCompetitionData = getCompetitionData;
    window.deleteCompetition = deleteCompetition;
    window.getSkaterStatistics = getSkaterStatistics;
    window.exportDatabase = exportDatabase;
    window.importDatabase = importDatabase;
    
    console.log('Функции базы данных загружены в window:', {
        searchSkaters: typeof window.searchSkaters,
        initDatabase: typeof window.initDatabase
    });
}

// Экспорт функций
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initDatabase,
        saveCompetitionData,
        getAllCompetitions,
        getAllSkaters,
        searchSkaters,
        getSkaterFullInfo,
        getCompetitionData,
        deleteCompetition,
        getSkaterStatistics,
        exportDatabase,
        importDatabase,
        resetDatabase
    };
}

