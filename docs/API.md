# API v1

API 统一返回 JSON。除健康检查和登录外，请求需要 `mia_session` HttpOnly Cookie 或 `Authorization: Bearer <token>`。

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/v1/health` | 健康检查 |
| `POST` | `/v1/auth/login` | 密码登录 |
| `POST` | `/v1/auth/logout` | 注销会话 |
| `GET` | `/v1/session` | 当前用户 |
| `GET/POST` | `/v1/topics` | 查询/创建选题 |
| `POST` | `/v1/topics/:id/promote` | 选题立项为文章 |
| `GET/POST` | `/v1/articles` | 查询/创建文章 |
| `GET/PUT` | `/v1/articles/:id` | 读取/更新文章 |

## Conflict contract

`GET /v1/articles/:id` 会返回 `ETag` header。更新时必须把该值放在 `If-Match` header 中。少传返回 `428 precondition_required`，文件已被其他终端修改时返回 `409 conflict` 及最新 ETag。

## Error shape

```json
{
  "error": {
    "code": "conflict",
    "message": "Article changed since it was opened",
    "details": { "currentEtag": "sha256:..." }
  }
}
```
