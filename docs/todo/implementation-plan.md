# Snowsy CLI 分步实现方案

## 目标

交付一个名为 `snowsy` 的 Go 二进制，统一调用 Docker Compose 和本地运行时。业务仓库通过 `snowsy.json` 配置常规行为；仅在 JSON 无法表达的少数场景中使用 `snowsy.lua` hook。

首个可用版本的范围是：

```text
snowsy up <dev|stag|prod>
snowsy down <dev|stag|prod>
snowsy build <dev|stag|prod>
snowsy logs <dev|stag|prod>
snowsy ps <dev|stag|prod>
snowsy task <name> [-- <arguments>]
snowsy doctor
```

## 前置决策

- 命令名暂定 `snowsy`；发布前检查是否与现有内部命令冲突。
- Go module 路径待 Git 远程仓库确定后设置；首期最低支持 Go 1.24。
- 配置文件固定为仓库根目录 `snowsy.json`。
- Lua runtime 选择纯 Go 实现，避免要求开发机额外安装 Lua。
- CLI 只运行显式配置的命令；不执行配置外的任意 shell 字符串。
- CI 和开发机均应使用仓库 `snowsy.json.requires.snowsy` 允许范围内的固定 release 版本。

## Milestone 1：项目骨架与发布最小闭环

### 实现

- [ ] 创建 `go.mod`、`cmd/snowsy/main.go`、`internal/`、`schemas/`、`templates/`。
- [ ] 使用 Cobra 或标准库实现根命令、`--version`、`--help`、统一错误格式。
- [ ] 加入 `version`、`commit`、`date` 的 ldflags 注入。
- [ ] 配置 `gofmt`、`go vet`、单元测试和 GitHub Actions。
- [ ] 配置 GoReleaser 或等价流程，产出 Windows amd64/arm64、Linux amd64/arm64、macOS arm64 二进制和校验和。
- [ ] 产出 `snowsy version` 与 `snowsy completion`。

### 验收

- [ ] 空仓库可构建并执行 `snowsy --version`。
- [ ] 每次 tag 都能产生可下载、带 checksum 的跨平台 release。

## Milestone 2：配置加载与校验

### 实现

- [ ] 定义 Go struct：`ProjectConfig`、`ComposeConfig`、`EnvironmentConfig`、`TaskConfig`、`HookConfig`。
- [ ] 编写 `schemas/snowsy.schema.json`，支持编辑器自动补全和 CI 校验。
- [ ] 实现从当前目录向上寻找 `snowsy.json`，并以配置文件所在目录作为工作根目录。
- [ ] 解析 `{mode}` 变量，校验 project、profile、服务、任务名称。
- [ ] 实现 CLI 版本约束检查；不满足时显示当前版本、所需范围和升级建议。
- [ ] 读取但不写入环境文件，按固定优先级合并，且系统环境变量永远优先。
- [ ] 实现 `snowsy config validate` 和 `snowsy config show <env>`（敏感变量值脱敏）。

### 验收

- [ ] 配置缺失、非法 JSON、未知 adapter、未知环境、非法版本约束都会有可操作错误信息。
- [ ] 单元测试覆盖环境文件优先级、变量展开和 path 解析。

## Milestone 3：安全的进程与 Docker Compose 层

### 实现

- [ ] 实现统一 `Runner`：工作目录、环境、标准输入输出、退出码、取消信号转发。
- [ ] Windows 使用 `docker.exe`，其他系统使用 `docker`；不启用 shell 拼接执行。
- [ ] 实现 Docker/Compose 可用性探测：`docker version`、`docker compose version`。
- [ ] 实现 Compose 参数生成：`-p <project>`、`-f <file>`、`--profile <profile>`。
- [ ] 支持 `up/down/build/logs/ps/run/pull`，服务数组以参数列表传递。
- [ ] `down --reset-data` 仅在 dev 生效，并在交互终端要求确认；CI 必须额外传入 `--yes`。
- [ ] 将实际执行命令以可复制、脱敏的形式输出。

### 验收

- [ ] 用 fixture Compose 项目验证每个子命令构造的 argv。
- [ ] Ctrl+C 能终止前台 `docker compose up` 并返回正确退出码。
- [ ] 不会通过 shell 执行 JSON 或环境变量中的字符串。

## Milestone 4：第一个适配器 compose-service

### 实现

