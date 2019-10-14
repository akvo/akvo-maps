"use strict";

var mapnik = require('../');
var assert = require('assert');
var fs = require('fs');
var path = require('path');

mapnik.register_datasource(path.join(mapnik.settings.paths.input_plugins,'postgis.input'));

var map = new mapnik.Map(256, 256);
map.loadSync('./test/data/postgis_datasource_bool_query.xml');

map.render(new mapnik.VectorTile(0, 0, 0), {}, function(err, vtile) {
    assert.ok(!err,err);
    assert(!vtile.empty());
    var out = JSON.parse(vtile.toGeoJSON(0));
    assert.equal(out.type,'FeatureCollection');
    assert.equal(out.features.length,1);
    assert.strictEqual(out.features[0].properties.data, 0);
    assert.strictEqual(out.features[0].properties.status2, false);
});
