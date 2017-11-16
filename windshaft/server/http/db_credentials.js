var crypto = require('crypto');
var step = require('step');
var _  = require('underscore');
var assert = require('assert');

function _encrypt(secretBuffer, initializationVector, plaintext) {
    var cipher = crypto.createCipheriv("aes-256-cbc", secretBuffer, initializationVector);
    cipher.setAutoPadding(true);
    var encryptdata  = cipher.update(plaintext, 'utf8', 'binary');
    encryptdata += cipher.final('binary');
    return new Buffer(encryptdata, 'binary').toString('base64');
}

function _decrypt(secretBuffer, initializationVector, cipherText) {
    var decipher = crypto.createDecipheriv("aes-256-cbc", secretBuffer, initializationVector);
    decipher.setAutoPadding(true);
    var deciphertext = decipher.update(Buffer.from(cipherText, 'base64'));
    return deciphertext += decipher.final();
}

function Encryptor(redis_pool, secret) {
    var _hash = crypto.createHash("sha256");
    _hash.update(secret, "utf8");
    var _sha256key = _hash.digest();
    this.keyBuffer = Buffer.from(_sha256key);
    this._redis_pool = redis_pool;
}

module.exports = Encryptor;

Encryptor.prototype.encrypt = function(db_credentials) {
    var iv = crypto.randomBytes(16);
    return {
        iv: iv.toString('base64'),
        dbhost: _encrypt(this.keyBuffer, iv, db_credentials.dbhost),
        dbuser: _encrypt(this.keyBuffer, iv, db_credentials.dbuser),
        dbpassword: _encrypt(this.keyBuffer, iv, db_credentials.dbpassword),
        dbport: db_credentials.dbport,
        dbname: db_credentials.dbname
        };
};

Encryptor.prototype.decrypt = function(db_credentials) {
    var iv = Buffer.from(db_credentials.iv, 'base64');
    return {
        dbhost: _decrypt(this.keyBuffer, iv, db_credentials.dbhost),
        dbuser: _decrypt(this.keyBuffer, iv, db_credentials.dbuser),
        dbpassword: _decrypt(this.keyBuffer, iv, db_credentials.dbpassword),
        dbport: db_credentials.dbport,
        dbname: db_credentials.dbname
        };
};

Encryptor.prototype._redisCmd = function(func, args, callback) {
  var client;
  var pool = this._redis_pool;
  var db = 0;

  step(
        function getRedisClient() {
            pool.acquire(db, this);
        },
        function executeQuery(err, data) {
            assert.ifError(err);

            client = data;
            args.push(this);
            client[func].apply(client, args);
        },
        function releaseRedisClient(err, data) {
            if ( ! _.isUndefined(client) ) {
                pool.release(db, client);
            }
            if ( callback ) {
                callback(err, data);
            }
        }
    );

};

Encryptor.prototype.saveDbCredentials = function(layergroupid, db_credentials, callback) {
      var that = this;
      var key = "db_cred|" + layergroupid;
      var exp = 300;
      step(
        function writeRecord() {
          that._redisCmd('SETNX', [key, JSON.stringify(that.encrypt(db_credentials))], this);
        },
        function finish(err, wasNew) {
          if ( ! err ) {
            that._redisCmd('EXPIRE', [key, exp]); // not waiting for response
          }
          callback(err, key, !wasNew);
        }
      );
};

Encryptor.prototype.loadDbCredentials = function(layergroupid, callback) {
  var that = this;
  var key = "db_cred|" + layergroupid;
  var exp = 300;
  step(
    function getRecord() {
      that._redisCmd('GET', [key], this);
    },
    function parseRecord(err, json) {
      assert.ifError(err);

      if ( ! json ) {
        throw new Error("Invalid or nonexistent db token '" + layergroupid + "'");
      }
      return JSON.parse(json);
    },
    function instantiateConfig(err, db_credentials) {
      assert.ifError(err);

      var obj = that.decrypt(db_credentials);
      return obj;
    },
    function finish(err, obj) {
      if ( ! err ) {
        // Postpone expiration for the key
        that._redisCmd('EXPIRE', [key, exp]); // not waiting for response
      }
      callback(err, obj);
    }
  );
};
