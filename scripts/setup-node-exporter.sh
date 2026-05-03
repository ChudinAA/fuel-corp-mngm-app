#!/bin/bash
# =============================================================================
# Установка Node Exporter на App Server (Server 1) или DB Server (Server 2)
# Запускается как Docker-контейнер, предоставляет метрики хоста для Prometheus
#
# Использование:
#   MON_SERVER_IP=<IP Server 3> ./scripts/setup-node-exporter.sh
# =============================================================================

set -e

MON_SERVER_IP="${MON_SERVER_IP:-}"

if [ -z "$MON_SERVER_IP" ]; then
  echo "Usage: MON_SERVER_IP=<IP Server 3> $0"
  echo ""
  echo "Это IP адрес сервера мониторинга (Server 3)."
  echo "Node Exporter будет доступен только с этого IP."
  exit 1
fi

echo "Установка Node Exporter..."
echo "Метрики будут доступны только с: $MON_SERVER_IP"

# Запустить Node Exporter
docker run -d \
  --name node_exporter \
  --restart unless-stopped \
  --pid="host" \
  -v "/:/host:ro,rslave" \
  -p "9100:9100" \
  prom/node-exporter:v1.7.0 \
  --path.rootfs=/host

echo "Node Exporter запущен (порт 9100)"

# Настройка firewall (если установлен ufw)
if command -v ufw >/dev/null 2>&1; then
  sudo ufw allow from "$MON_SERVER_IP" to any port 9100 comment "Prometheus Node Exporter"
  echo "Firewall: порт 9100 открыт только для $MON_SERVER_IP"
fi

# Проверка
sleep 3
if curl -sf http://localhost:9100/metrics >/dev/null 2>&1; then
  echo "Node Exporter работает: http://localhost:9100/metrics"
else
  echo "ПРЕДУПРЕЖДЕНИЕ: Node Exporter не отвечает. Проверьте: docker logs node_exporter"
fi

echo ""
echo "Следующий шаг: убедитесь, что в prometheus.yml на Server 3"
echo "прописан IP этого сервера как target для node_exporter."
