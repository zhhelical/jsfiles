const fetch = require('node-fetch')
const file = require("fs")
const co = require('co')
const shell = require('./shell.js')
const joiner = require('./clients.js')
const txgeo = require('./txgeo.js')
const web_src = require('./websrc.js')
const generatorobjs = require("./readfs.js")
const generatorimgs = require("./downloadimgs.js")
const transObjTodb = require("./objstodb.js")
const generatorlinks = require("./readdledfs.js")
var master_dir = '../master/'
    , webhead = 'http://'
    , bxsite = 'baixing.com/'
    , site58 = '58.com/'
    , fetch_start = false
    , fetch_switch = false
    , interval
    , delayed = false
    , fetched = false
var fetchInterval = function(dur){
    return dur*3600000
}
var aDayInterval = function(){
    return 86400000
}
var startInterval = function(starter){
    var order_time = starter.getTime()
    var curDayEnd = new Date()
    curDayEnd.setHours(23, 59, 59, 999)
    var end_time = curDayEnd.getTime()
    return end_time-order_time
}
var loopInterval = function(dura){
    var curLoopEnd = fetchInterval(dura)
    setTimeout(function(){
        fetch_switch = false
    }, curLoopEnd)
}
var randomfunc = function(required){
        var rnum = Math.random()
        return Math.floor(rnum * required)
    }
var matchSelectedPage = function(page, f_arr){
    var absolute = ''
    for(var fp in page) {
        if(fp != 'cn') {
            absolute = page[fp].split('/')[0]
            break
        }
    }
    for(var fi in f_arr){
        if(f_arr[fi].match(absolute)) {
            f_arr.splice(fi, 1)
            return true
        }
    }
    return null
}
var interval_time = function(){
    return 180000+randomfunc(3)*60000
}
var fetchWebSite = function(page_link, rw_pos, cb){
    fetch(page_link.page).then(function(res){
        return res.buffer()
    }).then(function(buffer) {
        var fExist = function() {
            var f_names = page_link.page.split('/')
            var f_name = f_names[f_names.length-2]
            file.exists(`${rw_pos}`, function (exists) {
                if (exists) {
                    file.writeFile(`${rw_pos}${f_name}.txt`, buffer.toString('utf8'), function () {
                        console.log(`finished ${rw_pos} ${page_link.city} ${page_link.page}`)
                        cb('finished')
                    })
                }
                else {
                    var sh_order = `mkdir ${rw_pos}`
                    shell.shellFunc(sh_order).then(function (result) {
                        file.writeFile(`${rw_pos}${f_name}.txt`, buffer.toString('utf8'), function () {
                            console.log(`finished ${rw_pos} ${page_link.city} ${page_link.page}`)
                            cb('finished')
                        })
                    }).then(function (err) {
                        if (err)
                            fExist()
                    })
                }
            })
        }
        fExist()
    }).catch(function(err) {
        console.log(err)
        cb(null)
    })
}
var reCitys = function(site){
    var recitys = []
    if(!site) {
        for (var ci in web_src.qgcitys) {
            if (!web_src.qgcitys[ci].bx)
                continue
            recitys.push(web_src.qgcitys[ci].bx)
        }
    }
    else{
        for (var ci in web_src.qgcitys) {
            if (!web_src.qgcitys[ci].tc)
                continue
            recitys.push(web_src.qgcitys[ci].tc)
        }
    }
    return recitys
}
var selectCity = function(citys, lasts){
        var r_city = randomfunc(citys.length), found = false
        for(var li in lasts){
            if(lasts[li] == citys[r_city]){
                found = true
                citys.splice(r_city, 1)
                break
            }
        }
        if(found)
            selectCity(citys, lasts)
        else
            return citys[r_city]
    }
