# Руководство по базе данных для аналитики фигурного катания

## Текущая реализация: IndexedDB

### Что это?
IndexedDB - встроенная в браузер база данных, которая позволяет хранить большие объемы структурированных данных локально на компьютере пользователя.

### Преимущества:
- ✅ **Бесплатно** - не требует регистрации или оплаты
- ✅ **Работает офлайн** - данные хранятся локально
- ✅ **Большой объем** - может хранить гигабайты данных
- ✅ **Быстро** - быстрый доступ к данным
- ✅ **Структурированно** - данные организованы в таблицы

### Недостатки:
- ❌ **Только локально** - данные не синхронизируются между устройствами
- ❌ **Привязано к браузеру** - при очистке данных браузера данные могут быть потеряны

### Использование:

1. **Сохранение результатов:**
   - После парсинга PDF нажмите "Сохранить в БД"
   - Данные автоматически сохраняются в IndexedDB

2. **Экспорт данных:**
   - "Экспорт JSON" - экспортирует текущие результаты
   - "Экспорт всей БД" - экспортирует всю базу данных

3. **Импорт данных:**
   - "Импорт JSON" - позволяет импортировать ранее экспортированные данные

4. **Просмотр сохраненных данных:**
   - Все сохраненные соревнования отображаются в разделе "Сохранённые результаты"
   - Соревнования из БД помечены как "[БД]"
   - Старые данные из localStorage помечены как "[LocalStorage]"

---

## Альтернативные варианты для облачного хранения

### 1. Supabase (Рекомендуется для облачного хранения)

**Что это?** Бесплатный хостинг PostgreSQL базы данных с простым REST API.

**Преимущества:**
- ✅ Бесплатный тариф (500MB базы данных, 2GB трафика)
- ✅ PostgreSQL - полноценная SQL база данных
- ✅ REST API и JavaScript SDK
- ✅ Автоматические резервные копии
- ✅ Синхронизация между устройствами
- ✅ Row Level Security для безопасности

**Как подключить:**
1. Зарегистрируйтесь на https://supabase.com
2. Создайте новый проект
3. Скопируйте API ключ и URL проекта
4. Добавьте в код:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'YOUR_SUPABASE_URL'
const supabaseKey = 'YOUR_SUPABASE_KEY'
const supabase = createClient(supabaseUrl, supabaseKey)

// Сохранение соревнования
async function saveToSupabase(competitionData) {
  const { data, error } = await supabase
    .from('competitions')
    .insert([competitionData])
  
  if (error) console.error(error)
  else console.log('Сохранено!', data)
}
```

**Структура таблиц:**
```sql
-- Соревнования
CREATE TABLE competitions (
  id SERIAL PRIMARY KEY,
  name TEXT,
  date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Фигуристы
CREATE TABLE skaters (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Элементы
CREATE TABLE elements (
  id SERIAL PRIMARY KEY,
  skater_id INTEGER REFERENCES skaters(id),
  competition_id INTEGER REFERENCES competitions(id),
  name TEXT,
  base_value DECIMAL,
  goe DECIMAL,
  panel_score DECIMAL,
  judge_scores JSONB
);
```

---

### 2. Firebase Firestore

**Что это?** NoSQL база данных от Google.

**Преимущества:**
- ✅ Бесплатный тариф (1GB хранилища, 10GB трафика)
- ✅ Простой API
- ✅ Real-time синхронизация
- ✅ Хорошая документация

**Недостатки:**
- ❌ NoSQL (менее структурированно, чем SQL)
- ❌ Может быть дороже при росте данных

**Как подключить:**
1. Зарегистрируйтесь на https://firebase.google.com
2. Создайте проект
3. Добавьте Firebase SDK в проект

---

### 3. MongoDB Atlas

**Что это?** Облачный хостинг MongoDB.

**Преимущества:**
- ✅ Бесплатный тариф (512MB хранилища)
- ✅ NoSQL база данных
- ✅ Хорошо масштабируется

**Недостатки:**
- ❌ NoSQL (менее структурированно)
- ❌ Может быть сложнее для начинающих

---

### 4. Google Sheets API

**Что это?** Использование Google Таблиц как базы данных.

**Преимущества:**
- ✅ Полностью бесплатно
- ✅ Визуальный просмотр данных
- ✅ Легко редактировать вручную
- ✅ Можно использовать как есть

**Недостатки:**
- ❌ Ограничения по количеству запросов
- ❌ Медленнее, чем специализированные БД
- ❌ Не предназначено для больших объемов данных

---

## Рекомендации

### Для начала (текущая реализация):
✅ **IndexedDB** - идеально для начала работы, не требует регистрации, работает локально

### Для облачного хранения:
✅ **Supabase** - лучший вариант для перехода на облачное хранение:
- Простой в использовании
- Бесплатный тариф достаточен для начала
- Легко мигрировать с IndexedDB
- PostgreSQL - мощная и надежная БД

### Для аналитики:
- IndexedDB/Supabase позволяют делать сложные SQL запросы
- Можно строить графики и статистику
- Можно сравнивать результаты разных соревнований
- Можно отслеживать прогресс фигуристов

---

## Примеры запросов для аналитики

### Получить все элементы фигуриста:
```javascript
// IndexedDB
const elements = await getElementsBySkater(skaterId);

// Supabase
const { data } = await supabase
  .from('elements')
  .select('*')
  .eq('skater_id', skaterId);
```

### Средний балл фигуриста:
```javascript
const { data } = await supabase
  .from('elements')
  .select('panel_score')
  .eq('skater_id', skaterId);

const avg = data.reduce((sum, e) => sum + e.panel_score, 0) / data.length;
```

### Топ-10 фигуристов по среднему баллу:
```sql
SELECT 
  s.name,
  AVG(e.panel_score) as avg_score,
  COUNT(e.id) as total_elements
FROM skaters s
JOIN elements e ON s.id = e.skater_id
GROUP BY s.id, s.name
ORDER BY avg_score DESC
LIMIT 10;
```

---

## Миграция данных

Если вы хотите перейти с IndexedDB на Supabase:

1. Экспортируйте все данные из IndexedDB (кнопка "Экспорт всей БД")
2. Создайте таблицы в Supabase
3. Импортируйте данные через Supabase API

Код для миграции можно добавить в будущем.

