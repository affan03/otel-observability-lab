const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus');

// --- TRACES ---
const traceExporter = new OTLPTraceExporter({
  url: 'http://jaeger:4318/v1/traces',
});

// --- METRICS ---
// PrometheusExporter acts as both the reader AND the HTTP server
const prometheusExporter = new PrometheusExporter({
  port: 9464,
}, () => {
  console.log('Prometheus metrics available at http://localhost:9464/metrics');
});

// --- SDK ---
// metricReader is how you connect the exporter to the SDK
const sdk = new NodeSDK({
  serviceName: 'otel-demo-app',
  traceExporter,
  metricReader: prometheusExporter,        // <-- this was missing
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      },
    }),
  ],
});

sdk.start();
console.log('OpenTelemetry SDK started');

process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('SDK shut down successfully'))
    .catch(err => console.error('Error shutting down SDK', err))
    .finally(() => process.exit(0));
});
