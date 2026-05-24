const winston = require('winston');
const { trace, context, SpanStatusCode } = require('@opentelemetry/api');

// Custom format that injects OTel trace context into every log line
const otelFormat = winston.format((info) => {
  const activeSpan = trace.getActiveSpan();

  if (activeSpan) {
    const spanContext = activeSpan.spanContext();
    info.traceId = spanContext.traceId;
    info.spanId = spanContext.spanId;

    // Remove duplicates injected by OTel
    delete info.trace_id;
    delete info.span_id;
    delete info.trace_flags;
    delete info.traceFlags;
  }

  return info;
});

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    otelFormat(),                        // inject trace context first
    winston.format.timestamp(),          // add timestamp
    winston.format.errors({ stack: true }), // include stack traces on errors
    winston.format.json()                // output as JSON — structured logs
  ),
  defaultMeta: {
    service: 'otel-demo-app',           // always include service name
  },
  transports: [
    new winston.transports.Console(),   // logs to stdout for now
    new winston.transports.File({       // also write to file
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});

module.exports = logger;
