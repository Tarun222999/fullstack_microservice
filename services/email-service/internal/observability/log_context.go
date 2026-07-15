package observability

import (
	"context"

	"go.opentelemetry.io/otel/trace"
)

type LogContext struct {
	TraceID string
	SpanID  string
}

func ContextForLog(ctx context.Context) LogContext {
	spanContext := trace.SpanContextFromContext(ctx)
	if !spanContext.IsValid() {
		return LogContext{}
	}

	return LogContext{
		TraceID: spanContext.TraceID().String(),
		SpanID:  spanContext.SpanID().String(),
	}
}
