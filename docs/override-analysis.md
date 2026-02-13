# pnpm overrides 与「直接升级」分析

## 当前 overrides 与依赖路径

| override | 引入路径（直接依赖） | 上游最新是否已修 |
|----------|----------------------|------------------|
| `tar` >= 7.5.7 | grpc-tools → @mapbox/node-pre-gyp → tar ^7.4.0 | ❌ node-pre-gyp 仍声明 tar ^7.4.0，grpc-tools 已最新 1.13.1 |
| `@isaacs/brace-expansion` >= 5.0.1 | @vitest/coverage-v8 → test-exclude → glob → minimatch | ⚠️ Vitest 4.x 依赖树不同，可尝试升级后去掉 |
| `lodash` >= 4.17.23 | @semantic-release/changelog, @semantic-release/git | ⚠️ changelog 声明 lodash ^4.17.4，理论可解析到 4.17.23，依赖锁表解析 |
| `lodash-es` >= 4.17.23 | @semantic-release/npm | ⚠️ 声明 ^4.17.21，同上 |
| `undici` >= 6.23.0 | @semantic-release/npm → @actions/core → @actions/http-client | ✅ @semantic-release/npm 13.1.4 起用 @actions/core ^3 → http-client ^4，可带出新 undici |

## 结论与建议

- **仅能通过 override 解决（当前保留）**：`tar`（grpc-tools / node-pre-gyp 无新版本带 tar >= 7.5.7）；`@isaacs/brace-expansion`（除非升级到 Vitest 4，有破坏性变更）。
- **已通过升级去掉的 overrides**：将 @semantic-release/npm 升到 ^13.1.4 后，undici、lodash、lodash-es 的漏洞由新依赖树满足，已移除对应 override，audit 通过。
- **当前保留的 overrides**：`glob`、`js-yaml`（历史安全/兼容）、`tar`、`@isaacs/brace-expansion`。
