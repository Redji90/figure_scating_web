# Инструкция по отправке проекта в GitHub

## Шаги для отправки проекта в GitHub

### 1. Убедитесь, что Git установлен
```bash
git --version
```

Если Git не установлен, скачайте с https://git-scm.com/download/win

### 2. Инициализируйте репозиторий (если еще не сделано)
```bash
git init
```

### 3. Добавьте все файлы
```bash
git add .
```

### 4. Сделайте первый коммит
```bash
git commit -m "Initial commit: Figure skating analytics application"
```

### 5. Переименуйте ветку в main (если нужно)
```bash
git branch -M main
```

### 6. Добавьте удаленный репозиторий
```bash
git remote add origin https://github.com/Redji90/figure_scating_web.git
```

Если репозиторий уже добавлен и нужно обновить URL:
```bash
git remote set-url origin https://github.com/Redji90/figure_scating_web.git
```

### 7. Отправьте код в GitHub
```bash
git push -u origin main
```

**Важно:** При первом push может потребоваться аутентификация:
- Используйте Personal Access Token вместо пароля
- Или настройте SSH ключи

### Альтернативный способ (через GitHub Desktop)

1. Установите GitHub Desktop: https://desktop.github.com/
2. Откройте GitHub Desktop
3. File → Add Local Repository
4. Выберите папку `c:\prj\web_int`
5. Нажмите "Publish repository"
6. Выберите репозиторий `Redji90/figure_scating_web`

## Если возникли проблемы

### Ошибка аутентификации
Используйте Personal Access Token:
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Создайте новый token с правами `repo`
3. Используйте token вместо пароля при push

### Репозиторий уже существует
Если в репозитории уже есть файлы (например, README):
```bash
git pull origin main --allow-unrelated-histories
git push -u origin main
```

### Проверка статуса
```bash
git status
git remote -v
```

