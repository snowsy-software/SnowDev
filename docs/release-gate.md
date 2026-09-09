# npm 公共包发布门禁

`@snowsy-software/snowdev` 发布至 npm 公共注册表，代码以 BUSL-1.1 提供。默认仅允许非生产使用；每个版本在首次公开发布满四年或 `2030-09-09`（以较早者为准）后转换为 MIT License。发布前必须确认仓库和待发布文件不含密钥、客户数据、内部基础设施或不应公开的实现。

## 发布前检查

从干净工作区执行：

```bash
npm ci
npm run typecheck
npm run lint
npx prettier --check .
npm test
npm run pack:check
```

审阅 `npm pack --dry-run` 的文件列表。它只能包含编译产物、`src/` 源码、包元数据、许可证、中文 README、必要模板和类型声明；不得包含测试、`.env` 文件、令牌、私有文档、业务 Docker 资产或 CI 配置。

## 发布流程

1. 确认 `package.json` 的版本已更新，且 `name` 为 `@snowsy-software/snowdev`。
2. 确认 `publishConfig.registry` 是 `https://registry.npmjs.org`，且 `access` 是 `public`。
3. 在 npm 的包设置中配置 GitHub Actions Trusted Publisher，字段为组织或用户、仓库名和工作流文件名 `publish-package.yml`；工作流须使用 GitHub 托管 runner。
4. 在 GitHub Actions 手动运行“发布 npm 公共包”工作流，并输入 `PUBLISH` 明确确认。工作流通过 OIDC 短期身份发布，不得在 Actions secret 或仓库文件中保存 npm 发布令牌。
5. 发布后，在独立消费者项目执行 `npm install -D @snowsy-software/snowdev@<version>` 进行验证。
