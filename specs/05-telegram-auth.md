Telegram Auth Contract (X-Telegram-Init-Data)

Overview
- Each GraphQL request to the Worker must include header: `X-Telegram-Init-Data` with valid init data.
- Worker validates using the Telegram bot token (via HMAC-SHA256) and attaches auth context to the request lifecycle.

Validation rules
- Init data must be present and valid; otherwise respond with 401.
- Auth result includes User (telegram user id, name, language).
- The auth result is injected into GraphQL resolvers context for saleor integration.

Error handling
- 401 if header missing/invalid or expired init data.
- 403 if user lacks required permissions for operation.

Test considerations
- Spec should verify that requests with valid init data proceed to schema resolution.
- Request without header or with invalid data should fail gracefully with a descriptive error.
