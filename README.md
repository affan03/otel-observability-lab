# otel-observability-lab

A full observability stack built from scratch on AWS EC2. This project instruments a Node.js API with OpenTelemetry and wires up Prometheus, Jaeger, Loki, and Grafana to collect, store, and visualize metrics, traces, and logs — all running via Docker Compose.

Built for learning. Every decision is intentional and documented.

---

## What This Project Covers

| Pillar | Tool | What it does |
|---|---|---|
| Metrics | Prometheus + Grafana | Scrapes /metrics every 15s, stores time-series, PromQL queries |
| Traces | Jaeger | Receives spans via OTLP HTTP, stores traces, UI for exploration |
| Logs | Loki + Promtail | Promtail tails log files, ships to Loki, LogQL queries in Grafana |
| Visualization | Grafana | Queries all three backends, RED dashboard, log panels |
| Instrumentation | OpenTelemetry SDK | Auto-instruments Express, exports traces + metrics + log correlation |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Docker Network (otel-network)       │
│                                                      │
│  ┌──────────────┐  traces (OTLP HTTP)  ┌──────────┐ │
│  │  Node.js App │ ──────────────────── │  Jaeger  │ │
│  │   :3001      │                      │  :16686  │ │
│  │              │  /metrics scrape      └──────────┘ │
│  │   OTel SDK   │ ◄──────────────────  ┌──────────┐ │
│  │              │                      │Prometheus│ │
│  └──────┬───────┘                      │  :9090   │ │
│         │ JSON logs                    └────┬─────┘ │
│         ▼                                   │        │
│  ┌──────────────┐                           │        │
│  │  logs/       │◄── Promtail tails         │        │
│  │  combined.log│         │                 │        │
│  └──────────────┘         ▼                 │        │
│                      ┌──────────┐           │        │
│                      │  Loki    │           │        │
│                      │  :3100   │           │        │
│                      └────┬─────┘           │        │
│                           │                 │        │
│                           ▼                 ▼        │
│                      ┌──────────────────────────┐    │
│                      │        Grafana :3000      │    │
│                      │  RED Dashboard + Logs     │    │
│                      └──────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```
## Screenshots

### Grafana — RED Dashboard
![Grafana Dashboard](grafana.png)

### Prometheus — Target Health & PromQL
![Prometheus](prometheus.png)

### Jaeger — Trace Explorer
![Jaeger](jaeger.png)
---

## The App

A Node.js Express API with 5 endpoints — each designed to demonstrate a different observability scenario:

| Endpoint | Purpose |
|---|---|
| `GET /items` | Normal happy-path traffic |
| `GET /items/:id` | 404 error tracking (invalid IDs) |
| `POST /items` | POST request tracing |
| `GET /slow` | Latency monitoring — random 500ms–2500ms delay |
| `GET /error` | Error rate — returns 500 ~50% of the time |

---

## What I Learned

### OpenTelemetry
- OTel is vendor-neutral instrumentation — instrument once, export anywhere
- Auto-instrumentation wraps Express/HTTP with zero code changes via `--require ./instrumentation.js`
- Manual instrumentation uses `tracer.startSpan()` to add custom spans for business logic
- The OTel SDK connects to Jaeger (traces) and exposes `/metrics` for Prometheus (metrics)
- `metricReader: prometheusExporter` is the key line that connects metrics to the SDK

### Prometheus & Metrics
- Prometheus uses a **pull model** — it scrapes your app, your app never pushes
- Four metric types: Counter (only up), Gauge (up/down), Histogram (distribution), Summary (pre-calculated quantiles)
- Histograms expose `_count`, `_sum`, `_bucket` — always use `histogram_quantile()` for percentiles
- Labels create separate time series — high cardinality labels (user_id) kill Prometheus
- The RED method: Rate, Errors, Duration — three queries that tell you everything about an HTTP service

### PromQL
- `rate(counter[5m])` — requests per second over 5 minutes
- `sum by (http_route) (...)` — aggregate and group by label
- `histogram_quantile(0.95, sum by (le, http_route) (...))` — p95 latency, always keep `le` in by()
- Division for error %: errors / total * 100

### Jaeger & Traces
- A trace = full journey of one request, made of spans
- A span = one unit of work with start time, duration, status, attributes
- Trace ID is shared across all spans in one request — this is how distributed tracing works
- Spans travel between services via the W3C `traceparent` HTTP header
- `span.setStatus(SpanStatusCode.ERROR)` + `span.recordException(err)` marks a span as failed
- Always call `span.end()` — forgotten spans never get exported

### Loki & Logs
- Loki indexes only labels, not full content — always filter by labels first, then content
- Promtail tails log files and ships to Loki with labels extracted from JSON
- LogQL works like PromQL: `{job="otel-demo-app", level="error"}` filters by label
- `| json` parses log content as JSON, making all fields queryable
- `|=` contains, `!=` does not contain
- `traceId` in every log line connects logs to traces — copy traceId from Loki, search in Jaeger

### Grafana
- Grafana stores nothing — it queries Prometheus, Jaeger, and Loki in real time
- Time series panel for request rate and latency, Stat panel for error rate %, Logs panel for live logs
- Thresholds turn the error rate panel green/orange/red automatically
- Legend `{{http_route}}` makes each line labeled by route name

### Monitoring vs Observability
- Monitoring answers known questions (is error rate above 5%?)
- Observability answers unknown questions (why is this specific user slow?)
- True observability = metrics + traces + logs correlated together via traceId

---

## Stack

- **Runtime** — Node.js 20 on Ubuntu 24.04 (AWS EC2)
- **App framework** — Express
- **Logging** — Winston with OTel trace context injection
- **Instrumentation** — OpenTelemetry SDK (auto + manual)
- **Metrics storage** — Prometheus
- **Trace storage** — Jaeger (all-in-one)
- **Log storage** — Loki + Promtail
- **Visualization** — Grafana
- **Infrastructure** — Docker Compose

---

## Project Structure

```
otel-observability-lab/
├── app/
│   ├── index.js              # Express API — 5 endpoints
│   ├── instrumentation.js    # OTel SDK setup — loaded via --require
│   ├── logger.js             # Winston logger with traceId injection
│   ├── Dockerfile
│   └── logs/
│       ├── combined.log      # All logs
│       └── error.log         # Errors only
├── prometheus/
│   └── prometheus.yml        # Scrape config — targets app:9464
├── promtail/
│   └── config.yml            # Tails logs/, ships to Loki, extracts labels
├── docker-compose.yml        # Full stack — 6 services
└── README.md
```

---

## Setup

### Prerequisites
- AWS EC2 running Ubuntu 24.04 (t3.small or larger — needs 2GB+ RAM)
- Ports open in security group: 3000, 3001, 3100, 4317, 4318, 9090, 9464, 16686

### 1. Install Docker

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Clone and start

```bash
git clone https://github.com/YOUR_USERNAME/otel-observability-lab.git
cd otel-observability-lab
mkdir -p app/logs
docker compose up --build -d
```

### 3. Verify all containers are running

```bash
docker ps
```

You should see 6 containers: `otel-app`, `prometheus`, `jaeger`, `grafana`, `loki`, `promtail`

### 4. Set up Grafana datasources

Open Grafana at `http://<your-ec2-ip>:3000` — login: `admin` / `admin123`

