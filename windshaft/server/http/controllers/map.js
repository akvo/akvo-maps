const util = require('util')
var winston = require('winston');
var assert = require('assert');
var step = require('step');
var windshaft = require('windshaft/lib/windshaft');
var _ = require('underscore');
var EventEmitter = require('events').EventEmitter

var MapConfig = windshaft.model.MapConfig;
var DummyMapConfigProvider = require('windshaft/lib/windshaft/models/providers/dummy_mapconfig_provider');

var MapStoreMapConfigProvider = windshaft.model.provider.MapStoreMapConfig;

/**
 * @param app
 * @param {MapStore} mapStore
 * @param {MapBackend} mapBackend
 * @param {TileBackend} tileBackend
 * @param {AttributesBackend} attributesBackend
 * @constructor
 */
function MapController(app, mapStore, mapBackend, tileBackend, attributesBackend, dbCredentials) {
    this._app = app;
    this.mapStore = mapStore;
    this.mapBackend = mapBackend;
    this.tileBackend = tileBackend;
    this.attributesBackend = attributesBackend;
    this.dbCredentials = dbCredentials;
    EventEmitter.call(this);
}

util.inherits(MapController, EventEmitter);
module.exports = MapController;

function statsd (path, req, status) {
    var method = req.method || 'unknown_method';
    var format = req.params['format'] || '';
    req.statsdKey = ['http', status, method.toLowerCase(), path, format.replace(/\./g, '_'), req.params['dbname']].join('.');
}

MapController.prototype.register = function(app) {
    app.get(app.base_url_mapconfig + '/:token/:z/:x/:y@:scale_factor?x.:format', this.tile.bind(this));
    app.get(app.base_url_mapconfig + '/:token/:z/:x/:y.:format', this.tile.bind(this));
    app.get(app.base_url_mapconfig + '/:token/:layer/:z/:x/:y.(:format)', this.layer.bind(this));
    app.options(app.base_url_mapconfig, this.cors.bind(this));
    app.post(app.base_url_mapconfig, this.createPost.bind(this));
    app.get(app.base_url_mapconfig + '/:token/:layer/attributes/:fid', this.attributes.bind(this));
};

// send CORS headers when client send options.
MapController.prototype.cors = function(req, res, next) {
    this._app.doCORS(res, "Content-Type");
    return next();
};

// Gets attributes for a given layer feature
MapController.prototype.attributes = function(req, res) {
    var self = this;

    this._app.doCORS(res);

    step(
        function setupParams() {
            self._app.req2params(req, this);
        },
        function retrieveFeatureAttributes(err) {
            assert.ifError(err);
            var mapConfigProvider = new MapStoreMapConfigProvider(self.mapStore, req.params);
            self.attributesBackend.getFeatureAttributes(mapConfigProvider, req.params, false, this);
        },
        function finish(err, tile) {
            if (err) {
                // See https://github.com/Vizzuality/Windshaft-cartodb/issues/68
                var errMsg = err.message ? ( '' + err.message ) : ( '' + err );
                self._app.sendError(res, { errors: [errMsg] }, self._app.findStatusCode(err), 'ATTRIBUTES', err);
            } else {
                res.set('Cache-Control', 'max-age=31536000');
                res.send(tile, 200);
            }
        }
    );

};

MapController.prototype.addLastModifiedTimestamp = function(req, response, cb) {
    response.layergroupid = response.layergroupid + ":" + req.headers['x-db-last-update'];
    cb(null, response);
}

function assertHeaderExists(req, header) {
    if ( ! req.headers[header]) {
        throw new Error('layergroup POST data must have header ' + header);
    }
}

