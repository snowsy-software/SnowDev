# SnowDev 项目计划

## 1. 项目定义

### 1.1 名称与定位

- 项目名：`SnowDev`
- npm 包名：`@snowdev/cli`（CLI）与 `@snowdev/core`（可编程 API；首版也可先只发布 `@snowdev/cli`）
- 仓库：公开 GitHub 仓库
- 发布渠道：公开 npm registry
- 开源协议：Apache License 2.0
- 实现语言：TypeScript；向 npm 发布编译后的 ESM JavaScript 和 `.d.ts`，使用者不需要安装 TypeScript。

SnowDev 是一个以 Node.js 为运行时的开发工作流编排工具。它不试图统一 React、Spring Boot、Go、WordPress 等应用本身，而是统一这些项目周边的启动、停止、Docker Compose、环境文件、健康检查和开发任务入口。

目标体验：

```bash
npm run dev
npm run stag
npm run prod
npm run down
npm run logs
npm run test
```

每个项目的命令保持一致，内部实际运行的技术栈和 Compose 服务由项目配置决定。

### 1.2 背景与问题

现有项目都使用 `package.json` 作为 Node.js 启动入口，且大多通过 Docker Compose 提供 `dev`、`stag`、`prod`。但同一类流程散落为多个 `scripts/start.js`、`scripts/runtime.mjs`、`scripts/stop.js`：

- Compose 参数、环境文件加载、进程错误处理和 profile 校验重复实现。
- 同一命令在不同仓库的前台/后台、构建与清理语义不一致。
- 开发数据库或 SQLite 的重置有隐式副作用，存在误删本地数据风险。
- Windows 下部分脚本使用 shell 执行，参数转义与可移植性较弱。
- 新项目需要复制旧脚本后再逐处修改，无法安全继承上游改进。

- C:\Users\xiaoa\QX_Web_V4_Admin
- C:\Users\xiaoa\QX_Web_V4_Backend
- C:\Users\xiaoa\QX_Web_V4_WWW
- C:\Users\xiaoa\QX_Web_V4_Ops
- C:\Users\xiaoa\QX_Web_V4_ImageUtil
- C:\Users\xiaoa\AUSCompanyDS
- C:\Users\xiaoa\AUSCompanyDS_Admin
- C:\Users\xiaoa\Website-WordPress-Backend
- C:\Users\xiaoa\DevAuthServer

### 1.3 非目标

SnowDev 第一阶段不做以下事情：

- 不生成、重写或抽象业务仓库的 `docker/compose.yml`、Dockerfile、应用源码。
- 不管理 Kubernetes、云部署、CI/CD 发布或密钥托管。
- 不替代 npm、Docker、Docker Compose、Maven、Go、WordPress CLI 等底层工具。
- 不将现有项目专有名称、域名、端口、镜像、账号或内部网络拓扑放进公开仓库。

## 2. 架构与边界

### 2.1 core 与 custom

SnowDev 采用“不可编辑的上游 core + 可编辑的项目 custom”模型。

| 层级 | 位置 | 维护者 | 内容 |
| --- | --- | --- | --- |
| `core` | 已安装的 `@snowdev/cli` npm 包 | SnowDev 上游 | CLI、schema、Compose 命令构造、环境加载、日志、健康检查、生命周期与安全保护 |
| `custom` | 消费项目的 `snowdev.config.mjs` / `snowdev/` | 项目维护者 | Compose 文件、服务名、profile、端口、环境变量、初始化及业务专属 hook |

业务项目不得复制或修改 core 源码。它们通过锁定版本引用上游，例如：

```json
{
  "devDependencies": {
    "@snowdev/cli": "1.0.0"
  },
  "scripts": {
    "dev": "snowdev run dev",
    "stag": "snowdev run stag",
    "prod": "snowdev run prod",
    "down": "snowdev down",
    "logs": "snowdev logs",
    "test": "snowdev task test",
    "doctor": "snowdev doctor"
  }
}
```

精确版本配合 lockfile 保证可复现；升级由项目维护者显式执行，并由 `snowdev doctor` 检查配置兼容性。

### 2.2 支持的工作流类型

首版需覆盖已盘点项目的三种模型：

| 工作流 | 说明 | 对应项目示例 |
| --- | --- | --- |
| `compose-service` | 应用和依赖都由 Compose 运行 | Next、WordPress、Go、Keycloak |
| `host-app-with-compose-deps` | Compose 仅启动数据库/对象存储等依赖，应用在宿主机运行 | Spring Boot Backend、AUSCompanyDS |
| `container-cli` | 容器是一次性 CLI，不属于长期运行服务 | Ops |

