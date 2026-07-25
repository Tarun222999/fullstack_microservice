FROM otel/opentelemetry-collector-contrib:0.130.1

COPY config.railway.yaml /etc/otelcol-contrib/config.yaml

EXPOSE 13133 4317 4318 9464

CMD ["--config=/etc/otelcol-contrib/config.yaml"]
