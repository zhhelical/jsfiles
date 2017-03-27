//readdledfs.js
const file = require("fs")
const co = require('co')
const timegen = require('./time.js')
const joiner = require('./clients.js')
const shell = require('./shell.js')
const web_src = require('./websrc.js')
var rd_filefunc = function (w_site, rd_files, path_files, cb) {
        if (!rd_files.length)
            cb('finished')
        else {
            if(rd_files[0].match('.txt')) {
                var f_path = `${path_files}/${rd_files[0]}`
                file.readFile(f_path, function (err, res) {
                    if(w_site == bxDir) {
                        analyseBxIndexPage(f_path, res.toString('utf8'), function () {
                            var city_dir = path_files.split('/'), ca_dir = city_dir[city_dir.length - 1]
                            file.exists(`${bxlinkedtxts}${ca_dir}`, function (exists) {
                                if (exists)
                                    mvLinkedFile(f_path, `${bxlinkedtxts}${ca_dir}/`).then(function () {
                                    }).then(function (err) {
                                        if(err)
                                            mvLinkedFile(f_path, `${bxlinkedtxts}${ca_dir}/`)
                                    })
                                else {
                                    var mk_order = `mkdir ${bxlinkedtxts}${ca_dir}`
                                    shell.shellFunc(mk_order).then(function () {
                                        mvLinkedFile(f_path, `${bxlinkedtxts}${ca_dir}/`).then(function () {
                                        }).then(function (err) {
                                            if(err)
                                                mvLinkedFile(f_path, `${bxlinkedtxts}${ca_dir}/`)
                                        })
                                    }).then(function (err) {
                                        if (err)
                                            mvLinkedFile(f_path, `${bxlinkedtxts}${ca_dir}/`).then(function () {
                                            }).then(function (err) {
                                                if(err)
                                                    mvLinkedFile(f_path, `${bxlinkedtxts}${ca_dir}/`)
                                            })
                                    })
                                }
                            })
                            rd_files.splice(0, 1)
                            rd_filefunc(w_site, rd_files, path_files, cb)
                        })
                    }
                    else{
                        analyseTcIndexPage(f_path, res.toString('utf8'), function (){
                            var city_dir = path_files.split('/'), ca_dir = city_dir[city_dir.length - 1]
                            file.exists(`${tclinkedtxts}${ca_dir}`, function (exists) {
                                if (exists)
                                    mvLinkedFile(f_path, `${tclinkedtxts}${ca_dir}/`).then(function () {
                                    }).then(function (err) {
                                        if(err)
                                            mvLinkedFile(f_path, `${tclinkedtxts}${ca_dir}/`)
                                    })
                                else {
                                    var mk_order = `mkdir ${tclinkedtxts}${ca_dir}`
                                    shell.shellFunc(mk_order).then(function () {
                                        mvLinkedFile(f_path, `${tclinkedtxts}${ca_dir}/`).then(function () {
                                        }).then(function (err) {
                                            if(err)
                                                mvLinkedFile(f_path, `${tclinkedtxts}${ca_dir}/`)
                                        })
                                    }).then(function (err) {
                                        if (err)
                                            mvLinkedFile(f_path, `${tclinkedtxts}${ca_dir}/`).then(function () {
                                            }).then(function (err) {
                                                if(err)
                                                    mvLinkedFile(f_path, `${tclinkedtxts}${ca_dir}/`)
                                            })
                                    })
                                }
                            })
                            rd_files.splice(0, 1)
                            rd_filefunc(w_site, rd_files, path_files, cb)
                        })
                    }
                })
            }
            else{
                rd_files.splice(0, 1)
                rd_filefunc(w_site, rd_files, path_files, cb)
            }
        }
    }
    , rd_dirfunc = function(f_pos, rd_dirs, cb){
        if(!rd_dirs.length)
            return cb('total finished')
        var path_files = f_pos + rd_dirs[0]
        file.readdir(path_files, function (f_err, files) {
            if (f_err)
                return cb(f_err)
            rd_filefunc(f_pos, files, path_files, function(res){
                rd_dirs.splice(0, 1)
                rd_dirfunc(f_pos, rd_dirs, cb)
            })
        })
    }
    , mvLinkedFile = function(l_file, new_pos){
        var sh_order = `mv ${l_file} ${new_pos}`
        return new Promise(function (resolve, reject){
            shell.shellFunc(sh_order).then(function () {
                resolve()
            }).then(function (err) {
                if (err)
                    reject(err)
            })
        })
    }
    , labelFindParent = function(cons, strs){
        var nets_cell = strs+'(.*?)\/[a-z]+>', revar = new RegExp(nets_cell, "g")
        var mp_ps = cons.match(revar)
        if(mp_ps)
            return mp_ps[0]
        return null
    }
    , findSpecialHtml = function(cons, specs){
        var revar = new RegExp(specs, "g")
        var f_match = cons.match(revar)
        if(f_match)
            return f_match[0]
        return null
    }
    , findAddrCity = function(en_city){
        console.log(en_city)
        var qgaddrs = web_src.qgcitys
        for(var qi in qgaddrs){
            if(JSON.stringify(qgaddrs[qi]).match(en_city))
                return qgaddrs[qi].cn
        }
        return null
    }
    , analyseBxIndexPage = function(rdfile, info, cb){
        var revar = new RegExp("<div\\s+class='preview-hover'>(.*?)<div\\s+class='wellfares-badges'>", "g"), names = [], times = [], addrs = [], i_link = []
        var dds = info.match(revar)
        if(!dds) {
            revar = new RegExp("class='waterdrop(.*?)>(.|\r|\n)*?<\/div>", "g")
            dds = info.match(revar)
            if(!dds){
                revar = new RegExp("<li\\s+data-aid=(.|\n|\r)*?<\/li>", "g")
                dds = info.match(revar)
                for (var ii in dds) {
                    link = dds[ii].match(/<a href='http:\/\/[^\s]*?'/g)
                    if (link && !link[0].match(/www.baixing.com/g)) {
                        i_link.push(link[0].replace(/'|<a href=/g, ''))
                        time = dds[ii].match(/<time>(.*?)<\/time>/g)
                        if(time)
                            times.push(time[0].replace(/[^\u4e00-\u9fa5|0-9|\s|:]*/g, ''))
                        else
                            times.push(timegen.formatYmdTime(new Date()))
                        var name = dds[ii].match(/class='ad-title'(.|\n|\r)*?<|class='table-view-cap job-list'(.|\n|\r)*?<\/div>/g)
                        if(name)
                            names.push(name[0].replace(/<|>|class='ad-title'|class='table-view-cap job-list'/g, ''))
                        else
                            names.push('null')
                        var addr = dds[ii].match(/\[([^层|共]*?)]/g)
                        if(addr)
                            addrs.push(addr[0].replace(/\[|]/g, ''))
                        else {
                            addr = dds[ii].match(/class='ad-item-detail'(.*?)<\/div>/g)
                            if(addr)
                                addrs.push(addr[0].replace(/class='ad-item-detail'|>|<(.*?)>/g, ''))
                            else
                                addrs.push('null')
                        }
                    }
                }
            }
            else {
                for (var ii in dds) {
                    var ddsi = dds[ii].match(/http:\/\/[^\s]+html/g)
                    if (ddsi && !ddsi[0].match(/www.baixing.com/g)) {
                        i_link.push(ddsi[0])
                        var name = labelFindParent(dds[ii], "class='waterfall-title'")
                        if(name)
                            names.push(name.replace(/<(.*?)>/g, '').replace(/(.*?)>/g, ''))
                        else
                            names.push('null')
                        var addr = findSpecialHtml(dds[ii], "class='meta-location'(.*?)\/(.*?)>")
                        if(addr)
                            addrs.push(addr.replace(/<(.*?)>/g, '').replace(/(.*?)>/g, ''))
                        else
                            addrs.push('null')
                    }
                }
            }
        }
        else {
            for (var ii in dds) {
                link = dds[ii].match(/http:\/\/[^\s]*\'/g)
                if (link && !link[0].match(/www.baixing.com/g)) {
                    i_link.push(link[0].replace(/'/g, ''))
                    time = dds[ii].match(/<time>(.*?)<\/time>/g)
                    if(time)
                        times.push(time[0].replace(/[^\u4e00-\u9fa5|0-9|\s]+/g, ''))
                    else
                        times.push(timegen.formatYmdTime(new Date()))
                    var name = dds[ii].match(/<div class='table-view-cap job-list'>(.*?)<\/div>/g)
                    if(name)
                        names.push(name[0].replace(/<(.*?)>/g, '').split('/')[0])
                    else
                        names.push('null')
                    var addr = dds[ii].match(/(class='ad-item-detail'|class='table-view-cap\s+job-list')(.|\n|\r)*?<\/div>/g)
                    if(addr){
                        var s_match = addr[0].match(/>[\u4e00-\u9fa5|\u3002|\uff1f|\uff01|\uff0c|\u3001|\uff1b|\uff1a|\u201c|\u201d|\u2018|\u2019|\uff08|\uff09|\u300a|\u300b|\u3008|\u3009|\u3010|\u3011|\u300e|\u300f|\u300c|\u300d|\ufe43|\ufe44|\u3014|\u3015|\u2026|\u2014|\uff5e|\ufe4f|\uffe5|0-9|-|/|\s]+</g)
                        if(s_match)
                            addrs.push(s_match[0].replace(/<|>/g, '').split('/')[1])
                        else
                            addrs.push('null')
                    }
                }
            }
        }
        var fs_tname = rdfile.split('/'), n_tail = fs_tname[fs_tname.length-1].split('.')[0], cn_city = findAddrCity(fs_tname[fs_tname.length-2]), q_str = cn_city.match('市') ? '市' : '省', c_match = cn_city.split(q_str)[0]
        for(var ai in addrs){
            if(addrs[ai]) {
                addrs[ai] = addrs[ai].replace(/[^\u4e00-\u9fa5]/g, '')
                if (addrs[ai] && !addrs[ai].match(c_match))
                    addrs[ai] = cn_city + addrs[ai]
            }
        }
        var obj_write = {links:i_link, wnames:names, wtimes:times, waddrs:addrs}
        var fs_name = n_tail+'links'
        fs_tname.pop()
        fs_name = fs_tname.join('/')+'/'+fs_name
        file.writeFile(fs_name, JSON.stringify(obj_write), function () {
            cb(`finished`)
        })
    }
    , analyseTcIndexPage = function(rdfile, info, cb){
        console.log(rdfile)
        var revar = new RegExp("<(.*?)id=\"infolist\"(.|\r|\n|\t)*?id=\"rightframe\"", "g"), names = [], times = [], addrs = [], i_link = []
        var dds = info.match(revar)
        if(!dds) {
            revar = new RegExp("<div\\s+class=\"listBox\">(.|\r|\n|\t)*?id=\"rightframe\"", "g")
            dds = info.match(revar)
            if(!dds){

            }
            else {
                revar = new RegExp("logr=(.|\n|\r|\t)*?<\/li>", "g")
                var ddsi = dds[0].match(revar)
                for (var ii in ddsi) {
                    var link = ddsi[ii].match(/http:\/\/[^\s]+("|')/g)
                    if (link) {
                        i_link.push(link[0].replace(/"|'/g, ''))
                        var name = ddsi[ii].match(/<p(.|\r|\n)*?<\/p>/g)
                        if(name)
                            names.push(name[0].replace(/<(.*?)>|&nbsp;/g, '').replace(/\s+/g, ' '))
                        else
                            names.push('null')
                        var addr = ddsi[ii].match(/<p\s+class="add">(.|\r|\n)*?<\/p>/g)
                        if(addr)
                            addrs.push(addr[0].replace(/<(.|\r|\n)*?>|&nbsp;/g, ' ').replace(/\s+/g, ' '))
                        else
                            addrs.push('null')
                    }
                }
            }
        }
        else {
            revar = new RegExp("<(tr|dl|div)\\s+logr=(.|\r|\n|\t)*?<(\/tr>|\/dl>|<div)", "g")
            var ddsi = dds[0].match(revar)
            for (var ii in ddsi) {
                var link = ddsi[ii].match(/<a\s+href=('|")http:\/\/[^\s]+('|")/g)
                if (link) {
                    i_link.push(link[0].replace(/'|"|<a\s+href=/g, ''))
                    var name = ddsi[ii].match(/<p\s+class="seller">(.|\r|\n|\t)*?\/p>/g)
                    if (name)
                        names.push(name[0].replace(/<(.*?)>|\r|\n|\t/g, '').replace(/\s+/g, ' ').split('会员')[0])
                    else {
                        name = ddsi[ii].match(/<dd(.*?)>(.|\r|\n|\t)*?\/dd>/g)
                        if(name)
                            names.push(name[1].replace(/<(.*?)>|\r|\n|\t/g, ''))
                        else{
                            name = ddsi[ii].match(/<span(.*?)>(.|\r|\n|\t)*?\/span>/g)
                            if(name)
                                names.push(name[name.length-1].replace(/<(.*?)>|\r|\n|\t/g, ''))
                            else
                                names.push('null')
                        }
                    }
                    var addr = ddsi[ii].match(/(<dd|<span)(.|\n|\r|\t)*?(<\/dd>|<\/span>)/g)
                    if (addr) {
                        if(ddsi[ii].match(/<\/dd>/g))
                            addrs.push(addr[addr.length - 2].replace(/<(.*?)>|\n|\r|\t/g, ''))
                        else
                            addrs.push(addr[addr.length - 1].replace(/<(.*?)>|\n|\r|\t/g, ''))
                    }
                    else
                        addrs.push('null')
                }
            }
        }
        var obj_write = {links:i_link, wnames:names, wtimes:times, waddrs:addrs}
        var fs_tname = rdfile.split('/'), n_tail = fs_tname[fs_tname.length-1].split('.')[0]
        var fs_name = n_tail+'links'
        fs_tname.pop()
        fs_name = fs_tname.join('/')+'/'+fs_name
        file.writeFile(fs_name, JSON.stringify(obj_write), function () {
            cb(`finished`)
        })
    }
    , readDirFiles = function(destination){
        return new Promise(function (resolve, reject){
            file.readdir(destination, function(err, dirs){
                //console.log(dirs)
                if(err)
                    reject(err)
                rd_dirfunc(destination, dirs, function(res){
                    if(res != 'total finished')
                        reject(res)
                    else
                        resolve(res)
                })
            })
        })
    }
    , readFile = function(destination){
        var fs_dir = file.readdirSync(destination)
        return JSON.parse(file.readFileSync(fs_dir[0]))
    }
var master_dir = '../master/'
    , bxDir = `${master_dir}downloads/bx/`
    , tc58Dir = `${master_dir}downloads/tc/`
    , bxlinkedtxts = `${master_dir}downloads/genedlinkstxts/bx/`
    , tclinkedtxts = `${master_dir}downloads/genedlinkstxts/tc/`
module.exports = {
    genWebLinks: function(w_site){
        var dest_site = ''
        if(w_site == 'bx')
            dest_site = bxDir
        else
            dest_site = tc58Dir
        return new Promise(function (resolve, reject) {
            readDirFiles(dest_site).then(function () {
                resolve('finished gen all links')
            }).then(function (err) {
                if (err) {
                    joiner.appOptErr('null', 'null', `${err}`, 'readdledfs.genWebLinks.readDirFiles(bxDir)', 'null', 'null', 'null')
                    reject(err)
                }
            })
        })
    },
    genDestLinks: function(f_dest){
        var p_info = readFile(f_dest)
        return readFile(f_dest)
    }
}
/*readDirFiles(bxDir).then(function(){
    console.log('finished gen all links')
}).then(function(err){
    if(err)
        console.log(err)
        //joiner.appOptErr('null', 'null', `${err}`, 'readdledfs.genWebLinks.readDirFiles(bxDir)', 'null', 'null', 'null')
})*/
