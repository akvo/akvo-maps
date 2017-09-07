#!/bin/bash

keytool -import -trustcacerts -keystore /usr/lib/jvm/java-8-openjdk-amd64/jre/lib/security/cacerts -storepass changeit -noprompt -alias postgrescert -file /pg-certs/server.crt

if [ -z "$1" ]; then
    lein repl :headless
elif [ "$1" == "test" ]; then
    lein test
else
    true
fi