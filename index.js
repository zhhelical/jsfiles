//index.js
const multer = require('multer')
const Bagpipe = require('bagpipe')
const path = require('path')
const imginfo = require('imageinfo')
const zlib = require('zlib')
const fs = require('fs')
const redis = require('../../../databases/rediscache.js')
const notify = require('../respondnotify.js')
var upload = multer({dest: '/data/release/helical/uploads'})
var bagpipe = new Bagpipe(10)
function send_gzip(items, respond, cb){
    redis.getUserCache(`people:${items.label}`, items.where, function (res) {
        var fsname = '/data/release/helical/uploads/' + res[0], file = fs.createReadStream(path.resolve(fsname)), gzipstream = zlib.createGzip()
            , img_info = imginfo(fs.readFileSync(path.resolve(fsname)))
        var gzipstream = zlib.createGzip()
        respond.writeHead(200, {"content-encoding": "gzip", 'Content-Type':img_info.mimeType+'/'+img_info.format})
        file.pipe(gzipstream).pipe(respond)
        cb('success')
    }).catch(function(err){
        if(err)
            cb(err)
    })
}
function send_vzip(items, respond, cb){
    redis.getUserCache(`people:${items.label}`, items.where, function (res) {
        var fsname = '/data/release/helical/uploads/' + res[0], file = fs.createReadStream(path.resolve(fsname)), gzipstream = zlib.createGzip()
        res.writeHead(200, {"content-encoding": "gzip"})
        file.pipe(gzipstream).pipe(respond)
        cb('success')
    }).catch(function(err){
        if(err)
            cb(err)
    })
}
function feedback(items, respond){
    redis.getUserCache(`people:${items.label}`, items.where, function (res) {
        var fsname = '/data/release/helical/uploads/' + res[0], file = fs.readFileSync(path.resolve(imgname), 'binary')
        if(items.picture){
            var img_info = imginfo(fs.readFileSync(path.resolve(fsname)))
            respond.writeHead(200, {'Content-Type': img_info.mimeType + '/' + img_info.format})
        }
        else
            respond.writeHead(200)
        respond.write(file, 'binary')
        respond.end()
    }).catch(function(err){
        if(err)
            respond.status(500).send('error!')
    })
}
function zipFeedback(items, respond){
    if(items.picture)
        bagpipe.push(send_gzip, items, respond, function (data) {
            console.log(data)
        })
    else
        bagpipe.push(send_vzip, items, respond, function (data) {
            console.log(data)
        })
}
module.exports = function(app){
    app.post('/wxnotify', function (req, res) {
        notify.dealXmlBody(req.body, function(d_res){
            res.send(d_res)
        })
    })
    app.post('/uploads/', upload.array('mediaes'), function (req, res) {
        var f_names=[]
        for (var i = 0; i <req.files.length; i++) {
            var fs_prop=req.body.localkey+'_'+req.body.setime+'_'+req.body.where
            f_names.push({[fs_prop]: req.files[i].path + pathLib.parse(req.files[i].originalname).ext})
        }
        console.log(req.body)
        redis.storeUserCache('people:mediaes', names, function () {
            res.json({success: true})
        }).catch(function(err){
            if(err)
                return res.json({success: false})
        })
    })
    app.get('/uploads/*', function(req, res){
        var accept_encoding = req.headers['accept-encoding']
        if (accept_encoding && accept_encoding.indexOf('gzip') != -1)
            zipFeedback(req.headers, res)
        else
            feedback(req.headers, res)
        return
    })
}