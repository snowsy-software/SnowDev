# SnowDev

[English](README.md)

SnowDev 是一个 Node.js 命令行工具，用于编排可重复的本地开发工作流。它将围绕由项目自行维护的 Docker Compose 文件、宿主机进程、环境变量加载、健康检查和安全控制，提供统一的操作入口。

## 当前状态

本仓库目前处于私有预发布阶段，尚未发布到 npm，也不会在首个公开 npm 包获批准前改为公开。当前 `0.0.0` CLI 仅用于建立 Phase 0 的打包基线，尚未实现工作流命令。

## 环境要求

- Node.js 20.19.0 或更高版本
- 建议使用 npm 10 或更高版本

## 本地开发

```bash
npm install
npm run build
node dist/cli.js --help
```

质量检查：

```bash
npm run typecheck
npm run lint
npx prettier --check .
npm test
npm run pack:check
```

`pack:check` 会执行 `npm pack --dry-run`。发布文件白名单定义在 `package.json` 中；源码、测试、仓库文档、环境文件和 CI 配置均不得进入 npm tarball。

使用 `npx prettier --write .` 格式化文件。使用 `npx npm-check-updates` 检查可用的依赖更新但不改写文件；在审核通过后，可执行 `npx npm-check-updates -u`，然后执行 `npm install` 应用更新。

## 发布状态

在维护者批准公开发布前，请勿运行 `npm publish`，也不要变更 GitHub 仓库可见性。npm scope 所有权核验及其他发布条件见[发布门禁](docs/release-gate.md)。

## 许可证

项目采用 [Apache License 2.0](LICENSE) 许可证。第三方归属声明请见 [NOTICE](NOTICE)。
