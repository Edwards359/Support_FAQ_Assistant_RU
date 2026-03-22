# Support FAQ Assistant RU

Комплект для кастомного GPT-ассистента первой линии поддержки и FAQ (язык интерфейса и ответов — русский по умолчанию).

## Что входит

- `system-prompt.md` - системный промпт ассистента.
- `knowledge/faq.md` - база частых вопросов и ответов.
- `knowledge/instructions.md` - операционные инструкции и правила эскалации.
- `knowledge/templates.md` - шаблоны сообщений для клиентской переписки.
- `tests/test-cases.md` - сценарии проверки качества ответов.
- `deployment/publish-gpts-store.md` - пошаговая публикация в GPTs Store.
- `deployment/integration-guide.md` - варианты интеграции на сайт или в корпоративную систему.
- `deployment/knowledge-update.md` - регламент обновления базы знаний и синхронизации с GPT/API.

## Минимальный порядок запуска

1. Загрузить `system-prompt.md` в поле Instructions при создании GPT.
2. Добавить в Knowledge файлы из папки `knowledge/`.
3. Прогнать `tests/test-cases.md` и откорректировать формулировки.
4. Опубликовать по `deployment/publish-gpts-store.md`.
5. Выбрать тип интеграции по `deployment/integration-guide.md`.

## Демо-чат (API)

В каталоге `integration/website-chat`: скопируйте `integration/website-chat/.env.example` в `.env` в **корне репозитория** или рядом с `server.js`, укажите `OPENAI_API_KEY`, выполните `npm install` и `npm start`. Регрессия: `node tests/run-api-tests.mjs` (сервер должен быть запущен).

## GitHub

- В репозитории есть `.gitignore`: не попадут в Git `.env` и `node_modules/`.
- Создайте репозиторий на GitHub, затем в корне проекта: `git init`, `git add .`, `git commit -m "Initial commit"`, `git remote add origin …`, `git push -u origin main` (или `master` — как настроите).
- **Проверьте перед push:** `git status` — не должно быть `.env` и папки `node_modules` в списке на коммит.
- Если Git пишет про **dubious ownership** (часто на Windows): `git config --global --add safe.directory "<полный путь к папке клона>"`.
- **Имя папки и репозитория на GitHub** можно сделать в духе `support-faq-assistant-ru`: переименуйте каталог локально, на GitHub — *Settings → General → Repository name*, затем `git remote set-url origin <новый URL>`.