Go to **Connections → Data sources → Add new data source** and add:

| Datasource | URL |
|---|---|
| Prometheus | `http://prometheus:9090` |
| Jaeger | `http://jaeger:16686` |
| Loki | `http://loki:3100` |

### 5. Generate traffic

```bash
while true; do
  curl -s http://localhost:3001/items > /dev/null
  curl -s http://localhost:3001/slow > /dev/null
  curl -s http://localhost:3001/error > /dev/null
  curl -s http://localhost:3001/items/1 > /dev/null
  curl -s http://localhost:3001/items/99 > /dev/null
  sleep 0.5
done
```

---

## Ports Reference

| Service | Port | Purpose |
|---|---|---|
| Node.js App | 3001 | API endpoints |
| Metrics endpoint | 9464 | Prometheus scrapes here |
| Prometheus | 9090 | UI + PromQL queries |
| Jaeger | 16686 | Trace UI |
| Jaeger OTLP HTTP | 4318 | App sends traces here |
| Jaeger OTLP gRPC | 4317 | Alternative trace receiver |
| Loki | 3100 | Log storage |
| Grafana | 3000 | Dashboards |

---

## Key Queries

### PromQL (Prometheus)

```promql
# Request rate per route
sum by (http_route) (rate(http_server_duration_count{job="otel-demo-app"}[5m]))

# Error rate %
sum(rate(http_server_duration_count{job="otel-demo-app", http_status_code="500"}[5m]))
/ sum(rate(http_server_duration_count{job="otel-demo-app"}[5m])) * 100

# p95 latency per route
histogram_quantile(0.95,
  sum by (le, http_route) (
    rate(http_server_duration_bucket{job="otel-demo-app", http_route=~".+"}[5m])
  )
)
```

### LogQL (Loki)

```logql
# All error logs
{job="otel-demo-app", level="error"}

# Find logs for a specific trace
{job="otel-demo-app"} | json | traceId = "your-trace-id-here"

# Error rate from logs
sum by (level) (rate({job="otel-demo-app"}[5m]))
```

---

## The RED Dashboard

Three core panels built in Grafana:

- **Request Rate** — `sum by (http_route) (rate(...))` — Time series panel
- **Error Rate %** — errors/total * 100 — Stat panel with green/orange/red thresholds
- **Latency p50/p95** — `histogram_quantile()` — Time series panel showing variance between routes

Plus two log panels:
- **Live Error Logs** — `{job="otel-demo-app", level="error"}` — Logs panel
- **Log Volume by Level** — `sum by (level) (rate(...))` — Time series panel

---

## The Full Observability Workflow

```
1. Grafana metrics → error rate spikes
2. Jump to Loki → filter level="error" at that timestamp
3. Find log line → copy traceId
4. Search Jaeger with traceId → see exact failing span
5. Done — you know what broke, where, and why
```

This is the difference between monitoring (knowing something is wrong) and observability (knowing exactly why).