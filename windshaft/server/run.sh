#!/usr/bin/env bash

if [ $NODE_ENV = "development" ]; then
   echo "Starting in dev mode"
   npm install
   nodemon --inspect ./server.js
else
   echo "Starting in production mode"
   node ./server.js
fi