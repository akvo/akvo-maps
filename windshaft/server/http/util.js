var crypto = require('crypto');


function decrypt(secret, cipherText) {
  // Compute the sha256 of the secret, will ensure 256 bit key
  var hash = crypto.createHash("sha256");
  hash.update(secret, "utf8");
  var sha256key = hash.digest();
  var keyBuffer = Buffer.from(sha256key);
  // The cipherText is base64 encoded
  var cipherBuffer =  Buffer.from(cipherText, 'base64');
  var cipher = crypto.createDecipheriv("aes-256-ecb", keyBuffer , '');
  var output = cipher.update(cipherBuffer);
  return output + cipher.final();
};

module.exports.decrypt = decrypt;
