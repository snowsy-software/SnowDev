# Snowsy Devkit 项目计划

## 1. 项目目标

建立一个独立、版本化的 Node.js 工具仓库（暂定名：`snowsy-devkit`），统一各业务仓库的本地开发、预发布和生产 Docker 运行脚本。

目标是让业务仓库以少量配置声明自身差异，同时提供一致的命令体验：

```bash
npm run dev
npm run stag
npm run prod
npm run down
npm run logs
npm run ps
npm run build
npm run test
```

本项目不统一业务技术栈、Dockerfile、Compose 服务名、端口或部署平台；只统一它们的开发运行接口和可复用实现。

## 2. 当前范围

首批盘点仓库：

| 仓库 | 技术/用途 | 迁移优先级 | 备注 |
| --- | --- | --- | --- |
| `QX_Web_V4_Backend` | Spring Boot | P0 | 与 `AUSCompanyDS` 的运行脚本高度重复 |
| `AUSCompanyDS` | Spring Boot + Python Worker | P0 | 与 `QX_Web_V4_Backend` 共同验证 Spring 适配器 |
| `Website-WordPress-Backend` | WordPress | P1 | 已有可抽取的 Compose 工具层 |
| `QX_Web_V4_Admin` | Vite/React | P1 | 前端 Compose 生命周期的简单样本 |
| `QX_Web_V4_WWW` | Next.js | P2 | 有构建元数据和跨仓 E2E 特例 |
| `QX_Web_V4_ImageUtil` | Go 服务 | P2 | 有运行配置复制与 SQLite 初始化特例 |
| `DevAuthServer` | Keycloak | P2 | 有启动后 realm / 用户初始化流程 |
| `QX_Web_V4_Ops` | 容器化 CLI | P3 | 应使用任务型适配器，而非常驻服务适配器 |

`AUSCompanyDS_Admin` 当前本机路径未发现，待其可访问后另行盘点。

## 3. 设计原则

1. **配置优于复制。** 业务仓库提供 `devkit.config.mjs`，不再复制通用 Node 脚本。
2. **核心保持技术栈无关。** Core 只认识命令、环境、进程和 Docker Compose；Spring、WordPress、Go 等由适配器处理。
3. **保留业务特例。** 初始化、健康检查、E2E 联调等通过 hooks/adapter 扩展，不进入通用 Compose 流程。
4. **跨平台优先。** 支持 Windows 与 Linux；集中处理 `docker`/`docker.exe`、子进程与退出码。
5. **安全且可预测。** 不自动删除 volume，不覆盖本地配置；破坏性动作必须由显式参数触发。
6. **渐进迁移。** 每次只迁一个仓库；新旧入口可并存，验证后再删除旧脚本。
7. **可版本化回滚。** 母仓库作为私有 npm 包发布，消费方锁定明确版本。

## 4. 命令契约

### 基础命令

| 命令 | 含义 |
| --- | --- |
| `up <dev|stag|prod>` | 启动指定环境；dev 默认前台，stag/prod 默认后台（可由配置覆盖） |
| `down <env>` | 停止指定环境 |
| `logs <env>` | 跟随服务日志 |
| `ps <env>` | 查看服务状态 |
| `build <env>` | 构建该环境所需镜像或产物 |
| `task <name> [-- ...args]` | 在宿主机或指定容器执行 lint、test、format、CLI 等任务 |

### 统一参数语义

| 参数 | 语义 |
| --- | --- |
| `--build` | 启动前构建镜像 |
| `--pull` | 启动前拉取可拉取的镜像 |
| `--no-cache` | 仅用于 Docker 构建的无缓存构建 |
| `--reset-data` | 清理开发数据卷；仅允许 dev，且需要明确确认机制 |
| `--detach` / `--foreground` | 覆盖默认前后台运行方式 |

禁止继续以 `--no-cache` 表示 pull、重启或数据清理等不同动作。

### package.json 目标入口

```json
{
  "scripts": {
    "dev": "snowsy-runtime up dev",
    "stag": "snowsy-runtime up stag",
    "prod": "snowsy-runtime up prod",
    "down": "snowsy-runtime down dev",
    "logs": "snowsy-runtime logs dev",
    "ps": "snowsy-runtime ps dev",
    "build": "snowsy-runtime build dev",
    "test": "snowsy-runtime task test"
  }
}
```

任务型仓库（例如 Ops）可以不实现 `up`，而将 `dev/stag/prod` 映射为带环境 profile 的 `task`。

## 5. 目标架构

```text
业务仓库 package.json
        |
        v
snowsy-runtime CLI
        |
        +-- runtime-core       参数解析、环境加载、子进程、日志、错误
        +-- compose-runtime    compose 文件、profile、project name、up/down/build
        +-- adapters           spring-local / compose-service / compose-task
        +-- hooks              beforeUp / afterUp / beforeDown / afterDown
        |
        v
业务仓库 devkit.config.mjs + docker/compose*.yml
```

建议包划分：

```text
packages/
  runtime-core/       # 不依赖 Docker 的通用能力
  compose-runtime/    # Docker Compose 实现
  runtime-cli/        # snowsy-runtime 命令行入口
  adapter-spring/     # Maven、本地 JVM、基础设施健康检查
templates/
  compose-service/
  spring-service/
  compose-task/
```

首期可先用单 npm package 实现以上目录边界；稳定后再按需要拆包。

## 6. 业务配置模型（草案）

