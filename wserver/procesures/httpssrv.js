//httpssrv.js

const https = require('https')
const ssl_keys = require('../../databases/sslkey.js')

module.exports = https.createServer(ssl_keys, function(req, res){
    res.writeHead(403)
    res.end('this is a websocket server!')
}).listen(9595)
