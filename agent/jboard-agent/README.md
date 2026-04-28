# jboard-agent

`jboard-agent` 只负责节点探测上报：

- 三网 TCP 延迟：`POST /api/agent/latency`
- 三网路由跟踪：`POST /api/agent/trace`

节点入站、客户端开通、暂停、删除、流量限制等配置均由 3x-ui 面板维护。J-Board 后端不向节点下发 Xray/Hy2 配置。

## 构建

```bash
go test ./...
make build
make build-linux
```

## 运行

```bash
SERVER_URL=https://your-domain.com \
AUTH_TOKEN=后台生成的探测Token \
./jboard-agent
```

可选环境变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `LATENCY_INTERVAL` | `5m` | 延迟探测间隔，支持 `30s`、`5m` 或秒数 |
| `TRACE_INTERVAL` | `30m` | 路由探测间隔，支持 `30m` 或秒数 |

路由探测依赖 `nexttrace` 命令；延迟探测无需额外依赖。

## systemd

推荐从 J-Board 后台节点页复制一键安装命令。该命令会下载 release 二进制、安装 `nexttrace`、写入 systemd 服务并启动。

## 延迟算法

延迟探测使用三组 zstaticcdn 运营商目标，先解析域名再开始计时，只统计 TCP connect 耗时，避免 DNS 抖动混入延迟；当单次结果超过 1000ms 时会额外重试最多 3 次并采用更低的有效结果。
