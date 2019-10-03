#!/usr/bin/env bash

set -euo pipefail

cmd="${1:-unknown}"
cert_file="/pg-certs/server.crt"

wait_file() {
    local file="$1"; shift
    local wait_seconds="${1:-10}"; shift # 10 seconds as default timeout

    until test $((wait_seconds--)) -eq 0 -o -f "$file" ; do sleep 1; done

    ((++wait_seconds))
}

echo "Waiting for PostgreSQL cert..."

wait_file "${cert_file}" 45 || {
    echo "PostgreSQL certificate missing after waiting for $? seconds: '${cert_file}'"
    exit 1
}

keytool -import -trustcacerts -keystore /usr/lib/jvm/java-8-openjdk-amd64/jre/lib/security/cacerts -storepass changeit -noprompt -alias postgrescert -file "${cert_file}"

if [[ "${cmd}" == "test" ]]; then
    lein test
else
    lein repl :headless
fi
