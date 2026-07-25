FROM grafana/grafana:12.0.2

ENV GF_SERVER_HTTP_ADDR=:: \
    GF_SERVER_HTTP_PORT=3000

COPY railway-provisioning /etc/grafana/provisioning

EXPOSE 3000