MapController.prototype.create = function(req, res, prepareConfigFn) {
    var self = this;

    this._app.doCORS(res);

    var db_credentials = {};
    step(
        function setupParams(){
            self._app.req2params(req, this);
        },
        prepareConfigFn,
        function initLayergroup(err, requestMapConfig) {
            assert.ifError(err);
            assertHeaderExists(req, 'x-db-host');
            assertHeaderExists(req, 'x-db-user');
            assertHeaderExists(req, 'x-db-password');
            assertHeaderExists(req, 'x-db-port');
            assertHeaderExists(req, 'x-db-name');

            // Storing it in Redis
            db_credentials = { dbhost: req.headers['x-db-host'],
                               dbuser: req.headers['x-db-user'],
                               dbpassword: req.headers['x-db-password'],
                               dbname: req.headers['x-db-name'],
                               dbport: req.headers['x-db-port']};

            // Making it available to downstream
            _.extend(req.params, db_credentials);

            requestMapConfig.salt = self.dbCredentials.saltForMapConfig();

            var mapConfig = MapConfig.create(requestMapConfig);
            self.mapBackend.createLayergroup(
                mapConfig, req.params, new DummyMapConfigProvider(mapConfig, req.params), this
            );
        },
        function saveDbCredentials(err, response, times) {
            assert.ifError(err);
            const callback = this;
            self.dbCredentials.saveDbCredentials(
                response.layergroupid,
                db_credentials,
                function(err) {
                    return callback(err, response, times);
                }
            );
        },
        function addLastModifiedTimestamp(err, response, times) {
            assert.ifError(err);
            self.emit('perf', times, req.params['dbname']);
            return self.addLastModifiedTimestamp(req, response, this);
        },
        function finish(err, response){
            if (err) {
                var statusCode = self._app.findStatusCode(err);
                statsd('create', req, statusCode);
                self._app.sendError(res, { errors: [ err.message ] }, statusCode, 'LAYERGROUP', err);
            } else {
                statsd('create', req, 200);
                res.status(200).send(response);
            }
        }
    );
};

MapController.prototype.createPost = function(req, res) {
    this.create(req, res, function createPost$prepareConfig(err, req) {
        assert.ifError(err);
        if ( ! req.headers['content-type'] || req.headers['content-type'].split(';')[0] !== 'application/json' ) {
            throw new Error('layergroup POST data must be of type application/json');
        }
        return req.body;
    });
};

// Gets a tile for a given token and set of tile ZXY coords. (OSM style)
MapController.prototype.tile = function(req, res) {
    this.tileOrLayer(req, res);
};

// Gets a tile for a given token, layer set of tile ZXY coords. (OSM style)
MapController.prototype.layer = function(req, res, next) {
    if (req.params.token === 'static') {
        return next();
    }
    this.tileOrLayer(req, res);
};

MapController.prototype.tileOrLayer = function (req, res) {
    var self = this;

    this._app.doCORS(res);
    var mapConfigProvider = null;
    step(
        function mapController$prepareParams() {
            self._app.req2params(req, this);
        },
        function loadMapConfig(err) {
            if ( err ) {
                throw err;
            }
            mapConfigProvider = new MapStoreMapConfigProvider(self.mapStore, req.params);
            mapConfigProvider.getMapConfig(this);
        },
        function setDbConfig(err, mapConfig, params, context) {
                if (err) {
                        throw err;
                }
                self.dbCredentials.loadDbCredentials(mapConfig.id(), this);
        },
        function mapController$getTile(err, db_credentials) {
            if ( err ) {
                throw err;
            }
            _.extend(req.params, db_credentials);

            self.tileBackend.getTile(mapConfigProvider, req.params, this);
        },
        function mapController$finalize(err, tile, headers, times) {
            self.emit('perf', times, req.params['dbname']);
            self.finalizeGetTileOrGrid(err, req, res, tile, headers);
            return null;
        },
        function finish(err) {
            if ( err ) {
                winston.error("windshaft.tiles: " + err);
            }
        }
    );
};

// This function is meant for being called as the very last
// step by all endpoints serving tiles or grids
MapController.prototype.finalizeGetTileOrGrid = function(err, req, res, tile, headers) {
    if (err){
        // See https://github.com/Vizzuality/Windshaft-cartodb/issues/68
        var errMsg = err.message ? ( '' + err.message ) : ( '' + err );

        // Rewrite mapnik parsing errors to start with layer number
        var matches = errMsg.match("(.*) in style 'layer([0-9]+)'");
        if (matches) {
            errMsg = 'style'+matches[2]+': ' + matches[1];
        }

        var statusCode = this._app.findStatusCode(err);
        statsd('tile', req, statusCode);

        this._app.sendError(res, { errors: ['' + errMsg] }, this._app.findStatusCode(err), 'TILE', err);
    } else {
        statsd('tile', req, 200);

        res.set('Cache-Control', 'max-age=31536000');
        res.status(200);
        if (headers) res.set(headers);

        if (!Buffer.isBuffer(tile) && typeof tile === 'object') {
            if (req.query && req.query.callback) {
                res.jsonp(tile);
            } else {
                res.json(tile);
            }
        } else {
            res.send(tile);
        }

    }
};
