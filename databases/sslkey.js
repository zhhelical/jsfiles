//sslkey.js
var fs = require('fs')
module.exports = {
    key: fs.readFileSync(__dirname+'/2_www.helicalzh.la.key'),
    cert: fs.readFileSync(__dirname+'/1_www.helicalzh.la_bundle.crt')
}
