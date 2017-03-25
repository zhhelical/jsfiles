//objstodb.js
const file = require("fs")
const co = require('co')
const mysql = require('../../../databases/mysqldata.js')
const mypicsql = require('../../../databases/mysqlpics.js')
const timegen = require('./time.js')
const joiner = require('./clients.js')
const shell = require('./shell.js')
var genLocalkey = function(cb){
        var sh_order = 'head -n 80 /dev/urandom | tr -dc A-Za-z0-9 | head -c 168'
        shell.shellFunc(sh_order).then(function (result) {
            cb(result)
        }).then(function (err) {
            if (err)
                genLocalkey(cb)
        })
    }
    , genOpenid = function(cb){
        var sh_order = 'head -n 80 /dev/urandom | tr -dc A-Za-z0-9 | head -c 28'
        shell.shellFunc(sh_order).then(function (result) {
            cb(result)
        }).then(function (err) {
            if (err)
                genOpenid(cb)
        })
    }
    , recur_insimg = function(i_imgs, cb){
        if(!i_imgs.length)
            return cb('ins finished')
        mypicsql.insert_pic(i_imgs[0]).then(function () {
            i_imgs.splice(0, 1)
            recur_insimg(i_imgs, cb)
        }).then(function (err) {
            if(err != undefined)
                recur_insimg(i_imgs, cb)
        })
    }
    , recur_ins = function(i_objs, cb){
        if(!i_objs.length)
            return cb()
        genLocalkey(function(localKey){
            genOpenid(function(openid){
                var ins_imgs = []
                if(i_objs[0].imgs) {
                    ins_imgs = i_objs[0].imgs.slice(0)
                    for (var imi in ins_imgs)
                        ins_imgs[imi].img_key = localKey
                    delete i_objs[0].imgs
                }
                var ids_str = JSON.stringify({localKey:localKey, openid:openid})
                mysql.insert_exec(ids_str, JSON.stringify([i_objs[0]])).then(function (sql_res) {
                    if(ins_imgs.length)
                        recur_insimg(ins_imgs, function (mg_res) {
                            i_objs.splice(0, 1)
                            recur_ins(i_objs, cb)
                        })
                    else{
                        i_objs.splice(0, 1)
                        recur_ins(i_objs, cb)
                    }
                }).then(function (err) {
                    if (err)
                        recur_ins(i_objs, cb)
                })
            })
        })
    }
    , mergeObjsImgs = function(o_file, imgs_objs, cb){
        var of_size = file.statSync(o_file).size
        console.log(o_file, of_size)
        if(!of_size)
            return cb(null)
        file.readFile(o_file, function (err, res) {
            if(err)
                return mergeObjsImgs(o_file, imgs_objs)
            var js_objs = JSON.parse(res)
            for(var ji in js_objs){
                for(var ii in imgs_objs){
                    if(js_objs[ji].link && js_objs[ji].link == imgs_objs[ii].http){
                        js_objs[ji].imgs = imgs_objs[ii].imgs
                        imgs_objs.splice(ii, 1)
                        break
                    }
                }
            }
            recur_ins(js_objs, function(){
                cb('finished merge')
            })
        })
    }
    , readImgs = function(imgs_file, cb){
        console.log(imgs_file)
        file.readFile(imgs_file, function(err, images){
            if(err)
                return readImgs(imgs_file, cb)
            cb(JSON.parse(images))
        })
    }
    , get_objs = function(dest, totalimgs, dir_objs){
        if(!dir_objs.length) {
            file.writeFile(imgspos, JSON.stringify(totalimgs), function (err, res) {
                if(err)
                    console.log('please clear by hand')
            })
            return
        }
        if(dir_objs[0] == 'downloads'){
            dir_objs.splice(0, 1)
            get_objs(dest, totalimgs, dir_objs)
        }
        else{
            file.readdir(`${dest}${dir_objs[0]}`, function(err, obj_file){
                if(err)
                    return get_objs(dir_objs)
                mergeObjsImgs(`${dest}${dir_objs[0]}/${obj_file[0]}`, totalimgs, function(m_res){
                    if(m_res) {
                        file.writeFile(`${dest}${dir_objs[0]}/${obj_file[0]}`, '', function (err, res) {
                            if (err)
                                console.log('please clear by hand')
                            dir_objs.splice(0, 1)
                            get_objs(dest, totalimgs, dir_objs)
                        })
                    }
                    else{
                        dir_objs.splice(0, 1)
                        get_objs(dest, totalimgs, dir_objs)
                    }
                })
            })
        }
    }
    , readDirFiles = function(destination, total_imgs){
        file.readdir(destination, function(err, dirs){
            if(err)
                return readDirFiles(destination)
            get_objs(destination, total_imgs, dirs)
        })
    }
    , startInsAction = function(){
        readImgs(imgspos, function(g_imgs){
            readDirFiles(master_dir, g_imgs)
        })
    }
var master_dir = '../../../master/'
    , bxDir = `${master_dir}downloads/bx/`
    , tc58Dir = `${master_dir}downloads/tc/`
    , imgspos = `${master_dir}downloads/imgs/imgobjs.txt`
module.exports = {
    insDbOnce: recur_ins,
    genWebLinks: function(){
        readDirFiles(bxDir).then(function(){
            console.log('finished gen all links')
        }).then(function(err){
            if(err)
                joiner.appOptErr('null', 'null', `${err}`, 'readdledfs.genWebLinks.readDirFiles(bxDir)', 'null', 'null', 'null')
        })
    }
}
//startInsAction()