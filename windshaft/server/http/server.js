var appmetrics = require('appmetrics');
var winston = require('winston');

appmetrics.configure({'com.ibm.diagnostics.healthcenter.mqtt': 'off'});
var appmonitor = appmetrics.monitor();

var express = require('express');
var expressStatsd = require('express-statsd');
var bodyParser = require('body-parser');
var RedisPool = require('redis-mpool');
var _ = require('underscore');
var mapnik = require('mapnik');
var morgan = require('morgan');

var windshaft = require('windshaft');

var StaticMapsController = require('./controllers/static_maps');
var MapController = require('./controllers/map');

var StatsClient = require('./stats/client');
var RendererStatsReporter = require('./stats/reporter');

var DbCredentials = require('../http/db_credentials');

//
// @param opts server options object. Example value:
//     {
//        base_url: '/database/:dbname/table/:table',
//        base_url_notable: '/database/:dbname', // @deprecated
//        base_url_mapconfig: base_url_notable + '/layergroup',
//        req2params: function(req, callback){
//          callback(null,req)
//        },
//        grainstore: {
//          datasource: {
//            user:'postgres',
//            password:'secret',
//            host: '127.0.0.1',
//            port: 5432
//          }
//        }, //see grainstore npm for other options
//        mapnik: {
//          metatile: 4,
//          bufferSize:64
//        },
//        renderer: {
//          // function to use when getTile fails in a renderer, it enables modifying the default behaviour
//          onTileErrorStrategy: function(err, tile, headers, stats, format, callback) {
//            // allows to change behaviour based on `err` or `format` for instance
//            callback(err, file, headers, stats);
//          },
//          mapnik: {
//
//          },
//          http: {
//
//          },
//        },
//        renderCache: {
//          ttl: 60000, // seconds
//        },
//        redis: {
//          host: '127.0.0.1', port: 6379
//          // or 'pool', for a pre-configured pooler
//          // with interface of node-redis-mpool
//        },
//        https: {
//          key: fs.readFileSync('test/fixtures/keys/agent2-key.pem'),
//          cert: fs.readFileSync('test/fixtures/keys/agent2-cert.pem')
//        }
//     }
//
module.exports = function(opts, default_layergroup_ttl) {
    opts = opts || {};

    global.statsClient = StatsClient.getInstance(opts.statsd);

    opts.grainstore = opts.grainstore || {};
    opts.grainstore.mapnik_version = mapnikVersion(opts);

    validateOptions(opts);

    bootstrapFonts(opts);

    // initialize express server
    var app = bootstrap(opts);
    addFilters(app, opts);

    var redisPool = makeRedisPool(opts.redis);

    var map_store  = new windshaft.storage.MapStore({
        pool: redisPool,
        expire_time: default_layergroup_ttl / 1000
    });

    opts.renderer = opts.renderer || {};

    var rendererFactory = new windshaft.renderer.Factory({
        onTileErrorStrategy: opts.renderer.onTileErrorStrategy,
        mapnik: {
            grainstore: opts.grainstore,
            mapnik: opts.renderer.mapnik || opts.mapnik
        },
        torque: opts.renderer.torque
    });

    // initialize render cache
    var rendererCacheOpts = _.defaults(opts.renderCache || {}, {
        ttl: 60000, // 60 seconds TTL by default
        statsInterval: 60000 // reports stats every milliseconds defined here
    });
    var rendererCache = new windshaft.cache.RendererCache(rendererFactory, rendererCacheOpts);

    var attributesBackend = new windshaft.backend.Attributes();
    var previewBackend = new windshaft.backend.Preview(rendererCache);
    var tileBackend = new windshaft.backend.Tile(rendererCache);
    var mapValidatorBackend = new windshaft.backend.MapValidator(tileBackend, attributesBackend);
    var mapBackend = new windshaft.backend.Map(rendererCache, map_store, mapValidatorBackend);

    app.sendResponse = function(res, args) {
      res.send.apply(res, args);
    };

    app.findStatusCode = function(err) {
        var statusCode;
        if ( err.http_status ) {
            statusCode = err.http_status;
        } else {
            statusCode = statusFromErrorMessage('' + err);
        }
        return statusCode;
    };

    app.sendError = function(res, err, statusCode, label, tolog) {
      var olabel = '[';
      if ( label ) {
          olabel += label + ' ';
      }
      olabel += 'ERROR]';
      if ( ! tolog ) {
          tolog = err;
      }
      var log_msg = olabel + " -- " + statusCode + ": " + tolog;
      if (statusCode < 500) {
        winston.info(log_msg);
      } else {
        if ( tolog.stack ) log_msg += "\n" + tolog.stack;
        winston.warn(log_msg);
      }
      // If a callback was requested, force status to 200
      if ( res.req ) {
        // NOTE: res.req can be undefined when we fake a call to
        //       ourself from POST to /layergroup
        if ( res.req.query.callback ) {
            statusCode = 200;
        }
      }
      // Strip connection info, if any
      // See https://github.com/CartoDB/Windshaft/issues/173
      err = JSON.stringify(err);
      err = err.replace(/Connection string: '[^']*'\\n/, '');
      // See https://travis-ci.org/CartoDB/Windshaft/jobs/20703062#L1644
      err = err.replace(/is the server.*encountered/im, 'encountered');
      err = JSON.parse(err);

      res.status(statusCode).send(err);
    };

    var dbCredentials = new DbCredentials(redisPool, opts.encryption_key, default_layergroup_ttl / 1000);

    /*******************************************************************************************************************
     * Routing
     ******************************************************************************************************************/

    var mapController = new MapController(app, map_store, mapBackend, tileBackend, attributesBackend, dbCredentials);
    mapController.register(app);

    var staticMapsController = new StaticMapsController(app, map_store, previewBackend);
    staticMapsController.register(app);

    // simple testable route
    app.get('/healthz', function(req, res) {
        res.send('', 200);
    });

    // version
    app.get('/version', function(req, res) {
        res.send(app.getVersion(), 200);
    });

    /*******************************************************************************************************************
     * END Routing
     ******************************************************************************************************************/

    // temporary measure until we upgrade to newer version expressjs so we can check err.status
    app.use(function(err, req, res, next) {
        if (err) {
            if (err.name === 'SyntaxError') {
                app.sendError(res, { errors: [err.name + ': ' + err.message] }, 400, 'JSON', err);
            } else {
                next(err);
            }
        } else {
            next();
        }
    });

    /***************
     * Monitoring
     ****************/
     var rendererStatsReporter = new RendererStatsReporter(rendererCache, redisPool, mapController, appmonitor, rendererCacheOpts.statsInterval);
     rendererStatsReporter.start();

    return app;
};

