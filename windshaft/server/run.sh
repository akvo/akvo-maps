#!/usr/bin/env bash

EXTRA_NODE_OPTS="${EXTRA_NODE_OPTS:-}"

if [ $NODE_ENV = "development" ]; then
   echo "Starting in dev mode"
   npm install
   nodemon $EXTRA_NODE_OPTS ./server.js
else
   echo "Starting in production mode"
   node $EXTRA_NODE_OPTS ./server.js
fi