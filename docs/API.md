# J-Board API

本文整理当前有效的 HTTP Route Handlers 和内部 Server Actions。对外 HTTP 结构化描述见 `docs/openapi.yaml`。

## 1. 通用约定

- 用户会话：NextAuth Cookie
- 管理接口：必须是管理员会话
- 探测接口：`Authorization: Bearer <probe-token>`
- 返回格式：JSON，文件下载接口除外
- 时间字段：ISO 8601 字符串

## 2. 认证

### `POST /api/auth/register`

注册普通用户。

请求体：

```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "Alice",
  "inviteCode": "optional",
  "turnstileToken": "optional"
}
```

### `GET|POST /api/auth/[...nextauth]`

NextAuth 内置登录、登出、会话接口。

## 3. 公共数据

### `GET /api/public/app-info`

返回站点名称、注册策略、维护公告、Turnstile 配置等公开信息。

### `GET /api/latency?nodeId=<id>`

返回节点最新三网延迟。

### `GET /api/latency/history?nodeId=<id>&carrier=telecom&range=7d`

返回节点延迟历史，`range` 支持 `1d`、`7d`、`30d`。

### `GET /api/traces?nodeId=<id>`

返回节点三网路由追踪结果。

## 4. 支付

### `GET /api/payment/providers`

返回当前启用的支付方式。

### `POST /api/payment/create`

为待支付订单创建支付参数。

请求体：

```json
{
  "orderId": "order-id",
  "provider": "epay"
}
```

### `GET /api/payment/order/{orderId}`

查询当前用户自己的订单支付状态。

### `GET /api/payment/query/{tradeNo}`

按支付流水号查询支付状态。

### `GET|POST /api/payment/notify/{provider}`

支付平台异步通知入口。

## 5. 管理导出与节点读取

### `GET /api/admin/nodes`

返回节点和已同步入站的简要信息。

### `GET /api/admin/nodes/{id}/inbounds`

返回指定节点的已同步入站。

### `GET /api/admin/export/config`

导出配置快照，包含站点设置、公告、服务、套餐、节点、入站、支付配置等。

### `GET /api/admin/export/audit-logs?q=<keyword>`

导出审计日志。

### `GET /api/admin/backup/database`

导出 SQL 数据库备份。

## 6. 探测上报

以下接口由 `agent/jboard-agent` 调用，探测 Token 存储在 `NodeServer.agentToken` 中并加密保存。

### `POST /api/agent/latency`

请求体：

```json
{
  "latencies": [
    { "carrier": "telecom", "latencyMs": 35 },
    { "carrier": "unicom", "latencyMs": 42 },
    { "carrier": "mobile", "latencyMs": 28 }
  ]
}
```

行为：更新 `NodeLatency` 并写入 `NodeLatencyLog`。

### `POST /api/agent/trace`

请求体：

```json
{
  "traces": [
    {
      "carrier": "telecom",
      "hops": [{ "hop": 1, "ip": "*", "geo": "", "latency": 0 }],
      "summary": "CN2 GIA",
      "hopCount": 12
    }
  ]
}
```

行为：按 `nodeId + carrier` 更新 `RouteTrace`。

## 7. 订阅与附件

### `GET /api/subscription/{id}?token=<downloadToken>`

无需会话，但必须提供合法下载 token。成功返回 `text/plain` 订阅内容。

### `GET /api/support/attachments/{id}`

工单附件访问接口，要求登录用户是附件所属工单用户本人或管理员。加 `?download=1` 可触发下载。

## 8. Server Actions

Server Actions 是后台和用户端写操作的主要入口。所有管理动作必须经过 `requireAdmin()`，用户动作必须校验资源归属。

### 管理端

节点：`src/actions/admin/nodes.ts`

- `createNode(formData)`：创建 3x-ui 节点并同步入站
- `updateNode(id, formData)`：更新 3x-ui 节点连接信息并重新同步入站
- `deleteNode(id)`：删除节点及本地关联数据
- `testNodeConnection(id)`：测试 3x-ui 登录并同步入站
- `batchTestNodeConnections(formData)`：批量测试并同步节点
- `updateInboundDisplayName(id, formData)`：修改同步入站的前台展示名称
- `deleteInbound(id)`：仅删除本地入站镜像，不删除 3x-ui 入站
- `generateAgentToken(nodeId)`：生成探测 Token
- `revokeAgentToken(nodeId)`：撤销探测 Token

订阅：`src/actions/admin/subscriptions.ts`

- `suspendSubscription(id)`：暂停订阅，并通过 3x-ui 禁用代理客户端
- `activateSubscription(id)`：恢复订阅，并通过 3x-ui 启用代理客户端
- `cancelSubscription(id)`：取消订阅
- `deleteSubscriptionPermanently(id)`：删除订阅，并通过 3x-ui 删除代理客户端
- `reassignStreamingSlot(...)`：调整流媒体槽位
- `batchSubscriptionOperation(formData)`：批量处理订阅

订单：`src/actions/admin/orders.ts`

- `confirmOrder(orderId)`：手动确认订单并触发开通
- `cancelOrder(orderId)`：取消订单
- `updateOrderReview(...)`：更新风控/复核状态
- `batchOrderOperation(formData)`：批量操作订单

其他管理动作：

- 用户：`src/actions/admin/users.ts`
- 套餐：`src/actions/admin/plans.ts`
- 流媒体服务：`src/actions/admin/services.ts`
- 支付配置：`src/actions/admin/payments.ts`
- 公告：`src/actions/admin/announcements.ts`
- 工单：`src/actions/admin/support.ts`
- 系统设置：`src/actions/admin/settings.ts`
- 备份恢复：`src/actions/admin/backups.ts`
- 任务重试：`src/actions/admin/tasks.ts`
- 流量视图刷新：`src/actions/admin/traffic.ts`
- 优惠券与促销：`src/actions/admin/commerce.ts`

### 用户端

- `src/actions/user/purchase.ts`：立即购买、续费、增流量、查询库存
- `src/actions/user/cart.ts`：加入购物车、移除、清空、结算
- `rotateSubscriptionAccess(subscriptionId)`：重置代理订阅访问凭据，并同步更新 3x-ui 客户端
- `src/actions/user/account.ts`：资料、密码、邀请码
- `src/actions/user/notifications.ts`：已读、删除、清空
- `src/actions/user/support.ts`：创建、回复、关闭、删除工单
- `src/actions/user/orders.ts`：取消待支付订单、重新选择支付方式

### 约定

- 写操作必须做权限校验和输入校验
- 重要副作用必须记录审计日志
- 影响页面展示后必须 `revalidatePath`
- 代理客户端变更必须通过 `src/services/node-panel` 同步 3x-ui
- 不再新增节点控制面、运行配置下发、进程管理类 Action
