var https=require('https')
var express = require('express')
    , app=express()
var WebSocketServer=require('ws')
var connections=require('../wserver/procesures/app.js')

/*app.use((req, res, next) => {
    console.log('app',req.body)    
    var _send = res.send
    var sent = false
    res.send = function(data){
        if(sent) return
        _send.bind(res)(data)
        sent = true
    }
    next()
})*/
var body_parser = require('body-parser')
app.use(body_parser.urlencoded({extended:true}))
app.use(body_parser.text({type: 'text/xml'}))
var compress = require('compression')
app.use(compress())

var controller = require('./controller/index')
controller(app)

var ssl_key = require('../databases/sslkey.js')

var https_server=https.createServer(ssl_key, app)

var ws_server = new WebSocketServer.Server({server: https_server})

//ws_server.setMaxListeners(500)
require('events').EventEmitter.prototype.maxListeners = 500
ws_server.on('connection', connections.connfunction)
ws_server.on('error', function(err){
    console.log(err)
    connections.wsserver.removeAllListeners('error')
})

https_server.listen(443, function() {
    console.log('%srunning, listen:%s', 'nodesrv', 443)
})