### 2.3 配置原则

- 默认配置文件为 `snowdev.config.mjs`，避免要求消费项目安装 TypeScript 运行器。
- SnowDev 源码全部使用 TypeScript，公开稳定的类型由 `@snowdev/core` 提供。
- 第二阶段才支持 `snowdev.config.ts`；仅在项目明确配置 TypeScript loader 时启用。
- 配置必须通过 schema 校验；未知 profile、缺失服务、危险重置策略应在执行前失败。
- custom hook 使用受限、具名的生命周期接口；避免将任意 shell 字符串塞入配置。

建议的配置形状：

```js
/** @type {import('@snowdev/core').SnowDevConfig} */
export default {
  id: "example-service",
  compose: {
    file: "docker/compose.yml",
    projectName: "example-service",
  },
  profiles: {
    dev: { kind: "compose-service", services: ["app"], foreground: true },
    stag: { kind: "compose-service", services: ["app"], foreground: false },
    prod: { kind: "compose-service", services: ["app"], foreground: false },
  },
  tasks: {
    test: { profile: "test", services: ["app-test"], isolated: true },
  },
};
```

## 3. 统一命令契约与安全策略

### 3.1 命令契约

| 命令 | 标准语义 |
| --- | --- |
| `snowdev run dev` | 启动开发环境；长期服务默认前台运行 |
| `snowdev run stag` / `prod` | 构建并后台启动指定环境；不隐式删除运行环境 |
| `snowdev down [profile]` | 显式停止指定环境 |
| `snowdev logs [profile]` | 跟随日志 |
| `snowdev ps [profile]` | 查看状态 |
| `snowdev task <name>` | 执行配置声明的 lint/build/test/e2e 等任务 |
| `snowdev init dev` | 显式创建本地配置、种子或首次初始化 |
| `snowdev reset dev --yes` | 显式清理允许重置的开发数据 |
| `snowdev doctor` | 校验 Node、Docker、Compose、配置、环境文件、端口与服务定义 |

### 3.2 强制安全规则

1. `stag` 与 `prod` 的 `run` 禁止隐式执行 `docker compose down`。
2. volume 删除只能通过 `reset dev --yes`；默认不允许在 `stag`、`prod` 执行。
3. 测试必须使用独立的 Compose project 名与专用 profile/volume，测试清理不得影响 dev 数据。
4. 所有 Compose 调用都显式传入 project name、compose file 和 profile，避免多仓库相互污染。
5. Node 子进程必须用参数数组调用，禁止 `shell: true`；所有命令均记录为可复制日志，并对 token、密码脱敏。
6. 环境变量优先级固定为：进程环境变量 > profile local 文件 > local 文件 > profile 文件 > 基础文件 > 配置默认值。
7. `init`、`reset`、自定义 destructive hook 必须在终端打印影响范围；非交互环境必须带 `--yes`。

## 4. 母仓库结构

```text
snowdev/
  src/
    cli.ts
    commands/
    core/
      compose.ts
      config.ts
      env.ts
      lifecycle.ts
      process.ts
      health.ts
      safety.ts
    schema/
    types/
  templates/
    compose-service/
    hybrid-host-service/
    container-cli/
  examples/
    vite-service/
    spring-hybrid/
    wordpress/
  test/
    unit/
    integration/
    fixtures/
  docs/
  LICENSE
  NOTICE
  README.md
  package.json
  tsconfig.json
```

发布包应仅包含 `dist/`、README、LICENSE、NOTICE、必要模板和类型声明；`.env`、测试快照中的敏感值、仓库专有 Docker 资产不得进入 npm tarball。

## 5. 实施阶段

### Phase 0：仓库建立与开源基线

- [ ] 创建公开 GitHub 仓库 `snowdev`。（按当前要求保持私有，直到公开 npm 包获准发布。）
- [x] 添加 Apache-2.0 的 `LICENSE`、`NOTICE`、贡献指南、行为准则与安全报告说明。
- [x] 建立 TypeScript ESM 工程、Node 版本策略、Prettier、ESLint、Vitest。
- [x] 配置 `npm pack --dry-run` 检查，确保不会发布源环境文件或无关资源。
- [ ] 确定 npm scope；若 `@snowdev` 不可用，选择不包含内部品牌的公开 scope。（`@snowdev/cli` 当前仅为预发布占位，须由已认证 npm 维护者在首发前确认所有权与可用性。）

验收：空 CLI 可运行，`npm pack --dry-run` 内容受控，开源元信息完整。

### Phase 1：core 基础能力

