# Support FAQ Assistant RU — демо-интеграция (веб-чат)

## Запуск

1. Скопируйте `.env.example` в `.env`.
2. Укажите `OPENAI_API_KEY`.
3. Установите зависимости:
   - `npm install`
4. Запустите:
   - `npm start`
5. Откройте:
   - `http://localhost:8080`

## API

GET `/config` — лимиты `max_input_chars`, `max_output_tokens` (из `.env`).

POST `/chat/support`

Body:

```json
{
  "message": "Как восстановить пароль?"
}
```

Response:

```json
{
  "reply": "Пошаговый ответ...",
  "handoff_required": false
}
```

При слишком длинном `message`: `400` и `{ "error": "message_too_long", "max_input_chars": 2000 }`.

Переменные `.env`: `MAX_INPUT_CHARS`, `MAX_OUTPUT_TOKENS` (см. `.env.example`).

## Расширение до корпоративной системы

- Добавьте авторизацию пользователя (SSO/JWT) на backend.
- Логируйте обращения в CRM/Helpdesk.
- По `handoff_required=true` создавайте тикет оператору.
