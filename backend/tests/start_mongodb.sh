#!/usr/bin/env bash
# CI infrastructure: disposable pinned single-node replica set, never production.
set -euo pipefail
docker run --detach --name studio-suite-ci-mongo --publish 27017:27017 \
  mongo:7.0.16 --replSet phase3 --bind_ip_all
for attempt in {1..60}; do
  if docker exec studio-suite-ci-mongo mongosh --quiet --eval 'db.adminCommand({ping:1})' >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec studio-suite-ci-mongo mongosh --quiet --eval \
  'rs.initiate({_id:"phase3",members:[{_id:0,host:"127.0.0.1:27017"}]})'
for attempt in {1..60}; do
  if docker exec studio-suite-ci-mongo mongosh --quiet --eval \
    'if (!db.hello().isWritablePrimary) {quit(1)}' >/dev/null 2>&1; then
    exit 0
  fi
  sleep 1
done
docker logs studio-suite-ci-mongo
exit 1
