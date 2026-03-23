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

GET `/config` — лимиты `max_input_chars`, `max_output_tokens` и флаг `require_auth` (из `.env`).

GET `/metrics` — агрегаты качества (с момента запуска): число запросов, ошибок, доля эскалаций, средняя длина ответа, средняя задержка.

POST `/chat/support`

Body:

```json
{
  "message": "Как восстановить пароль?",
  "session_id": "user-123"
}
```

Response:

```json
{
  "reply": "Пошаговый ответ...",
  "handoff_required": false,
  "ticket_id": null
}
```

При слишком длинном `message`: `400` и `{ "error": "message_too_long", "max_input_chars": 2000 }`.

Если ответ помечен как эскалация (`handoff_required=true`), сервер автоматически создаёт тикет в `integration/website-chat/data/tickets.jsonl` и возвращает `ticket_id`.

### JWT (базово)

- По умолчанию `REQUIRE_AUTH=false`.
- Для включения защиты задайте:
  - `REQUIRE_AUTH=true`
  - `JWT_SECRET=<секрет HS256>`
- Тогда `POST /chat/support` требует заголовок:
  - `Authorization: Bearer <jwt>`
- Для идентификации сессии используется `session_id` из body, либо `sub` из JWT.

Переменные `.env`: `MAX_INPUT_CHARS`, `MAX_OUTPUT_TOKENS`, `REQUIRE_AUTH`, `JWT_SECRET` (см. `.env.example`).

## Расширение до корпоративной системы

- Подключите полноценную авторизацию (SSO/OAuth2) вместо базового shared secret.
- Подключите тикетинг в CRM/Helpdesk вместо локального `tickets.jsonl`.
- Добавьте дашборд по `/metrics` (CSAT, доля эскалаций, SLA).