function validateOptions(opts) {
    if (!_.isFunction(opts.req2params) || !_.isString(opts.base_url_mapconfig)) {
        throw new Error("Must initialise Windshaft with: 'base_url_mapconfig' URLs and req2params function");
    }

    // Be nice and warn if configured mapnik version is != instaled mapnik version
    if (mapnik.versions.mapnik !== opts.grainstore.mapnik_version) {
        winston.warn('WARNING: detected mapnik version (' + mapnik.versions.mapnik + ')' +
            ' != configured mapnik version (' + opts.grainstore.mapnik_version + ')');
    }
}

function makeRedisPool(redisOpts) {
    redisOpts = redisOpts || {};
    return redisOpts.pool || new RedisPool(_.extend(redisOpts, {name: 'windshaft:server'}));
}

function bootstrapFonts(opts) {
    // Set carto renderer configuration for MMLStore
    opts.grainstore.carto_env = opts.grainstore.carto_env || {};
    var cenv = opts.grainstore.carto_env;
    cenv.validation_data = cenv.validation_data || {};
    if ( ! cenv.validation_data.fonts ) {
        mapnik.register_system_fonts();
        mapnik.register_default_fonts();
        cenv.validation_data.fonts = _.keys(mapnik.fontFiles());
    }
}

function bootstrap(opts) {
    var app;
    if (_.isObject(opts.https)) {
        // use https if possible
        app = express(opts.https);
    } else {
        // fall back to http by default
        app = express();
    }

    app.enable('jsonp callback');
    app.use(expressStatsd({client: global.statsClient }));
    app.use(bodyParser.json());

    morgan.token('url', function (req, res) {
        var token = req.params && req.params['token'];
        if (!opts.log_full_layergroup_token && token && token.length > 8) {
            return req.url.replace(token, token.substring(0,8) + '*'.repeat(token.length - 8));
        } else {
            return req.url;
        }
    });
    app.use(morgan(':date[iso] - info: :method :url :status :response-time ms'));

    return app;
}

// set default before/after filters if not set in opts object
function addFilters(app, opts) {

    // Extend windshaft with all the elements of the options object
    _.extend(app, opts);

    // filters can be used for custom authentication, caching, logging etc
    _.defaults(app, {
        // Enable CORS access by web browsers if set
        doCORS: function(res, extraHeaders) {
            if (opts.enable_cors) {
                var baseHeaders = "X-Requested-With, X-Prototype-Version, X-CSRF-Token, Authorization, X-DB-PORT, X-DB-HOST, X-DB-PASSWORD, X-DB-USER, X-DB-LAST-UPDATE, X-DB-NAME";
                if(extraHeaders) {
                    baseHeaders += ", " + extraHeaders;
                }
                res.header("Access-Control-Allow-Origin", "*");
                res.header("Access-Control-Allow-Headers", baseHeaders);
            }
        },

        getVersion: function() {
            return windshaft.versions;
        }
    });
}

function statusFromErrorMessage(errMsg) {
    // Find an appropriate statusCode based on message
    var statusCode = 400;
    if ( -1 !== errMsg.indexOf('permission denied') ) {
        statusCode = 403;
    }
    else if ( -1 !== errMsg.indexOf('authentication failed') ) {
        statusCode = 403;
    }
    else if (errMsg.match(/Postgis Plugin.*[\s|\n].*column.*does not exist/)) {
        statusCode = 400;
    }
    else if ( -1 !== errMsg.indexOf('does not exist') ) {
        if ( -1 !== errMsg.indexOf(' role ') ) {
            statusCode = 403; // role 'xxx' does not exist
        } else {
            statusCode = 404;
        }
    } else if ( -1 !== errMsg.indexOf('TypeError') ) {
        statusCode = 500;
    }
    return statusCode;
}

function mapnikVersion(opts) {
    return opts.grainstore.mapnik_version || mapnik.versions.mapnik;
}