- [ ] 实现 CLI 参数解析与统一错误格式。
- [ ] 实现配置发现、MJS 配置加载及 schema 校验。
- [ ] 实现无 shell 的跨平台子进程执行器。
- [ ] 实现 Compose 参数构造器：`--project-name`、`-f`、`--profile`。
- [ ] 实现受控的环境文件加载、优先级与日志脱敏。
- [ ] 实现 `doctor` 的 Node、Docker、Docker Compose、文件和配置检查。

验收：三个模板 fixture 可以输出正确命令；Windows/Linux 命令参数单测通过。

### Phase 2：运行时生命周期与安全机制

- [x] 实现 `run` 的前台和后台生命周期。
- [x] 实现 `down`、`logs`、`ps`。
- [x] 实现 HTTP 与 Compose healthcheck 等待，支持超时和失败诊断。
- [x] 实现 `init`、`reset` 及 `--yes` 保护。
- [x] 实现隔离测试任务的创建、执行和 `finally` 清理。
- [x] 为 `host-app-with-compose-deps` 实现宿主进程启动、PID 状态和受控停止接口。

验收：不会在 `run stag/prod` 中调用 `down`；无 `--yes` 的 reset 必须失败；测试环境与 dev project 名不同。

### Phase 3：custom hooks 与模板

- [ ] 定义 `beforeRun`、`afterDependenciesReady`、`beforeDown`、`task` 等具名 hook 类型。
- [ ] 提供 Vite/Next、Spring hybrid、WordPress、container CLI 示例。
- [ ] 编写配置迁移指南与命令映射指南。
- [ ] 提供 `snowdev init` 生成脱敏模板，但不覆盖已有脚本或 Compose 文件。

验收：示例可独立运行，且没有引用 QX/Snowsy 的内部资源。

### Phase 4：首批真实项目迁移

- [ ] 先迁移 `QX_Web_V4_Backend` 与 `AUSCompanyDS`，验证 Spring hybrid 模式。
- [ ] 对比旧/新 `dev`、`stag`、`prod`、`stop`、`test` 输出和实际行为。
- [ ] 将开发库默认重置改为显式 `init` 或 `reset`，保留临时兼容别名并给出弃用提示。
- [ ] 迁移 `QX_Web_V4_Admin`、`QX_Web_V4_WWW`、`Website-WordPress-Backend`，验证 Compose runtime 模式。
- [ ] 迁移 `QX_Web_V4_ImageUtil`、`DevAuthServer`、`QX_Web_V4_Ops`，补全 E2E、Keycloak 初始化与 container CLI hook。

验收：每个迁移仓库保持既有 `npm run dev/stag/prod` 入口；旧脚本至少保留一个发布周期的兼容层。

### Phase 5：公开发布与维护

- [ ] 配置 GitHub Actions：lint、typecheck、单测、集成测试、`npm pack --dry-run`。
- [ ] 使用 semantic versioning 与变更日志；破坏性配置变更只在 major 版本发布。
- [ ] 发布 `1.0.0` 到 npm：`npm publish --access public`。
- [ ] 启用 npm 2FA 或受限 granular publishing token；CI 不保存个人密码。
- [ ] 建立 issue 模板、兼容性矩阵和安全漏洞响应流程。

验收：从全新目录执行 `npm install -D @snowdev/cli` 后可运行示例；公开 npm 包包含 Apache-2.0 许可证。

## 6. 测试与质量门槛

- 单元测试：参数解析、schema、环境优先级、脱敏、命令构造、安全拦截。
- 集成测试：使用 fixture Compose 文件和 mock Docker 二进制验证完整生命周期，不依赖真实业务项目。
- 兼容性：至少覆盖 Windows PowerShell、Linux shell、Node 当前 LTS 与一个前代 LTS。
- 发布前：`typecheck`、lint、`npx prettier --check .`、单测、集成测试、`npm pack --dry-run` 全部通过。
- 文档：每个公开命令提供输入、行为、退出码和危险操作说明。

## 7. 关键决策记录

1. **公开 npm，不使用私有包。** SnowDev 不含业务配置、秘密或内部资产；公开分发降低使用门槛。
2. **使用 TypeScript 开发，JavaScript 分发。** core 获得类型安全，消费者零 TypeScript 运行时负担。
3. **Apache-2.0。** 允许个人与企业复用、修改和商业分发，并提供专利授权与免责声明。
4. **npm 包而非 git subtree/submodule。** 以版本边界保证 core 不被消费仓库随意修改，也能明确地升级和回滚。
5. **Compose 保留在业务仓库。** 业务基础设施差异太大；SnowDev 只编排，不生成拓扑。
6. **安全优先于旧行为兼容。** 隐式数据重置和 production/staging 的隐式 `down` 不进入新命令契约。