```js
export default {
  project: "qx-web-v4-backend",
  compose: {
    file: "docker/compose.yml",
    projectName: "qx-web-v4-backend-{mode}",
  },
  envFiles: [".env", ".env.local", ".env.{mode}", ".env.{mode}.local"],
  environments: {
    dev: {
      adapter: "spring-local",
      profile: "dev",
      infrastructure: ["postgres", "pgadmin"],
      foreground: true,
    },
    stag: { adapter: "compose-service", profile: "stag", services: ["app-stag"] },
    prod: { adapter: "compose-service", profile: "prod", services: ["app-prod"] },
  },
  tasks: {
    test: { adapter: "compose-task", profile: "test", service: "app-test", command: ["npm", "test"] },
  },
};
```

环境变量加载顺序待实现时固化为：系统环境变量最高；之后由低到高依次为 `.env`、`.env.{mode}`、`.env.local`、`.env.{mode}.local`。不得覆盖已存在的系统环境变量。

## 7. 分阶段计划

### Phase 0：规范冻结与样本确认

- [ ] 确认工具包名称、私有 npm 发布位置和 Node.js 最低版本。
- [ ] 确认基础命令与参数语义，以本文件第 4 节为候选契约。
- [ ] 确认 Compose project name 命名规则：`{project}-{mode}`。
- [ ] 定义 secrets、本地环境文件、示例配置文件的命名与优先级。
- [ ] 为每类适配器选定一个黄金样本仓库。

验收：命令契约与配置 schema 经确认，不再在各业务仓库自行扩展同义命令。

### Phase 1：母仓库 MVP

- [ ] 初始化 npm workspace、ESM、Prettier、测试框架和 CI。
- [ ] 实现 CLI 参数解析、标准日志、退出码透传和跨平台 Docker 命令检测。
- [ ] 实现环境文件加载与变量插值。
- [ ] 实现 Compose `up/down/build/logs/ps/run`。
- [ ] 实现 profile、service、project name、foreground/detach 支持。
- [ ] 为无 Docker、缺少 Compose 文件、非法环境、Docker 失败等场景添加测试。
- [ ] 提供 `compose-service` 模板与示例仓库配置。

验收：一个最小 Compose 服务能仅通过配置完成 `dev/stag/prod/down/logs/ps`。

### Phase 2：Spring 适配器与首批迁移

- [ ] 实现 `spring-local`：Docker 基础设施启动、健康检查、本地 Maven/JVM 启动、PID 生命周期。
- [ ] 设计通用 healthcheck 接口（container health、HTTP、one-shot container）。
- [ ] 迁移 `QX_Web_V4_Backend`，保留旧入口作为兼容包装。
- [ ] 迁移 `AUSCompanyDS`，验证配置可覆盖数据库复位变量、服务列表与 PID 名称。
- [ ] 对比新旧脚本在 dev/stag/prod/start/stop/test 的实际 Docker 命令与行为。

验收：两个 Spring 仓库删除绝大部分重复 `start.js` / `stop.js` 实现，开发流程无行为回归。

### Phase 3：Compose 服务和任务迁移

- [ ] 迁移 `Website-WordPress-Backend`，将现有 `compose-utils.mjs` 收入通用层。
- [ ] 迁移 `QX_Web_V4_Admin`，覆盖前端常驻服务与容器内测试任务。
- [ ] 实现 `compose-task`，迁移 `QX_Web_V4_Ops` 的 build/check/CLI 运行方式。
- [ ] 统一 `format/lint/test/build` 的任务声明格式。

验收：前三类适配器均有真实业务仓库使用，业务仓库只保留配置和业务专属 hook。

### Phase 4：复杂特例与工程化

- [ ] 迁移 `QX_Web_V4_WWW`：构建元数据与可选后端 E2E 联调 hook。
- [ ] 迁移 `QX_Web_V4_ImageUtil`：运行配置初始化、SQLite 数据策略。
- [ ] 迁移 `DevAuthServer`：Keycloak ready 检查和 realm/用户初始化 hook。
- [ ] 逐步移除不必要的 `container_name`，以 project name 避免多环境冲突。
- [ ] 增加配置 schema 校验、迁移检查命令与文档站。

验收：复杂仓库的专用逻辑均以明确扩展点实现，核心不出现仓库名或业务变量名。

### Phase 5：发布与治理

- [ ] 建立语义化版本、变更日志和发布流水线。
- [ ] 每个适配器维护集成测试 fixture。
- [ ] 增加 `doctor` 命令检查 Node、Docker、Compose、端口及配置。
- [ ] 制定兼容窗口和弃用策略。
- [ ] 建立新仓库接入模板与评审清单。

验收：新仓库可在不复制脚本的情况下接入；升级可以锁版本、验证、回滚。

## 8. 风险与处理策略

| 风险 | 处理策略 |
| --- | --- |
| 一次性改动所有仓库导致难以定位回归 | 单仓渐进迁移，新旧入口并存一段时间 |
| 通用层吞没业务差异 | 使用 adapter 和 lifecycle hook，不向 core 添加业务判断 |
| 固定 `container_name` 造成并行环境冲突 | CLI 始终指定 project name；逐步移除固定容器名 |
| 环境文件被启动脚本覆盖 | 仅在显式 `init` 时创建；运行时不覆写本地文件 |
| Docker、Node、Maven 的平台差异 | 所有命令经过统一 process 层；在 Windows/Linux CI 验证 |
| 母仓库升级影响多个项目 | 私有包锁定版本、semver、fixture 集成测试、分批升级 |

## 9. Definition of Done

- [ ] 每个接入仓库都能通过标准 `npm run dev/stag/prod` 执行预期流程。
- [ ] Compose 生命周期、环境文件加载、参数校验和错误处理不再复制维护。
- [ ] 业务差异全部位于配置、adapter 或 hook，且有测试覆盖。
- [ ] 所有破坏性数据操作均需显式参数，且只允许开发环境。
- [ ] 母仓库与至少两个不同技术栈的真实仓库具备端到端验证。
- [ ] 包发布、升级、回滚和新仓接入流程有文档。
