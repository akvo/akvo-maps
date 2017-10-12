module.exports.log_level = 'info';
module.exports.global_cache_ttl = 60000;
module.exports.global_reap_interval = 10000;
module.exports.global_emit_stats_interval = 10000;
module.exports.default_layergroup_ttl = 900000;
module.exports.log_full_layergroup_token = false;
module.exports.enable_cors = false;
// Encryption key must be provided
// module.exports.credentials_encryption_key= process.env.ENCRYPTION_KEY;

module.exports.redis = {
//    host: no sensible default,
    port: 6379,
//    max: no sensible default,
    log: false,
    idleTimeoutMillis: 60000,
    returnToHead: true,
    reapIntervalMillis: 10000,
    emitter: {
        statusInterval: 10000
    },
    slowQueries: {
        log: true,
        elapsedThreshold: 200
    },
    slowPool: {
        log: true,
        elapsedThreshold: 25
    }
};
module.exports.renderer = {
    mapnik: {
        poolSize: require('os').cpus().length,
        statsInterval: 10000,
        metatile: 4,
        metatileCache: {
            ttl: 60000,
            deleteOnHit: true
        },
        bufferSize: 64,
        scale_factors: [1, 2],
        limits: {
            render: 10000,
            cacheOnTimeout: true
        },
        geojson: {
            dbPoolParams: {
//                  size: 16, no sensible default
                  idleTimeout: 60000,
                  reapInterval: 10000
            },

            // SQL queries will be wrapped with ST_ClipByBox2D
            // Returning the portion of a geometry falling within a rectangle
            // It will only work if snapToGrid is enabled
            clipByBox2d: false, // this requires postgis >=2.2 and geos >=3.5
            // geometries will be simplified using ST_RemoveRepeatedPoints
            // which cost is no more expensive than snapping and results are
            // much closer to the original geometry
            removeRepeatedPoints: false // this requires postgis >=2.2
        }
    },
    torque: {
        dbPoolParams: {
//            size: 16, no sensible default
            idleTimeout: 60000,
            reapInterval: 10000
        }
    }
    // TODO: provide a onTileErrorStrategy????
};
module.exports.grainstore = {
    mapnik_version: "3.0.12" // will be looked up at runtime if undefined
 //   datasource: {max_size: 1} // To configure the mapnik connection pool. Used by https://github.com/mapnik/mapnik/blob/333ef9fde145f88339eaccba810305707bae9b0e/plugins/input/postgis/postgis_datasource.cpp#L81
};
module.exports.enable_cors = false;
// Optional: setup statsd. If not set, nothing will be monitored.
//module.exports.statsd = {
//        host: no sensible default,
//        port: 8125,
//        prefix: 'dev.'+ require("os").hostname() + ".",
//        cacheDns: true
//};
module.exports.renderCache = {
    ttl: 60000,
    statsInterval: 10000
};