//app.js
var app = require('express')()
var fs = require('fs')
var body_parser = require('body-parser')
app.use(body_parser.urlencoded({extended:true}))
app.use(body_parser.text({type: 'text/xml'}))
var compress = require('compression')
app.use(compress())
app.use(function(req,res,next){
    var _send = res.send
    var sent = false
    res.send = function(data){
        if(sent) return
        _send.bind(res)(data)
        sent = true
    }
    next()
})
var controller = require('./controller/index')
controller(app)
var ssl_keys = {
    key: fs.readFileSync(process.cwd()+'/2_www.helicalzh.la.key'),
    cert: fs.readFileSync(process.cwd()+'/1_www.helicalzh.la_bundle.crt')
}

require('https').createServer(ssl_keys, app).listen(3000, function () {
    console.log('%srunning, listen:%s', 'nodesrv', 3000)
})

