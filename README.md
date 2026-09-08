# SnowDev

SnowDev 是一个供内部项目使用的 Node.js 命令行工具，用于编排可重复的本地开发工作流。它围绕消费项目维护的 Docker Compose 文件、宿主机进程、环境变量加载、健康检查和安全控制，提供统一操作入口。

## 当前状态

本仓库与发布包均为私有资产。CLI 当前版本为 `0.0.0`，提供 `run`、`down`、`logs`、`ps`、`init`、`reset`、`task`、`doctor` 命令，支持 `beforeRun`、`afterDependenciesReady`、`beforeDown` 与 `task` 生命周期 hook，以及 `snowdev init template` 脚手架。可运行示例位于 [`examples/`](examples/)。

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

## 安装私有包

包发布至 GitHub Packages，名称为 `@snowsy-software/snowdev`。消费者项目需要在 `.npmrc` 中配置：

```ini
@snowsy-software:registry=https://npm.pkg.github.com
```

开发者需在用户级 npm 配置中使用有 GitHub Packages 读取权限的令牌认证；令牌不得提交到仓库。随后安装指定版本：

```bash
npm install -D @snowsy-software/snowdev@<version>
```

## 文档

从[文档地图](docs/README.md)开始。维护者与 AI 协作者还必须遵守 [AGENTS.md](AGENTS.md)。

`pack:check` 会执行 `npm pack --dry-run`。发布文件白名单定义在 `package.json`；源代码、测试、仓库文档、环境文件和 CI 配置均不得进入包文件。
