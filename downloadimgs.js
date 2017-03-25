//downloadimgs.js
const file = require("fs")
const co = require('co')
const http = require("http-request")
const imginfo = require('imageinfo')
const shell = require('./shell.js')
const web_src = require('./websrc.js')
var master_dir = '../../../master/'
    , bxDir = `${master_dir}downloads/bx/`
    , tc58Dir = `${master_dir}downloads/tc/`
    , imgspos = `${master_dir}downloads/imgs/`
    , bximgspos = `${master_dir}downloads/imgs/imgedlinks/bx/`
    , tcimgspos = `${master_dir}downloads/imgs/imgedlinks/tc/`
    , randomfunc = function(required){
        var rnum = Math.random()
        return Math.floor(rnum * required)
    }
    , interval_time = function(){
        return 180000+randomfunc(3)*60000
    }
    , cleanCommHtml = function(cons){
        var revar = new RegExp("<div class='viewad-main'>(.|\r|\n)*<\/div>", "g")
        var container = cons.match(revar)[0]
        return container
    }
    , rd_evdir = function(destination, d_fs){
        var dest = `${destination}${d_fs}`
        return file.readdirSync(dest)
    }
    , rm_imgedAct = function (link, path) {
        var old_dlinks = JSON.parse(file.readFileSync(path))
        for(var oi in old_dlinks){
            if(old_dlinks.links[oi] == link){
                old_dlinks.links.splice(oi, 1)
                if(old_dlinks.wnames.length)
                    old_dlinks.wnames.splice(oi, 1)
                if(old_dlinks.wtimes.length)
                    old_dlinks.wtimes.splice(oi, 1)
                if(old_dlinks.waddrs.length)
                    old_dlinks.waddrs.splice(oi, 1)
                break
            }
        }
        if(!old_dlinks.length){
            var sh_order = `rm -rf ${path}`
            shell.shellFunc(sh_order).then(function (result) {}).then(function (err) {
                if (err)
                    console.log(err)
            })
        }
        else
            file.writeFile(path, JSON.stringify(old_dlinks), function () {})
    }
    , recurFecth = function(dest, p_links, d_imgs, cb){
        if(!p_links.length)
            cb(d_imgs)
        else {
            var l_pics = chkPicsOnLink(p_links[0].http, type)
            if(!l_pics.pics){
                p_links.splice(0, 1)
                recurFecth(p_links, d_imgs, cb)
            }
            else {
                var set_inter = interval_time()
                setTimeout(function () {
                    var d_objs = {http:p_links[0].http, imgs:[]}
                    getwebImg(p_links[0].imgs, l_pics.time, d_objs.imgs, function(){
                        var f_path = ''
                        if(dest.match('bx'))
                            f_path = `${bxDir}`
                        else
                            f_path = `${tc58Dir}`
                        f_path += p_links[0].en_city+'/'
                        rm_imgedAct(p_links[0].http, f_path)
                        p_links.splice(0, 1)
                        d_imgs.push(d_objs)
                        recurFecth(p_links, d_imgs, cb)
                    })
                }, set_inter)
            }
        }
    }
    , getwebImg = function(urls, time, down_arr, cb){
        if(!urls.length)
            cb('download imgs finished')
        else {
            var sh_order = 'head -n 80 /dev/urandom | tr -dc A-Za-z0-9 | head -c 32'
            shell.shellFunc(sh_order).then(function (result) {
                var options = {url: urls[0], encoding: 'binary'}
                http.get(options, `${imgspos}imgslist/${result}`, function (err, res) {
                    if (err) {
                        console.log(err)
                        getwebImg(urls, time, down_arr, cb)
                    }
                    else {
                        var f_info = file.readFileSync(`${imgspos}imgslist/${result}`)
                        var img_info = imginfo(f_info)
                        var size = file.statSync(`${imgspos}imgslist/${result}`).size
                        var values = {
                            img_time: time,
                            img_key: '',
                            img_size: img_info.width + '?&' + img_info.height + '?&' + size,
                            img_pos: urls.length - 1,
                            img_local: '',
                            img_name: result
                        }
                        down_arr.push(values)
                        console.log(down_arr)
                        urls.splice(0, 1)
                        getwebImg(urls, time, down_arr, cb)
                    }
                })
            }).then(function (err) {
                if (err) {
                    urls.splice(0, 1)
                    getwebImg(urls, time, down_arr, cb)
                }
            })
        }
    }
    , chkPicsOnLink = function(link, o_fs, cb){
        var objs_pos = ''
        if(o_fs.match('tapGates'))
            objs_pos = `${master_dir}tapGatesObjs/gatesobjs.txt`
        else if(o_fs.match('tapJobs'))
            objs_pos = `${master_dir}tapJobsObjs/jobsobjs.txt`
        else if(o_fs.match('tapServes'))
            objs_pos = `${master_dir}tapServesObjs/servesobjs.txt`
        else if(o_fs.match('tapRend'))
            objs_pos = `${master_dir}tapRendObjs/rendsobjs.txt`
        else
            objs_pos = `${master_dir}tapOldsObjs/oldsobjs.txt`
        var f_obj = JSON.parse(file.readFileSync(objs_pos)), pics_time = {pics:0, time:''}
        for(var fi in f_obj){
            if(f_obj[fi].link == link){
                pics_time.time = f_obj[fi].time
                pics_time.pics = f_obj[fi].pictures
                break
            }
        }
        return pics_time
    }
    , rd_imgsobjs = function(destination, rddirs, rdfs){
        if(!rddirs.length)
            return
        if(!rdfs.length) {
            rddirs.splice(0, 1)
            return rd_files(rddirs, rdfs)
        }
        var arr_tolimgs = []
        var f_path = `${destination}${rddirs[0]}/${rdfs}`
        var f_obj = JSON.parse(file.readFileSync(f_path))
        recurFecth(destination, f_obj, arr_tolimgs, function(r_res){
            var old_total = []
            var of_old = file.readFileSync(`${imgspos}imgobjs.txt`)
            if(of_old)
                old_total = JSON.parse(of_old)
            for(var ari in r_res)
                old_total.push(r_res[ari])
            file.writeFile(`${imgspos}imgobjs.txt`, JSON.stringify(old_total), function () {
                rdfs.splice(0, 1)
                rd_files(rdfs)
            })
        })
    }
    , readDirFiles = function(destination){
        file.readdir(destination, function(err, rd_dirs){
            if(err){
                console.log(err)
                return
            }
            rd_files(destination, rd_dirs, rd_evdir(destination, rd_dirs[0]))
        })
    }
    , startLoopFetch = function(){
        console.log('start loop')
        fetch_switch = true
        loopInterval()
        readDirFiles(bxDir)
    }
module.exports = {
    digWebImgs: function(dlink, dtime, cb){
        var ded_res = []
        getwebImg(dlink, dtime, ded_res, function(){
            cb(ded_res)
        })
    },
    genWebImgs: function(){
        fetch_start = true
        var set_interval = startInterval(new Date())
        setTimeout(function(){
            startLoopFetch()
            var aDayLoop = aDayInterval()
            interval = setInterval(function(){
                startLoopFetch()
            }, aDayLoop)
        }, set_interval)
    },
    stopWebAction: function(){
        fetch_start = false
        fetch_switch = false
        clearInterval(interval)
    }
}

//readDirFiles(bxDir)