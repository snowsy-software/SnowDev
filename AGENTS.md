# SnowDev 协作规范

## 项目定位

SnowDev 是一个以 Node.js 为运行时的开源开发工作流编排工具。它围绕消费项目**自行维护**的 Docker Compose、环境文件和开发任务提供统一命令；它不拥有、更不生成业务应用、Compose 拓扑、密钥或部署基础设施。

开始任何改动前，先阅读 [docs/README.md](docs/README.md)，再根据任务类型阅读对应正式规范。

## 必须遵守

1. 先阅读相关源码、测试和规范；优先复用既有模式。
2. 保持 core 与 consumer custom 的边界：本仓库只实现通用编排能力，业务仓库只提供 `snowdev.config.mjs`、Compose 文件和受控配置。
3. 所有子进程必须使用可执行文件加参数数组，禁止 `shell: true`、拼接 shell 命令或依赖平台专属 shell。
4. 所有 Compose 调用必须显式携带 project name、Compose file 与 profile。
5. 不记录、提交或发布密码、token、私钥、真实环境文件、客户/内部域名、端口、镜像或基础设施拓扑；日志先经脱敏处理。
6. 不实现隐式 `down`、volume 删除或其他破坏性行为。危险操作必须属于明确命令，并具备影响说明及 `--yes` 保护。
7. 新增或修改公开 API、配置字段、环境优先级、错误码或 CLI 行为时，必须同步更新类型、JSDoc、测试和文档。
8. 每次改动至少运行相关测试；提交前运行 `npm run typecheck`、`npm run lint`、`npm test` 和 `npx prettier --check .`。

## 禁止事项

1. 不复制参考业务项目的专有代码、配置、密钥或运行资产。
2. 不在配置中加入任意 shell 字符串、静默 fallback、mock 主路径或未经约束的 hook。
3. 不以“当前机器可运行”为由绕过 Windows/Linux 参数边界测试。
4. 不在未获维护者授权时执行 `npm publish` 或变更仓库可见性。

## 变更完成标准

完成说明应包含：改动的契约或边界、验证命令及结果、未执行检查的原因（如有），以及需要消费者迁移的配置变更。
