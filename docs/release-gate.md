# GitHub 私有包发布门禁

本仓库和 `@snowsy-software/snowdev` 均为私有资产。包只能发布到 GitHub Packages，禁止发布到 npmjs.com。

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

审阅 `npm pack --dry-run` 的文件列表。它只能包含编译产物、包元数据、中文 README、必要模板和类型声明；不得包含源代码、测试、`.env` 文件、令牌、私有文档、业务 Docker 资产或 CI 配置。

## 发布流程

1. 确认 `package.json` 的版本已更新，且 `name` 为 `@snowsy-software/snowdev`。
2. 确认 `publishConfig.registry` 是 `https://npm.pkg.github.com`，不得临时改为 npmjs.com。
3. 在 GitHub Actions 手动运行“发布私有包”工作流，并输入 `PUBLISH` 明确确认。
4. 工作流以仓库短期 `GITHUB_TOKEN` 发布；不在 Actions secret 或仓库文件中保存个人访问令牌。
5. 发布后，使用有读取权限的独立消费者项目安装该精确版本进行验证。