var rePages = function(random, site){
    var si = 0
    if(!site) {
        for (var pi in web_src.bxChildSite) {
            if (si == random)
                return web_src.bxChildSite[pi]
            si++
        }
    }
    else{
        for (var pi in web_src.ChildSite58) {
            if (si == random)
                return web_src.ChildSite58[pi]
            si++
        }
    }
}
var selectPage = function(pages, old_pages){
    var r_pages = randomfunc(pages.length)
    if(!matchSelectedPage(pages[r_pages], old_pages))
        return pages[r_pages]
    if(!old_pages.length)
        return null
    selectPage(pages, old_pages)
}
var loopForFetch = function(f_city, f_page, rw_dir, s_site){
    var set_inter = interval_time(), plink = ''
    console.log(set_inter)
    setTimeout(function () {
        for (var fp in f_page) {
            if (fp != 'cn') {
                plink = f_page[fp]
                break
            }
        }
        var page_link = webhead + `${f_city}.` + (s_site ? site58 : bxsite) + plink
        var link_obj = {city: f_city, page: page_link}
        fetchWebSite(link_obj, rw_dir, function () {
            console.log(`finished ${f_city} ${page_link}`)
            randomFetch(s_site)
        })
    }, set_inter)
}
var randomFetch = function(r_site){
    if(!fetch_switch || !fetch_start)
        return
    var s_citys = reCitys(r_site), o_citys = [], f_city = selectCity(s_citys, o_citys)
    var f_pages = rePages(randomfunc(5), r_site)
    var cityDir = function (city) {
        var f_root = r_site ? `${master_dir}downloads/tc/` : `${master_dir}downloads/bx/`
        //console.log(f_city)
        file.exists(`${f_root}${city}`, function (exists) {
            console.log(exists)
            if (exists) {
                file.readdir(`${f_root}${city}`, function (f_err, files) {
                    if (f_err)
                        return
                    var f_page = selectPage(f_pages, files)
                    if (!f_page) {
                        o_citys.push(city)
                        var ff_city = selectCity(s_citys, o_citys)
                        cityDir(ff_city)
                    }
                    else
                        loopForFetch(f_city, f_page, `${f_root}${city}/`, r_site)
                })
            }
            else {
                var sh_order = `mkdir ${f_root}${city}`
                console.log(sh_order)
                shell.shellFunc(sh_order).then(function (res) {
                    var olds = []
                    var f_page = selectPage(f_pages, olds)
                    loopForFetch(f_city, f_page, `${f_root}${city}/`, r_site)
                }).then(function (err) {
                    if (err)
                        cityDir(city)
                })
            }
        })
    }
    cityDir(f_city)
}
var startLoopFetch = function(dur){
    console.log('start loop')
    fetch_switch = true
    fetch_start = true
    loopInterval(dur)
    randomFetch(0)
    //randomFetch(1)
}
var startAddrFoundInterval = function(){
    setTimeout(function(){
        delayed = true
    }, 5000)
}
var reanynisAddrForClient = function(addr){
    return new Promise(function (resolve, reject) {
        txgeo.findAddrLocal(addr, function (c_res) {
            if (c_res != '系统错误，请联系管理员！')
                resolve(c_res)
            else
                reject(c_res)
        })
    })
}
var findClientsFiles = function(w_dir){
    return file.readdirSync(w_dir)
}
var chkClientsFiles = function(s_file, c_files){
    for(var ci in c_files){
        if(c_files[ci] == s_file)
            return true
    }
    return null
}
var matchCityForClient = function(city){
    for(var ci in web_src.qgcitys){
        if(web_src.qgcitys[ci].cn.match(city.cn))
            return web_src.qgcitys[ci]
    }
    return null
}
var findSrcForClient = function(city, gate){
    var bxed_citys = findClientsFiles(`${master_dir}downloads/bx`), tced_citys = findClientsFiles(`${master_dir}downloads/tc`)
    for(var ci in bxed_citys){
        if(bxed_citys[ci] == city.bxname){
            var fs_city = file.readdirSync(`${master_dir}downloads/bx/${bxed_citys[ci]}`), bx_src = JSON.stringify(web_src.finddestSrc('bx', gate))
            for(var ci in fs_city) {
                var ab_str = ''
                if(fs_city[ci].match('links'))
                    ab_str = fs_city[ci].split('links')[0]
                else
                    continue
                if(bx_src.match(ab_str)) {
                    city.bx = true
                    break
                }
            }
            break
        }
    }
    for(var ci in tced_citys){
        if(tced_citys[ci] == city.tcname){
            var fs_city = file.readdirSync(`${master_dir}downloads/tc/${tced_citys[ci]}`), tc_src = JSON.stringify(web_src.finddestSrc('tc', gate))
            for(var ci in fs_city) {
                var ab_str = ''
                if(fs_city[ci].match('links'))
                    ab_str = fs_city[ci].split('links')[0]
                else
                    continue
                if(tc_src.match(ab_str)) {
                    city.tc = true
                    break
                }
            }
            break
        }
    }
}
var fastSrcFile = function(city, site, gate, founds){
    var s_children = (site=='bx' ? web_src.bxChildSite : web_src.ChildSite58), dest = (site=='bx' ? `${master_dir}downloads/bx/${city}` : `${master_dir}downloads/tc/${city}`), s_gate = ''
    for(var si in s_children){
        if(si.match(gate)){
            s_gate = JSON.stringify(s_children[si])
            break
        }
    }
    var fs_dled = findClientsFiles(dest), f_files = founds.join()
    for(var ci in fs_dled){
        if(fs_dled[ci].match('links') && s_gate.match(fs_dled[ci].split('links')[0]) && !f_files.match(`${fs_dled[ci]}`))
            return `${dest}/${fs_dled[ci]}`
    }
    return null
}
var fastSrcAddr = function(f_file, c_local, scope, cb){
    if(delayed){
        delayed = false
        return cb(null)
    }
    var info = JSON.parse(file.readFileSync(f_file)), cal_dis = require('./distance.js')
    if(info.waddrs.length){
        var recurs_scope = function(addrs){
            if(!addrs.length)
                return cb(null)
            if(delayed){
                delayed = false
                return cb(null)
            }
            if(addrs[0] == 'null'){
                addrs.splice(0, 1)
                info.links.splice(0, 1)
                return recurs_scope(addrs)
            }
            reanynisAddrForClient(addrs[0]).then(function(local){
                var distance = cal_dis.distanceCal(local.lat, local.lng, c_local.latitude, c_local.longitude)
                console.log(distance, distance <= scope)
                if (distance <= scope)
                    return cb(info.links[0])
                else{
                    addrs.splice(0, 1)
                    info.links.splice(0, 1)
                    recurs_scope(addrs)
                }
            }).then(function(err){
                if(err) {
                    addrs.splice(0, 1)
                    info.links.splice(0, 1)
                    recurs_scope(addrs)
                }
            })
        }
        recurs_scope(info.waddrs)
    }
    else
        cb(null)
}
var find_files = function(destination, j_finding, site, f_local, c_scope, gate, cn_city, cb){
    var t_file = fastSrcFile(destination, site, gate, j_finding)
    if(t_file) {
        fastSrcAddr(t_file, f_local, c_scope, function (f_res) {
            if (f_res && !fetched) {
                console.log(f_res, 'come here')
                fetch(f_res).then(function(res){
                    fetched = true
                    return res.buffer()
                }).then(function(buffer) {
                    var info = JSON.parse(file.readFileSync(t_file)), pos = 0
                    for(var li in info.links){
                        if(info.links[li] == f_res){
                            pos = li
                            break
                        }
                    }
                    var fsn_arr = t_file.split('/')
                    var f_absolute = fsn_arr[fsn_arr.length-1], pr_name = f_absolute.split('links')[0] + '/'
                    fsn_arr.pop()
                    var re_obj = generatorobjs.getObjType(pr_name, fsn_arr.join('/'))
                    var arri_obj = {}
                    for (var rei in re_obj)
                        arri_obj[`${rei}`] = re_obj[rei]
                    if(info.wnames.length)
                        arri_obj.name = info.wnames[pos]
                    if(info.wtimes.length)
                        arri_obj.time = info.wtimes[pos]
                    if(info.waddrs && info.waddrs.length)
                        arri_obj.addrs = info.waddrs[pos]
                    arri_obj.cn_city = cn_city
                    arri_obj.link = info.links[pos]
                    arri_obj.dig = true
                    var web_page = buffer.toString('utf8')
                    generatorobjs.digWebInfo(arri_obj, web_page, function(a_res){
                        if(!a_res) {
                            delayed = false
                            fetched = false
                            return cb(null)
                        }
                        generatorimgs.digWebImgs(a_res.imgs, a_res.time, function (img_obj) {
                            if (img_obj.length) {
                                a_res.imgs = img_obj
                                a_res.link = arri_obj.link
                                transObjTodb.insDbOnce([a_res], function () {
                                    cb({from: site})
                                    delayed = false
                                    fetched = false
                                })
                            }
                            else {
                                delayed = false
                                fetched = false
                                cb(null)
                            }
                        })
                    })
                }).catch(function(err) {
                    if(err) {
                        delayed = false
                        fetched = false
                        cb(null)
                    }
                })
            }
            else{
                if(!delayed && !fetched){
                    j_finding.push(t_file)
                    find_files(destination, j_finding, site, f_local, c_scope, gate, cn_city, cb)
                }
                else {
                    delayed = false
                    fetched = false
                    cb(null)
                }
            }
        })
    }
    else
        cb(null)
}
module.exports = {
    webIndexesFetch: function(date, duration){
        fetch_start = true
        var set_interval = startInterval(date)
        setTimeout(function(){
            startLoopFetch(duration)
            var aDayLoop = aDayInterval()
            interval = setInterval(function(){
                startLoopFetch(duration)
            }, aDayLoop)
        }, set_interval)
    },
    digWebSrc: function(from_local, gate, scope, cb){
        txgeo.findLocalAddr(from_local, function (c_res) {
            if(c_res != 'error') {
                var detail_addr = c_res.split('市')[0]+'市'
                if(detail_addr.match(/省/g))
                    detail_addr = detail_addr.split('省')[1]
                var dest = matchCityForClient({cn:detail_addr})
                if(!dest.cn)
                    return cb(null)
                var m_city = {bxname:dest.bx, bx:false, tcname:dest.tc, tc:false}
                findSrcForClient(m_city, gate)
                var dest_dir = `${master_dir}downloads/`, fbx_page = '', ftc_page = ''
                console.log(m_city)
                if(m_city.tc){
                    var finding = []
                    startAddrFoundInterval()
                    find_files(dest.tc, finding, 'tc', from_local, scope, gate, detail_addr, function(e_res){
                        console.log(e_res)
                        cb(e_res)
                    })
                }
                if(m_city.bx){
                    if(!delayed)
                        startAddrFoundInterval()
                    var finding = []
                    find_files(dest.bx, finding, 'bx', from_local, scope, gate, detail_addr, function(e_res){
                        console.log(e_res, 'bx')
                        cb(e_res)
                    })
                }
                if(!m_city.tc && !m_city.bx){
                    startAddrFoundInterval()
                    var bx_city = dest_dir+`bx/${dest.bx}/`, tc_city = dest_dir+`tc/${dest.tc}/`
                    var bxcity_existed = findClientsFiles(`${dest_dir}bx/`), tcity_existed = findClientsFiles(`${dest_dir}tc/`)
                    if(gate == 'tapGates') {
                        if(chkClientsFiles(dest.bx, bxcity_existed))
                            fbx_page = selectPage(web_src.bxChildSite.bxtapGates, findClientsFiles(bx_city))
                        else
                            fbx_page = selectPage(web_src.bxChildSite.bxtapGates, [])
                        if(chkClientsFiles(dest.tc, tcity_existed))
                            ftc_page = selectPage(web_src.ChildSite58.tapGates58, findClientsFiles(tc_city))
                        else
                            ftc_page = selectPage(web_src.ChildSite58.tapGates58, [])
                    }
                    else if(gate == 'tapJobs'){
                        if(chkClientsFiles(dest.bx, bxcity_existed))
                                fbx_page = selectPage(web_src.bxChildSite.bxtapJobs, findClientsFiles(bx_city))
                        else
                            fbx_page = selectPage(web_src.bxChildSite.bxtapJobs, [])
                        if(chkClientsFiles(dest.tc, tcity_existed))
                            ftc_page = selectPage(web_src.ChildSite58.tapJobs58, findClientsFiles(tc_city))
                        else
                            ftc_page = selectPage(web_src.ChildSite58.tapJobs58, [])
                    }
                    else if(gate == 'tapServes'){
                        if(chkClientsFiles(dest.bx, bxcity_existed))
                            fbx_page = selectPage(web_src.bxChildSite.bxtapServes, findClientsFiles(bx_city))
                        else
                            fbx_page = selectPage(web_src.bxChildSite.bxtapServes, [])
                        if(chkClientsFiles(dest.tc, tcity_existed))
                            ftc_page = selectPage(web_src.ChildSite58.tapServes58, findClientsFiles(tc_city))
                        else
                            ftc_page = selectPage(web_src.ChildSite58.tapServes58, [])
                    }
                    else if(gate == 'tapRend'){
                        if(chkClientsFiles(dest.bx, bxcity_existed))
                            fbx_page = selectPage(web_src.bxChildSite.bxtapRend, findClientsFiles(bx_city))
                        else
                            fbx_page = selectPage(web_src.bxChildSite.bxtapRend, [])
                        if(chkClientsFiles(dest.tc, tcity_existed))
                            ftc_page = selectPage(web_src.ChildSite58.tapRend58, findClientsFiles(tc_city))
                        else
                            ftc_page = selectPage(web_src.ChildSite58.tapRend58, [])
                    }
                    else{
                        if(chkClientsFiles(dest.bx, bxcity_existed))
                            fbx_page = selectPage(web_src.bxChildSite.bxtapOlds, findClientsFiles(bx_city))
                        else
                            fbx_page = selectPage(web_src.bxChildSite.bxtapOlds, [])
                        if(chkClientsFiles(dest.tc, tcity_existed))
                            ftc_page = selectPage(web_src.ChildSite58.tapOlds58, findClientsFiles(tc_city))
                        else
                            ftc_page = selectPage(web_src.ChildSite58.tapOlds58, [])
                    }
                    dest_dir = bx_city
                    if(fbx_page) {
                        var plink = ''
                        for (var fp in fbx_page) {
                            if (fp != 'cn') {
                                plink = fbx_page[fp]
                                break
                            }
                        }
                        var page_link = webhead + `${dest.bx}.` + bxsite + plink
                        var link_obj = {city: dest.bx, page: page_link}
                        fetchWebSite(link_obj, dest_dir, function (f_fetched) {
                            if(f_fetched){
                                generatorlinks.genWebLinks('bx').then(function(){
                                    var finding = []
                                    find_files(dest.bx, finding, 'bx', from_local, scope, gate, detail_addr, function(e_res){
                                        console.log(e_res)
                                        cb(e_res)
                                    })
                                }).then(function(err){
                                    if(err){
                                        console.log('failed for links')
                                        cb(null)
                                    }
                                })
                            }
                            else{
                                console.log('failed for links')
                                cb(null)
                            }
                        })
                    }
                    dest_dir = tc_city
                    if(ftc_page) {
                        var plink = ''
                        for (var fp in ftc_page) {
                            if (fp != 'cn') {
                                plink = ftc_page[fp]
                                break
                            }
                        }
                        var page_link = webhead + `${dest.tc}.` + site58 + plink
                        var link_obj = {city: dest.tc, page: page_link}
                        fetchWebSite(link_obj, dest_dir, function (f_fetched) {
                            if(f_fetched){
                                generatorlinks.genWebLinks('tc').then(function(){
                                    console.log(`finished download ${plink} ${page_link}`)
                                    var finding = []
                                    find_files(dest.tc, finding, 'tc', from_local, scope, gate, detail_addr, function(e_res){
                                        console.log(e_res)
                                        cb(e_res)
                                    })
                                }).then(function(err){
                                    if(err){
                                        console.log('failed for links')
                                        cb(null)
                                    }
                                })
                            }
                            else{
                                console.log('failed for links')
                                cb(null)
                            }
                        })
                    }
                }
            }
            else {
                if(c_res) {
                    joiner.appOptErr('null', JSON.stringify(from_local), `${c_res}`, 'fetchweb.digWebSrc.txgeo.localToAddr', 'null', 'null', 'null')
                    cb(null)
                }
            }
        })
    },
    stopWebAction: function(){
        fetch_start = false
        fetch_switch = false
        clearInterval(interval)
    }
}

//startLoopFetch()
