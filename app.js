//app.js
var app = require('express')()
var fs = require('fs')
var paying = require('./payunits.js')

var https = require('https')
var privateKey  = fs.readFileSync('../apiclient_key.pem', 'utf8')
var certificate = fs.readFileSync('../apiclient_cert.pem', 'utf8')
var credentials = {key: privateKey, cert: certificate}

var httpsServer = https.createServer(credentials, app)

var SSLPORT = 18081

httpsServer.listen(SSLPORT, function() {
    console.log('HTTPS Server is running on: https://localhost:%s', SSLPORT)
})

// Welcome
app.get('/', function(req, res) {
    res.status(200).send('Welcome to Safety Land!')

})

