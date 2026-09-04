# Versioning

Mia Studio 同时管理产品版本、API 版本和 Vault 数据结构版本。三者不得混用。

## Product version

产品遵循 Semantic Versioning：

- `MAJOR`：需要人工迁移或不兼容的 API/CLI 变更。
- `MINOR`：向后兼容的功能增加。
- `PATCH`：向后兼容的修复。

产品版本同时写入：

- 根目录 `VERSION`
- 根 `package.json`
- `CHANGELOG.md`
- Git tag `v<version>`

`pnpm version:check` 用于防止版本漂移。

## API version

- 公开 HTTP API 使用路径版本，首版为 `/v1`。
- 在 `/v1` 内可以增加可选字段和新端点，不可改变已有字段语义。
- 删除字段、改变认证方式或改变错误契约需要新的 API major version。

## Vault schema version

- 每个由 Mia 管理的 topic/article Markdown 在 frontmatter 中包含 `schema_version`。
- Vault 根目录的 `.mia/schema-version` 记录当前整体结构版本。
- 数据结构版本使用单调递增整数，从 `1` 开始，不使用 SemVer。
- 迁移脚本位于 `packages/workspace/src/migrations/<from>-<to>.ts`。
- 迁移前必须创建 Vault 快照；迁移是幂等的，不删除未识别的 frontmatter 字段。

## Compatibility declaration

每个发布版在代码中声明：

```text
app_version: 0.3.0
api_versions: [1]
vault_schema_min: 1
vault_schema_max: 1
```

Web、CLI 和 MCP 启动时必须校验兼容范围。遇到较新的 Vault 时只读打开，不尝试降级写入。

## Release flow

1. 更新 `VERSION`、`package.json` 和 `CHANGELOG.md`。
2. 运行单元测试、构建、Vault 迁移往返测试和 `pnpm version:check`。
3. 创建发布提交 `chore(release): vX.Y.Z`。
4. 创建签名 tag `vX.Y.Z`。
5. 推送分支和 tag，由部署流程生成不可变构建产物。
