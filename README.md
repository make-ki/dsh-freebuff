# dsh-freebuff

把 [freebuff](https://github.com/CodebuffAI/freebuff)（CodebuffAI 的免费 AI 助手）的免费 **DeepSeek V4 Flash** 额度，以 DSH 模型提供方（provider）的形式接入 DeepSeek Harness —— 在 Web 的模型设置页里直接选用 `Freebuff` 提供商，免费对话。

> ⚠️ **风险声明**：本项目逆向并代理了 freebuff 的桌面/CLI 协议，**违反 freebuff 服务条款（ToS）**。存在账号封禁（终态、不可恢复）风险。仅供个人学习与测试使用，请勿商业化、勿大规模滥用，使用者自行承担全部后果。

## 工作原理

freebuff 官方没有公开 API，只有 CLI / Desktop / Chat。本插件在 DSH 进程内重实现官方客户端的 HTTP 协议（协议事实，非代码搬运）：

```
session(POST /api/v1/freebuff/session) → agent-runs(START 主 agent + context-pruner) → chat/completions(强制流式 SSE)
```

并实现 `@deepseek-ai/dsh-llm` 的 `LlmAdapter`，注册为 `ctx.llm` 的 `freebuff` 提供商。DSH 对话/会话标题/上下文压缩全部走流式，天然契合上游强制流式。

## 安装

> 前提：已安装 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)，Node ≥ 20，PATH 中有 `dsh` 与 `pnpm`。

### 方式 A：`dsh plugin add` + 一键装配（推荐）

```bash
# 1) 装依赖 + 自动解析 peer（tgz 在仓库根目录；发布到 npm 后可直接用包名）
dsh plugin --profile web add D:/developing/DSH-plugin/dsh-freebuff/dsh-freebuff-0.1.0.tgz

# 2) 写入 bundle 装配（幂等）+ 打印重启指引
node D:/developing/DSH-plugin/dsh-freebuff/scripts/install.mjs --profile web

# 3) 重启 dsh web
```

`dsh plugin add` 会把参数转发给 profile 目录里的 pnpm（已用 pnpm 11 实测：+13 依赖，含全部 `@deepseek-ai/*` peer，加载验证通过）。若 registry 下载报错（`UND_ERR_DESTROYED` 等），给 pnpm 显式指定代理：

```bash
dsh plugin --profile web add <tgz> --proxy http://127.0.0.1:10808 --https-proxy http://127.0.0.1:10808
```

> `scripts/install.mjs` 只做 bundle 装配时：`node scripts/install.mjs --profile web`（自动把 `dsh-freebuff` 幂等写入 `dsh.profile.bundles`）。
> 包内的 `dsh.bundle.patch` 指向 `cordis.patch.yml`，装配时会自动插入 `llm-freebuff` 插件行。

### 方式 B：源码构建 + 注入（开发迭代）

```bash
npm install
npm run build          # 或 bash scripts/build.sh
dev_inject_plugin <本目录>
```

### 安装后

1. 重启 dsh web
2. 打开 **Web 模型设置页 → 提供商 Freebuff → `deepseek/deepseek-v4-flash`**
3. 发一条消息验证（无需额外配置：凭证自动复用官方 CLI 的 `~/.config/manicode/credentials.json`）

### 排障

| 现象 | 处理 |
|---|---|
| 请求失败 `ECONNREFUSED <端口>` | 看日志中 `llm-freebuff: upstream proxy source=... url=...` 行确认走的是哪个代理；系统残留 `HTTPS_PROXY` 可能导致走错端口 → 在 设置 → Freebuff → `upstreamProxy` 显式填写（如 `http://127.0.0.1:10808`） |
| `MISSING_CREDENTIAL` | 未找到账号：设置里填 `accounts`，或导出 `FREEBUFF_TOKEN`，或用官方 CLI 登录 |
| 提示账号被 ban / 额度耗尽 | 免费账号额度按「session」计（标准池每天 6 次、1 小时/次）；该账号被冷却 `retryAfterMs`；改用多账号（`FREEBUFF_TOKEN` 逗号分隔） |
| 免费模型须 US 出口 IP | 确保代理节点在完整模式国家；否则为受限模式（每天 6 个 session） |

### 卸载

```bash
dsh plugin --profile web remove dsh-freebuff   # 移除依赖
# 并把 dsh-freebuff 从 ~/.dsh/profiles/web/package.json 的 dsh.profile.bundles 中删掉
```

## 账号配置（三选一，按优先级）

