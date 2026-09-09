# SnowDev

SnowDev 是一个 Node.js 命令行工具，用于编排可重复的本地开发工作流。它围绕消费项目维护的 Docker Compose 文件、宿主机进程、环境变量加载、健康检查和安全控制，提供统一操作入口。

## 当前状态

`@snowsy-software/snowdev` 是发布到 npm 的公开包。其源代码以 BUSL-1.1 提供：默认仅允许非生产使用；每个版本会在首次公开发布满四年或 `2030-09-09`（以较早者为准）后转换为 MIT License。CLI 当前版本为 `0.0.1`，提供 `run`、`down`、`logs`、`ps`、`init`、`reset`、`task`、`doctor` 命令，支持 `beforeRun`、`afterDependenciesReady`、`beforeDown` 与 `task` 生命周期 hook，以及 `snowdev init template` 脚手架。可运行示例位于 [`examples/`](examples/)。

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

## 安装

包发布至 npm，名称为 `@snowsy-software/snowdev`，安装不需要 GitHub Packages 的 `.npmrc` 配置或读取令牌。安装指定版本：

```bash
npm install -D @snowsy-software/snowdev@<version>
```

## 文档

从[文档地图](docs/README.md)开始。维护者与 AI 协作者还必须遵守 [AGENTS.md](AGENTS.md)。

`pack:check` 会执行 `npm pack --dry-run`。发布文件白名单定义在 `package.json`；包会包含 `src/` 以提供可审阅的源码，测试、仓库文档、环境文件和 CI 配置均不得进入包文件。