- [ ] 实现 `compose-service` adapter：按环境配置执行 build、pull、down、up。
- [ ] 实现前台/后台默认值：dev 前台，stag/prod 后台；允许配置覆盖。
- [ ] 实现明确参数：`--build`、`--pull`、`--no-cache`、`--detach`、`--foreground`。
- [ ] 实现任务声明：宿主命令和 Compose `run --rm <service> <argv...>` 两种类型。
- [ ] 提供 `templates/compose-service/snowsy.json`。
- [ ] 为 `Website-WordPress-Backend` 创建不提交业务改动的候选配置，逐项和旧 `compose-utils.mjs` 对照。

### 验收

- [ ] WordPress 样本以新 CLI 完成 dev/stag/prod/down/logs/ps。
- [ ] 前台与后台行为、Compose profile、环境文件效果与旧脚本一致。

## Milestone 5：Spring local 适配器

### 实现

- [ ] 实现 `spring-local` adapter：启动 dev 基础设施、等待健康检查、启动 Maven Wrapper/JVM、写入 PID 状态。
- [ ] 定义健康检查类型：Compose health、HTTP ready、one-shot container exit code。
- [ ] 实现可配置启动文件初始化：只在 `init` 或文件缺失时从示例复制，绝不在普通启动中覆写。
- [ ] 实现优雅关闭 hook：HTTP shutdown、等待 health 失效、PID fallback、最终 Compose down。
- [ ] 支持每仓库不同的基础设施服务、端口、PID 文件和环境变量名。
- [ ] 为 `QX_Web_V4_Backend` 和 `AUSCompanyDS` 分别建立候选 `snowsy.json`。

### 验收

- [ ] 两个仓库均能替代现有 dev/stag/prod/stop 行为。
- [ ] 两者的差异只存在于 JSON 配置，不存在复制的 Go 或 Node 实现。

## Milestone 6：Lua hooks（在真实特例出现后实施）

### 实现

- [ ] 嵌入 Lua runtime，加载仓库根目录的 `snowsy.lua`。
- [ ] 定义固定 hook：`before_up`、`after_up`、`before_down`、`after_down`、`before_task`、`after_task`。
- [ ] 只暴露受限 API：读取已合并环境、检查路径、HTTP 健康检查、执行已声明任务、打印日志。
- [ ] 不暴露任意文件写入、任意 shell 执行和网络凭据读取能力；如确有需要，先扩展显式且可审计的 API。
- [ ] 为每个 hook 设置超时、错误栈格式和 dry-run 行为。

### 验收

- [ ] `DevAuthServer` 的 Keycloak 初始化或 `QX_Web_V4_WWW` 的后端 E2E 发现逻辑可作为样本实现。
- [ ] 普通 Compose 项目完全不需要 Lua 文件。

## Milestone 7：迁移与兼容层

### 实现顺序

1. [ ] `QX_Web_V4_Backend`
2. [ ] `AUSCompanyDS`
3. [ ] `Website-WordPress-Backend`
4. [ ] `QX_Web_V4_Admin`
5. [ ] `QX_Web_V4_Ops`
6. [ ] `QX_Web_V4_WWW`
7. [ ] `QX_Web_V4_ImageUtil`
8. [ ] `DevAuthServer`

### 每仓迁移清单

- [ ] 写入 `snowsy.json`，并通过 `snowsy config validate`。
- [ ] 保留原 `package.json` 命令名，但改为调用 `snowsy`。
- [ ] 将原脚本中不可声明的部分迁到 Lua hook 或新增 adapter。
- [ ] 对照旧脚本运行一次 dev、stag、prod、down、logs、build、test。
- [ ] 验证本地配置不会被修改，数据卷不会被意外删除。
- [ ] 在 CI 固定 CLI 版本并执行 smoke test。
- [ ] 经一个发布周期验证后，删除被替代的旧通用脚本。

## Milestone 8：治理与日常使用

- [ ] 增加 `snowsy doctor`：CLI、Docker、Compose、端口、配置、可选 Node/JDK/Go 检查。
- [ ] 新增 `snowsy init`，从模板生成 `snowsy.json`，不覆盖现有文件。
- [ ] 在 CI 维护跨适配器 fixture 测试矩阵。
- [ ] 采用 semver；不兼容配置变更必须升级 `schemaVersion`。
- [ ] 发布说明列出新增、修复、弃用和迁移步骤。
- [ ] 对 CLI 二进制进行 checksum 校验；后续再评估签名和自动更新。

## 首个 PR 建议

首个 PR 不接入业务仓库，只完成 Milestone 1 和 Milestone 2 的最小子集：Go CLI 骨架、`snowsy.json` 读取、`config validate`、`--version`、schema、fixture 测试和 CI。这样先固化配置契约，再开始接触 Docker 生命周期与真实业务仓库。
