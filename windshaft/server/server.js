var Server = require('./http/server');
var _         = require('underscore');
var merge = require('merge-deep');
var assert = require('assert');
var default_environment = require('./default-config.js');
var winston = require('winston');

var PORT = 4000;

global.environment  = require('/config/environment.js');

temporal_global = merge(default_environment, global.environment);

just_global_properties = {
    redis: {
        idleTimeoutMillis: temporal_global.global_cache_ttl,
        reapIntervalMillis: temporal_global.global_reap_interval,
        emitter: {
          statusInterval: temporal_global.global_emit_stats_interval
        }
    },
    renderer: {
        mapnik: {
            statsInterval: temporal_global.global_emit_stats_interval,
            metatileCache: {
                ttl: temporal_global.global_cache_ttl
             },
            geojson: {
               dbPoolParams: {
                  idleTimeout: temporal_global.global_cache_ttl,
                  reapInterval: temporal_global.global_reap_interval
               }
            }
        },
        torque: {
            dbPoolParams: {
                idleTimeout: temporal_global.global_cache_ttl,
                reapInterval: temporal_global.global_reap_interval
            }
        }
    },
    renderCache: {
        ttl: temporal_global.global_cache_ttl,
        statsInterval: temporal_global.global_emit_stats_interval
    }
};

global.environment = merge(merge(default_environment,just_global_properties), global.environment);

assert.ok(global.environment.redis.host, "Must specify Redis host in configuration");
assert.ok(global.environment.redis.max, "Must specify Redis max number of connections in configuration");
assert.ok(global.environment.credentials_encryption_key, "Must specify an encryption key for the DB credentials");

winston.configure({
  level: global.environment.log_level,
  transports: [
    new (winston.transports.Console)({
      timestamp: function() {
        return new Date().toISOString();
      }
    })
  ]
});

winston.debug('Using configuration', global.environment);

if (process.env.NODE_ENV == 'development') {
    process.once('SIGUSR2', function () {
        process.kill(process.pid, 'SIGUSR2');
        process.exit();
      });
}

// TODO: mml-builder has a use_workers flag in line 40
var config = {
    base_url_mapconfig: '/layergroup',
    log_full_layergroup_token: global.environment.log_full_layergroup_token,
    grainstore: global.environment.grainstore,
    redis: global.environment.redis,
    renderer: global.environment.renderer,
    enable_cors: global.environment.enable_cors,
    statsd: global.environment.statsd,
    renderCache: global.environment.renderCache,
    encryption_key: global.environment.credentials_encryption_key,
    req2params: function(req, callback){

        if ( req.params.token )
        {
          // Separate cache buster from token
          var tksplit = req.params.token.split(':');
          req.params.token = tksplit[0];
          if ( tksplit.length > 1 ) {
              req.params.cache_buster = tksplit[1];
          }
        }
        callback(null,req);
    }

};

var server = new Server(config, global.environment.default_layergroup_ttl);
server.listen(PORT, function() {
    winston.info("map tiles are now being served out of: http://localhost:" + PORT + config.base_url_mapconfig);
});
