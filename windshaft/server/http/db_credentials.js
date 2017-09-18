var crypto = require('crypto');

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

function Encryptor(secret) {
    var _hash = crypto.createHash("sha256");
    _hash.update(secret, "utf8");
    var _sha256key = _hash.digest();
    this.keyBuffer = Buffer.from(_sha256key);
}

module.exports = Encryptor;

Encryptor.prototype.encrypt = function(db_credentials) {
    var iv = crypto.randomBytes(16);
    return {
        iv: iv.toString('base64'),
        dbhost: _encrypt(this.keyBuffer, iv, db_credentials.dbhost),
        dbuser: _encrypt(this.keyBuffer, iv, db_credentials.dbuser),
        dbpassword: _encrypt(this.keyBuffer, iv, db_credentials.dbpassword),
        dbport: db_credentials.dbport
        };
};

Encryptor.prototype.decrypt = function(db_credentials) {
    var iv = Buffer.from(db_credentials.iv, 'base64');
    return {
        dbhost: _decrypt(this.keyBuffer, iv, db_credentials.dbhost),
        dbuser: _decrypt(this.keyBuffer, iv, db_credentials.dbuser),
        dbpassword: _decrypt(this.keyBuffer, iv, db_credentials.dbpassword),
        dbport: db_credentials.dbport
        };
};