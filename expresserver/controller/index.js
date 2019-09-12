//index.js
const multer = require('multer')
const Bagpipe = require('bagpipe')
const path = require('path')
const imginfo = require('imageinfo')
const zlib = require('zlib')
const fs = require('fs')
const joiners = require('../../wserver/procesures/service/clients.js')
const redis = require('../../databases/rediscache.js')
const notify = require('../respondnotify.js')
var upload = multer({dest: '/data/uploads'})
    , uploading = upload.array('mediaes'), mediaes=[]
var bagpipe = new Bagpipe(10)
function redisdata(item, respond, zip, cb){
    redis.getUsrField(`media:${item.localkey}`, item.where).then( function (res) {
	console.log(res,item.localkey)
        if(zip)
            send_zip(item, res, respond, cb)
        else
            feedback(item, res, respond)
    }).catch(function(err){
        if(err){
	    if(cb)
            	cb(err)
            joiners.appOptErr(err, 'app.redisdata.getUsrField', 'empty')
        }
    })
}
function send_zip(item, res, respond, cb){
    var fsname = '/data/uploads/' + res.split('.')[0], file = fs.createReadStream(path.resolve(fsname)), gzipstream = zlib.createGzip()
    if(item.prop=='picture'){
        var img_info = imginfo(fs.readFileSync(path.resolve(fsname)))
        respond.writeHead(200, {"content-encoding": "gzip", 'Content-Type':img_info.mimeType+'/'+img_info.format})
    }
    else
        respond.writeHead(200, {"content-encoding": "gzip"})
    var gzipstream = zlib.createGzip()
    file.pipe(gzipstream).pipe(respond)
    cb('success')    
}
function feedback(item, res, respond){
    var fsname = '/data/uploads/' + res.split('.')[0], file = fs.readFileSync(path.resolve(fsname), 'binary')
    if(item.prop=='picture'){
        var img_info = imginfo(fs.readFileSync(path.resolve(fsname)))
        respond.writeHead(200, {'Content-Type': img_info.mimeType + '/' + img_info.format})
    }
    else
        respond.writeHead(200)
    respond.write(file, 'binary')
    respond.end()
}
function zipFeedback(item, respond){
    bagpipe.push(redisdata, item, respond, true, function (data) {
        console.log(data)
    })
}
module.exports = function(app){
    app.post('/wxnotify', function (req, res) {
        notify.dealXmlBody(req.body, function(d_res){
            res.send(d_res)
        })
    })
    app.post('/uploads/', upload.single('media'), function (req, res) {
        mediaes.push(req.body.where)
        var names = req.file.path.split('/')
        mediaes.push(names[names.length-1] + path.parse(req.file.originalname).ext)
        if(req.body.end) {
	    var media_key = `media:${req.body.localkey}`
            function redistore(fields){
                redis.storeUsrHash(media_key, fields).then( function () {}).catch(function (err) {
                    if (err)
                        joiners.appOptErr(err+'_app.post.storeUsrHash', media_key, JSON.stringify(fields))
                })
            }
            redistore(mediaes)
            mediaes.length=0
        }
	res.json({success: true})
    })    
    app.get('/uploads/*', function(req, res){
	var accept_encoding = req.headers['accept-encoding']
	console.log(accept_encoding)
        if (accept_encoding && accept_encoding.indexOf('gzip') != -1)
            zipFeedback(req.headers, res)
        else if (req.headers.head)
            feedback(req.headers, req.headers.head, res)
        else
            redisdata(req.headers, res)
        return
    })
    app.get('/uimages/*', function(req, res){
        var fsname = '/data/uimages/' + req.headers.name, file = fs.readFileSync(path.resolve(fsname), 'binary')
            , img_info = imginfo(fs.readFileSync(path.resolve(fsname)))
        res.writeHead(200, {'Content-Type': img_info.mimeType + '/' + img_info.format})
        res.write(file, 'binary')
        res.end()
    })
}
