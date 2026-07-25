FROM prom/prometheus:v3.5.0

COPY prometheus.railway.yaml /etc/prometheus/prometheus.yaml

EXPOSE 9090

CMD ["--config.file=/etc/prometheus/prometheus.yaml", "--storage.tsdb.path=/prometheus", "--web.listen-address=[::]:9090"]