1. **插件设置**：设置 → Freebuff → `accounts`（`{token, email?}` 数组；界面自动生成）
2. **环境变量**：`FREEBUFF_TOKEN=tok1,tok2`（逗号分隔多账号）
3. **自动读取官方 CLI 凭证**：默认读取 `~/.config/manicode/credentials.json`（本机若装过 freebuff CLI 并登录过，开箱即用）

Token 获取：运行官方 CLI 登录后自动写入 `~/.config/manicode/credentials.json`；或参考 `research/freebuff2api/freebuff_tools/extract_freebuff.py` 的设备码流程。

## 配置项（Settings > Freebuff，`llm-freebuff`）

| 字段 | 默认 | 说明 |
|---|---|---|
| `accounts` | `[]` | 显式 token 列表（优先于 env/文件） |
| `tokenEnv` | `FREEBUFF_TOKEN` | 环境变量名 |
| `tokenFile` | `~/.config/manicode/credentials.json` | CLI 凭证文件 |
| `baseURL` | `https://www.codebuff.com` | 上游地址 |
| `upstreamProxy` | `''` | 显式 http(s) 代理；空 = 自动读 `DSH_PROXY_HTTPS` → `HTTPS_PROXY` → `HTTP_PROXY`。**免费模型要求 US 出口 IP，请确保代理节点在完整模式国家** |
| `models` | 5 个官方模型 | 目录（id/session/agent/contextWindow/maxTokens） |
| `maxTokens` / `defaultContextWindow` | 65536 / 393216 | 输出上限与上下文窗口 |
| `reasoningEffort` | `high` | 默认推理档位（flash 支持 low/high/max） |
| `streamIdleTimeoutMs` | 300000 | 流空闲超时 |
| `retryPolicy` | — | 重试策略 |

## 默认模型

| 模型 | 上游 agent | 额度池 |
|---|---|---|
| `deepseek/deepseek-v4-flash` | `base2-free-deepseek-flash` | 非 Premium（STD 池，每天 6 次 session，1 小时/次） |
| `deepseek/deepseek-v4-pro` | `base2-free-deepseek` | Premium 池 6 次/天 |
| `minimax/minimax-m3` | `base2-free-minimax-m3` | Premium 池 6 次/天 |
| `openai/gpt-5.6-luna` | `base2-free-luna` | Premium 池 6 次/天 |
| `mimo/mimo-v2.5` | `base2-free-mimo` | 非 Premium（STD 池） |

配额按「创建 session」扣减：一个 session 约 1 小时，期内多轮对话不重复扣；插件复用活跃 session，不浪费额度。多账号（`FREEBUFF_TOKEN` 逗号分隔）自动轮换 + 冷却。

## 注意事项 / 已知限制

- **单账号同时只能一个在线客户端**：插件内全局串行队列 + 每账号流锁，避免顶号（`428 waiting_room_required` / `409 session_superseded`）。
- 免费通道对并发敏感：上游短请求 300ms 间隔串行。
- OpenRouter 式并发桶：Flash/MiMo 每用户最多 3 个并发 tab —— DSH 单会话串行已天然满足。
- 上游 system 消息必须以 `You are Buffy, the strategic coding assistant.` 开头（插件自动注入前缀，不影响 harness 提示词）。
- 工具调用：自动混入官方 `end_turn` 签名工具，规避 `foreign_toolset` 校验。
- 账号被封（`status: banned`）为终态，插件会以 `AUTH` 错误提示。

## 冒烟测试

```bash
UPSTREAM_PROXY=http://127.0.0.1:10808 node test/smoke.mjs "Reply with exactly: OK"
# 通过 = session/agent-runs/chat 全链路可用（会占用一次 session 额度）
```

## 许可与免责

**Apache License 2.0**。代码为独立实现：协议事实来源于官方 [CodeBuffAI/freebuff](https://github.com/CodeBuffAI/freebuff) 源码（MIT）与社区 [freebuff2api-wokers](https://github.com/pingmike2/freebuff2api-wokers)（AGPL-3.0，仅作协议对照、未复制代码；参考代码不入库）；DSH 适配结构参考官方 [@deepseek-ai/dsh-llm-deepseek](https://github.com/deepseek-ai/deepseek-harness)（MIT）。详细调研见 `docs/调研报告.md`。

**风险与合规**：本项目逆向并代理了 freebuff 的桌面/CLI 协议，**违反 freebuff 服务条款（ToS）**，存在账号封禁（终态、不可恢复）风险。本项目按 Apache-2.0 的免责条款以 "AS IS" 提供，**不提供任何担保**，作者对任何账号损失、法律纠纷或使用后果不承担任何责任。请仅供个人学习研究使用，切勿商业化或大规模滥用。