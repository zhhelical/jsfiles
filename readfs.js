//readfs.js
const file = require("fs")
const fetch = require('node-fetch')
const co = require('co')
const joiner = require('./clients.js')
const txgeo = require('./txgeo.js')
const time_gen = require('./time.js')
const web_src = require('./websrc.js')
var randomfunc = function(required){
        var rnum = Math.random()
        return Math.floor(rnum * required)
    }
    , interval_time = function(){
        return 60000+randomfunc(3)*60000
    }
    , reanynisAddr = function(addr){
        return new Promise(function (resolve, reject) {
            txgeo.findAddrLocal(addr, function (c_res) {
                if (c_res != '系统错误，请联系管理员！')
                    resolve(c_res)
                else
                    reject(c_res)
            })
        })
    }
    , reanynisCity = function(c_py, w_site){
        var en_site = w_site.split('/'), dest = en_site[en_site.length-2]
        for(var bxi in web_src.qgcitys){
            if(web_src.qgcitys[bxi][dest] == c_py)
                return web_src.qgcitys[bxi].cn
        }
        return null
    }
    , reanynisType = function(name, w_site){
        var en_site = w_site.split('/'), dest = en_site[en_site.length-2], childSite = (dest=='bx' ? web_src.bxChildSite : web_src.ChildSite58)
        for(var bxi in childSite){
            var cbx_objs = childSite[bxi]
            for(var bii in cbx_objs){
                var obj_atrrs = cbx_objs[bii]
                for(var boi in obj_atrrs) {
                    if(obj_atrrs[boi] == name){
                        var real_obj = {type:bxi}
                        if(obj_atrrs.hasOwnProperty('cn'))
                            real_obj.cn = obj_atrrs.cn
                        if(bxi.match('tapRend'))
                            real_obj.noseq = boi
                        return real_obj
                    }
                }
            }
        }
    }
    , cleanCommHtml = function(cons, site){
        var revar = new RegExp("<div\\s+class='viewad-main'>(.|\r|\n)*<\/div>", "g")
        if(site.type.match('58'))
            revar = new RegExp("<div\\s+class=(.*?)main(.*?)>(.|\r|\n)*<\/div>", "g")
        var container = cons.match(revar)
        if(container)
            return container[0]
        return null
    }
    , cleanSpecialHtml = function(cons, specs){
        var revar = new RegExp(specs, "g")
        var container = cons.replace(revar, '')
        return container
    }
    , findSpecialHtml = function(cons, specs){
        var revar = new RegExp(specs, "g")
        var f_match = cons.match(revar)
        if(f_match)
            return f_match[0]
        return null
    }
    , labelFindParent = function(cons, strs){
        var nets_cell = strs+'(.|\r|\n)*?\/[a-z]+>', revar = new RegExp(nets_cell, "g")
        var mp_ps = cons.match(revar)
        if(mp_ps)
            return mp_ps[0]
        return null
    }
    , analyseAddrCity = function(addr_obj, gates){
        var fr_city = gates.cn_city.split('市')[0], head_str = `^${fr_city}`
        if(fr_city == gates.cn_city)
            fr_city = gates.cn_city.split('省')[0]
        var revar = new RegExp(head_str, "g")
        if(!addr_obj.address.match(revar))
            addr_obj.address = gates.cn_city+addr_obj.address
        else{
            if(!addr_obj.address.match('市') || !addr_obj.address.match('省'))
                addr_obj.address = gates.cn_city+addr_obj.address.split(fr_city)[1]
        }
    }
    , saveImgLinks = function(m_link, links, cb){
        var imgs_links = '', imgs_obj = {http:m_link.link, imgs:links, city:m_link.en_city}, dimgs_arr = []
        if(m_link.type.match('bx'))
            imgs_links = `${imgspos}bx/`
        else
            imgs_links = `${imgspos}tc/`
        if(m_link.type.match('tapGates'))
            imgs_links += 'tapGatesImgs/gatesimgs.txt'
        else if(m_link.type.match('tapJobs'))
            imgs_links += 'tapJobsImgs/jobsimgs.txt'
        else if(m_link.type.match('tapServes'))
            imgs_links += 'tapServesImgs/servesimgs.txt'
        else if(m_link.type.match('tapRend'))
            imgs_links += 'tapRendImgs/rendsimgs.txt'
        else
            imgs_links += 'tapOldsImgs/oldsimgs.txt'
        var size = file.statSync(imgs_links).size
        if(size)
            dimgs_arr = JSON.parse(file.readFileSync(imgs_links))
        dimgs_arr.push(imgs_obj)
        file.writeFile(imgs_links, JSON.stringify(dimgs_arr), function (err, res) {
            if(err)
                return saveImgLinks(m_link, links, cb)
            cb('finished')
        })
    }
    , analyseWebForGate = function(gates, info, cb){
        info = cleanCommHtml(info, gates)
        var arri_obj = {time:(gates.time ? gates.time : ''), location:{longitude:'', latitude:''}, pictures:0, content:{add_key:'tapGates', add_value:[
            {id:'gate0', name:(gates.cn ? gates.cn : '')}, {id:'gate1', name:gates.name ? gates.name : ''}, {id:'gate2', contents:''}, {id:'gate4', contents:''}
        ]}, address:''}, addr = '', area = ''
        var cnStrs = info.match(/<div class='viewad-meta2-item.*?>(.|\n|\r)*?<\/div>/g)
        if(gates.type.match('58'))
            cnStrs = info.match(/<div\s+class="newinfo">(.|\n|\r)*?<\/div>/g)
        for(var ci in cnStrs) {
            if(gates.type.match('bx')) {
                if (cnStrs[ci].match(/所在地/g))
                    addr = cnStrs[ci].replace(/<.*?target='_blank'.*?>/g, ' ').replace(/<.*?>|所在地：/g, '')
                if (cnStrs[ci].match(/服务范围/g))
                    area = cnStrs[ci].replace(/<.*?target='_blank'.*?>/g, ' ').replace(/<.*?>|&nbsp;/g, '')
            }
            else{
                var addr_test = cnStrs[ci].match(/<span\s+class="adr">(.*?)<\/span>/g)
                if(addr_test)
                    addr = addr_test[0].replace(/<(.*?)>/g, '').replace(/(-|\s+)/g, '')
            }
        }
        arri_obj.address = addr ? addr : area
        if(!arri_obj.address)
            return cb(null)
        analyseAddrCity(arri_obj, gates)
        reanynisAddr(arri_obj.address).then(function (a_res) {
            arri_obj.location.longitude = a_res.lng
            arri_obj.location.latitude = a_res.lat
            var imgs_arr = []
            var p_labels = labelFindParent(info, '首次发布于')
            if(gates.type.match('58'))
                p_labels = labelFindParent(info, 'title="发布日期"')
            arri_obj.time = p_labels.replace(/<.*?>|首次发布于：|&nbsp;/g, '').replace(/.*?>/g, '')
            for(var ci in cnStrs) {
                if(gates.type.match('bx')) {
                    if (cnStrs[ci].match(/服务内容/g)) {
                        var f_con = cnStrs[ci].replace(/<\/div>/g, '\n').replace(/<.*?target='_blank'.*?>/g, ' ').replace(/<.*?>/g, '')
                        if (!f_con.match(/服务内容/g))
                            arri_obj.content.add_value[2].contents += '服务内容：' + f_con
                        else
                            arri_obj.content.add_value[2].contents += f_con
                        break
                    }
                }
                else{
                    revar = new RegExp("<div\\s+class=\"descriptionBox\">(.|\r|\n|\t)*?<\/div>", "g")
                    var detail = info.match(revar)
                    if(detail){
                        var artical = detail[0].match(/<article(.|\r|\n)*?(\/article)>/g)
                        if(artical)
                            arri_obj.content.add_value[2].contents = artical[0].replace(/<(\/p)>/g, '\n').replace(/&nbsp;|<(.|\r|\n|\t)*?>/g, '').replace(/(\n+)/g, '\n')
                    }
                }
            }
            if(gates.type.match('bx')) {
                arri_obj.content.add_value[2].contents += area.match(/服务范围/g) ? area : '服务范围：' + area
                arri_obj.content.add_value[2].contents += addr.match(/所在地/g) ? addr : '所在地：' + addr
            }
            revar = new RegExp("<strong>([0-9]|-)+<\/strong>", "g")
            var p_num = info.match(revar)
            if(gates.type.match('58'))
                p_num = info.match(/sphone:'(1(3|4|5|7|8)\d{9}|0\d{2,3}-?\d{7,8})/g)
            if(p_num)
                arri_obj.content.add_value[3].contents = '联系电话：'+p_num[0].replace(/(<.*?>|sphone:|')/g, '')
            revar = new RegExp("<div\\s+class='photo-item(.*?)<\/div>", "g")
            if(gates.type.match('58'))
                revar = new RegExp("<div\\s+id=\"img_player1\">(.|\n|\r)*?<\/div>", "g")
            var images = info.match(revar)
            if(gates.type.match('bx'))
                for (var imi in images) {
                    var image = images[imi].match(/http:[^\s]+(\)|"|')/g)
                    if(image)
                        imgs_arr.push(image[0].replace(/\)|"|'/g, ''))
                    if (imgs_arr.length == 3)
                        break
                }
            else{
                var src_images = images[0].match(/http:[^\s]+(\)|"|')/g)
                for (var imi in src_images) {
                    imgs_arr.push(src_images[imi].replace(/\)|"|'/g, ''))
                    if (imgs_arr.length == 3)
                        break
                }
            }
            arri_obj.pictures = imgs_arr.length
            if(gates.dig)
                arri_obj.imgs = imgs_arr
            saveImgLinks(gates, imgs_arr, function(){
                cb(arri_obj)
            })
        }).then(function (err) {
            if (err)
                cb(null)
        })
    }
    , analyseWebForJob = function(gates, info, cb){
        if(gates.name == 'null')
            return cb(null)
        var arri_obj = {time:(gates.time ? gates.time : ''), location:{longitude:'', latitude:''}, pictures:0, content:{add_key:'tapJobs', add_value:[
            {id:'gate0', name:(gates.name ? gates.name : '')}, {id:'gate1', contents:''}, {id:'gate2', contents:''}, {id:'gate4', contents:''}
        ]}, address:''}, addr = ''
        var cnStrs = info.match(/<div class='viewad-meta2-item.*?>(.|\n|\r)*?<\/div>/g)
        if(gates.type.match('58'))
            cnStrs = info.match(/<div\s+class="con">(.|\n|\r)*?<div\s+id="footer"\s+class="footer">/g)
        for(var ci in cnStrs) {
            if(gates.type.match('bx')) {
                if (cnStrs[ci].match(/工作地点：/g)) {
                    var j_addr = labelFindParent(cnStrs[ci], '工作地点：<\/')
                    addr = j_addr.replace(/<.*?>|工作地点：|&nbsp;/g, '').replace(/.*?>/g, '')
                    break
                }
            }
            else{
                var test_addr = labelFindParent(cnStrs[ci], '工作地址(.*?)\/')
                if(test_addr)
                    addr = test_addr.replace(/<.*?>|工作地址|\s+/g, '').replace(/.*?>/g, '')
            }
        }
        arri_obj.address = addr
        if(!arri_obj.address) {
            if(gates.addrs[0] != 'null')
                arri_obj.address = gates.addrs[0]
            else
                return cb(null)
        }
        analyseAddrCity(arri_obj, gates)
        reanynisAddr(arri_obj.address).then(function (a_res) {
            console.log(a_res)
            arri_obj.location.longitude = a_res.lng
            arri_obj.location.latitude = a_res.lat
            var p_labels = labelFindParent(info, '首次发布于')
            if(gates.type.match('58')) {
                p_labels = labelFindParent(info, '更新(.*?)\/')
                console.log(p_labels)
                if(p_labels && p_labels.match(/今天/g))
                    p_labels = time_gen.formatMinuteTime(new Date())
                else if(p_labels && p_labels.match(/天前/g)) {
                    var c_date = new Date(), w_day = p_labels.match(/[0-9]+/g)[0]
                    var old_time = c_date.getTime() - w_day*86400000
                    p_labels = time_gen.formatMinuteTime(new Date(old_time))
                }
            }
            arri_obj.time = p_labels.replace(/<.*?>|首次发布于：|&nbsp;/g, '').replace(/.*?>/g, '')
            var cnItStrs = info.match(/<div(\s+)class='viewad-meta-item'>(.|\n|\r)*?<\/div>/g)
            if(gates.type.match('58'))
                cnItStrs = info.match(/<span(\s+)class="pos_title">(.|\n|\r)*?<div(\s+)class="pos-area">/g)
            console.log(cnItStrs)
            for(var ci in cnItStrs) {
                if(gates.type.match('bx')) {
                    if (cnItStrs[ci].match(/职位类别：/g)) {
                        var j_type = labelFindParent(cnItStrs[ci], '职位类别：<\/')
                        arri_obj.content.add_value[2].contents = j_type.replace(/<.*?>|类别|&nbsp;/g, '').replace(/.*?>/g, '')
                    }
                    if (cnItStrs[ci].match(/招聘人数：/g)) {
                        var j_pers = labelFindParent(cnItStrs[ci], '招聘人数：<\/')
                        arri_obj.content.add_value[2].contents += '\n' + j_pers.replace(/<.*?>|&nbsp;/g, '').replace(/.*?>/g, '')
                    }
                    if (cnItStrs[ci].match(/学历要求：/g)) {
                        var j_schs = labelFindParent(cnItStrs[ci], '学历要求：<\/')
                        arri_obj.content.add_value[2].contents += '\n' + j_schs.replace(/<.*?>|要求|&nbsp;/g, '').replace(/.*?>/g, '')
                    }
                    if (cnItStrs[ci].match(/年龄：/g)) {
                        var j_olds = labelFindParent(cnItStrs[ci], '年龄：<\/')
                        arri_obj.content.add_value[2].contents += '\n' + j_olds.replace(/<.*?>|&nbsp;/g, '').replace(/.*?>/g, '')
                    }
                }
                else{
                    var j_type = labelFindParent(cnItStrs[ci], '<span(\\s+)class=\"pos_title\">')
                    arri_obj.content.add_value[2].contents = j_type.replace(/<.*?>/g, '')
                    var j_pers = findSpecialHtml(cnItStrs[ci], '<div\\s+class=\"pos_base_condition\">(.|\n|\r)*?<\/div>')
                    if(j_pers)
                        arri_obj.content.add_value[2].contents += '\n' + j_pers.replace(/<.*?>/g, ' ').replace(/\s+/g, ' ')
                    var j_details = findSpecialHtml(info, '<div\\s+class=\"item_con\\s+pos_description\">(.|\n|\r)*?<div\\s+class=\"Job\\s+requirements\">')
                    if(j_details)
                        arri_obj.content.add_value[2].contents += '\n' + j_details.replace(/<br(.*?)>/g, '\n').replace(/\n+/g, '\n').replace(/<(.*?)>|职位描述/g, '')
                }
            }
            revar = new RegExp("<strong>[0-9|-]*<\/strong>", "g")
            if(gates.type.match('58'))
                revar = new RegExp("<strong>[0-9|-]*<\/strong>", "g")//? for customer reason
            var c_phone = info.match(revar)
            if(c_phone)
                arri_obj.content.add_value[3].contents = '联系电话：'+c_phone[0].replace(/<.*?>/g, "").replace(/>/g, '')
            else
                arri_obj.content.add_value[3].contents = '对不起，对方未留下联系方式'
            var cndprStrs = info.match(/<div class='viewad-common-header'>(.|\n|\r|职位描述)*<div class='viewad-text-hide'>/g)
            if(gates.type.match('58'))
                cndprStrs = findSpecialHtml(info, '<div\\s+class=\"item_con comp_intro\">(.|\n|\r)*?<\/p>')
            if(cndprStrs) {
                if(gates.type.match('bx'))
                    arri_obj.content.add_value[1].contents = cndprStrs[0].replace(/<br \/>/g, '\n').replace(/<.*?>|职位描述|&zwnj;|[^\u4e00-\u9fa5|\u3002|\uff1f|\uff01|\uff0c|\u3001|\uff1b|\uff1a|\u201c|\u201d|\u2018|\u2019|\uff08|\uff09|\u300a|\u300b|\u3008|\u3009|\u3010|\u3011|\u300e|\u300f|\u300c|\u300d|\ufe43|\ufe44|\u3014|\u3015|\u2026|\u2014|\uff5e|\ufe4f|\uffe5|0-9|-]*/g, '')
                else
                    arri_obj.content.add_value[1].contents = cndprStrs.replace(/<(.*?)>/g, '')
            }
            console.log(JSON.stringify(arri_obj))
            cb(arri_obj)
        }).then(function(err){
            console.log(err)
            if (err)
                return cb(null)
        })
    }
    , analyseWebForServe = function(gates, info, cb){
        info = cleanCommHtml(info, gates)
        var arri_obj = {time:(gates.time ? gates.time : ''), location:{longitude:'', latitude:''}, pictures:0, content:{add_key:'tapServes', add_value:[
            {id:'gate0', name:(gates.cn ? gates.cn : '')}, {id:'gate1', name:''}, {id:'gate2', contents:''}, {id:'gate4', contents:''}
        ]}, address:''}, addr = '', area = ''
        var cnStrs = info.match(/<div class='viewad-meta2-item.*?>(.|\n|\r)*?<\/div>/g)
        if(gates.type.match('58')) {
            cnStrs = info.match(/<span(\s+)class="adr">(.*?)<\/span>/g)
            var area_test = info.match(/(<div\s+class="newinfo\s+serviceInfo\s+">|<div\s+class="cona\s+quyuline">)(.|\n|\r)*?<\/li>/g)
            if(area_test)
                area = area_test[0].replace(/<\/a>/g, ' ').replace(/<.*?>|\t|服务区域|\r|\n/g, '').replace(/\s+/g, ' ')
        }
        for(var ci in cnStrs) {
            if(gates.type.match('bx')) {
                if (cnStrs[ci].match(/所在地/g))
                    addr = cnStrs[ci].replace(/<.*?target='_blank'.*?>/g, ' ').replace(/<.*?>/g, '')
                if (cnStrs[ci].match(/服务范围/g))
                    area = cnStrs[ci].replace(/<.*?target='_blank'.*?>/g, ' ').replace(/<.*?>|&nbsp;/g, '')
            }
            else
                addr = cnStrs[ci].replace(/&nbsp;|-/g, '').replace(/<.*?>/g, '')
        }
        arri_obj.address = addr ? addr : area
        if(arri_obj.address == '')//here for delete unuse link
            return cb(null)
        analyseAddrCity(arri_obj, gates)
        reanynisAddr(arri_obj.address).then(function (a_res) {
            arri_obj.location.longitude = a_res.lng
            arri_obj.location.latitude = a_res.lat
            var p_labels = labelFindParent(info, '首次发布于')
            if(gates.type.match('58'))
                p_labels = labelFindParent(info, 'title="发布日期"')
            arri_obj.time = p_labels.replace(/<.*?>|首次发布于：|&nbsp;|发布日期/g, '').replace(/.*?>/g, '')
            arri_obj.content.add_value[1].name = area.match(/服务范围/g) ? area : '服务范围：'+area
            revar = new RegExp("<div\\s+class='viewad-text'>(.|\r|\n)*?\/div>", "g")
            if(gates.type.match('58'))
                revar = new RegExp("<div\\s+class=\"descriptionBox\">(.|\r|\n)*?<\/div>", "g")
            var view_add = info.match(revar)
            if(view_add) {
                if(gates.type.match('bx'))
                    arri_obj.content.add_value[2].contents = view_add[0].replace(/&zwnj;|&nbsp;|&ldquo;/g, '').replace(/\n/g, '').split("<div class='viewad-text-hide'>")[0].replace(/<br \/>+/g, '\n').replace(/<[^\u4e00-\u9fa5]*>/g, '')
                else {
                    var t_absort = view_add[0].match(/(<br\s+\/>|<p>)(.*?)(<br\s+\/>|<\/p>)/g)
                    for(var ti in t_absort) {
                        if(ti == 0 || t_absort[ti].match('58同城'))
                            continue
                        arri_obj.content.add_value[2].contents += t_absort[ti].replace(/<.*?>/g, '')+'\n'
                    }
                }
            }
            revar = new RegExp("<strong>[0-9|-]*<\/strong>", "g")
            var p_num = info.match(revar)
            if(gates.type.match('58'))
                p_num = info.match(/sphone:(.*?)(1(3|4|5|7|8)\d{9}|0\d{2,3}-?\d{7,8})/g)
            if(p_num)
                arri_obj.content.add_value[3].contents = '联系电话：' + p_num[0].replace(/sphone:|'/g, "")
            var imgs_arr = []
            revar = new RegExp("<div\\s+class='photo-item(.*?)<\/div>", "g")
            if(gates.type.match('58'))
                revar = new RegExp("<div\\s+id=\"img_player1\">(.|\n|\r)*?<\/div>", "g")
            var images = info.match(revar)
            if(gates.type.match('bx'))
                for (var imi in images) {
                    var image = images[imi].match(/http:[^\s]+(\)|"|')/g)
                    if(image)
                        imgs_arr.push(image[0].replace(/\)|"|'/g, ''))
                    if (imgs_arr.length == 3)
                        break
                }
            else{
                var src_images = images[0].match(/http:[^\s]+(\)|"|')/g)
                for (var imi in src_images) {
                    imgs_arr.push(src_images[imi].replace(/\)|"|'/g, ''))
                    if (imgs_arr.length == 3)
                        break
                }
            }
            arri_obj.pictures = imgs_arr.length
            console.log(JSON.stringify(arri_obj))
            if(gates.dig)
                arri_obj.imgs = imgs_arr
            saveImgLinks(gates, imgs_arr, function(){
                cb(arri_obj)
            })
        }).then(function (err) {
            if (err)
                cb(null)
        })
    }
    , analyseWebForRend = function(gates, info, cb){
        info = cleanCommHtml(info, gates)
        var arri_obj = {time:(gates.time ? gates.time : ''), location:{longitude:'', latitude:''}, pictures:0, content:{add_key:'tapRend', add_value:[
            {id:'gate0', name:''}, {id:'gate1', name:''}, {id:'gate2', contents:''}, {id:'gate3', contents:''}, {id:'gate5', contents:''}
        ]}, address:''}
        var p_labels = findSpecialHtml(info, '(地址：|具体地点：)(.*?)\/(.|\n|\r)*?(\/li|\/label)>')
        if(gates.type.match('58')) {
            p_labels = findSpecialHtml(info, '(详细地址：|具体地点：)(.*?)\/(.|\n|\r)*?(\/label|\/span)>')
            if(p_labels)
                arri_obj.address = p_labels.replace(/<(.|\s+)*?>|\r|\n|详细地址：|&nbsp;|具体地点：/g, '').replace(/\s+/g, '')
        }
        else
            arri_obj.address = p_labels.replace(/<.*?>|地址：|具体地点：|&nbsp;/g, '').replace(/.*?>/g, '')
        if(arri_obj.address == '')
            return cb(null)
        analyseAddrCity(arri_obj, gates)
        reanynisAddr(arri_obj.address).then(function (a_res) {
            arri_obj.location.longitude = a_res.lng
            arri_obj.location.latitude = a_res.lat
            if(!arri_obj.time){
                if(gates.type.match('58')){
                    p_labels = labelFindParent(info, 'class="house-update-info')
                    if(p_labels)
                        arri_obj.time = p_labels.replace(/<(.*?)>|&nbsp;/g, '').replace(/(.*?)>/g, '').replace(/更新(.*?)/g, '')
                    else
                        arri_obj.time = timegen.formatYmdTime(new Date())
                }
                else{
                    p_labels = labelFindParent(info, '首次发布于：')
                    if(p_labels)
                        arri_obj.time = p_labels.replace(/<(.*?)>|&nbsp;/g, '').replace(/(.*?)>/g, '')
                    else
                        arri_obj.time = timegen.formatYmdTime(new Date())
                }
            }
            var p_labels = findSpecialHtml(info, '房型：(.*?)\/(.|\n\r)*?(\/li|\/label)>')
            if(gates.type.match('58'))
                p_labels = findSpecialHtml(info, '房屋类型：(.*?)\/(.*?)\/span>')
            if(gates.type.match('bx')) {
                console.log(p_labels)
                if (gates.noseq.match(/[0-9]+/g)[0] > 2) {
                    p_labels = findSpecialHtml(info, '面积：(.*?)\/(.|\n\r)*?\/li>')
                    arri_obj.content.add_value[0].name = p_labels.replace(/<.*?>|&nbsp;/g, '').replace(/.*?>/g, '')
                }
                else
                    arri_obj.content.add_value[0].name = p_labels.replace(/<.*?>|房型：|&nbsp;/g, '').replace(/.*?>/g, '')
            }
            else
                arri_obj.content.add_value[0].name = p_labels.replace(/\s+/g, '').replace(/&nbsp;/g, ' ').replace(/<.*?>|房屋类型：/g, '').replace(/\s+/g, ' ')
            p_labels = labelFindParent(info, 'meta-价格')
            if(gates.type.match('58'))
                p_labels = findSpecialHtml(info, '<div\\s+class=\"house-pay-way(.|\r|\n)*?</span>')
            arri_obj.content.add_value[1].name = p_labels.replace(/<(.|\s+|\r|\n)*?>|&nbsp;/g, '').replace(/.*?>/g, '')
            if(gates.type.match('bx')) {
                if (gates.noseq == 0) {
                    p_labels = findSpecialHtml(info, '房屋配置：(.*?)\/(.|\n\r)*?\/label>')
                    arri_obj.content.add_value[2].contents = p_labels.replace(/<.*?>|&nbsp;/g, '').replace(/.*?>/g, '')
                }
                p_labels = findSpecialHtml(info, 'viewad-text(.|\n|\r)*?viewad-text-hide')
                arri_obj.content.add_value[3].contents = p_labels.replace(/<.*?>|&nbsp;|&zwnj;/g, '').replace(/.*?>|<.*/g, '')
            }
            else{
                p_labels = findSpecialHtml(info, '<ul\\s+class=\"house-disposal\">(.|\r|\n)*?<\/ul>').match(/<li(.|\r|\n)*?<\/li>/g)
                for(var pli in p_labels)
                    arri_obj.content.add_value[2].contents += p_labels[pli].replace(/<\/li>/g, '\n').replace(/<(.*?)>/g, '')
                p_labels = findSpecialHtml(info, '<div\\s+class=\"house-word-introduce(.|\r|\n)*?<\/div>').match(/(<b>|<p>)(.|\r|\n)*?(<\/b>|<\/p>)/g)
                for(var pli in p_labels)
                    arri_obj.content.add_value[3].contents += p_labels[pli].replace(/<.*?>|\r|\n|\s+/g, '').replace(/(<\/b>|<\/p>)/g, '\n')
            }
            revar = new RegExp("<strong>[0-9|-]*<\/strong>", "g")
            var p_num = info.match(revar)
            if(gates.type.match('58'))
                p_num = info.match(/<em\s+class="phone-num">(.*?)<\/em>/g)
            if(p_num)
                arri_obj.content.add_value[4].contents = '联系电话：' + p_num[0].replace(/<(.*?)>/g, "")
            revar = new RegExp("<div\\s+class='photo-item(.*?)<\/div>", "g")
            if(gates.type.match('58'))
                revar = new RegExp("<ul\\s+class=\"house-pic-list(.|\r|\n)*?<\/ul>", "g")
            var images = info.match(revar), imgs_arr = []
            if(gates.type.match('bx'))
                for (var imi in images) {
                    var image = images[imi].match(/http:([^\s]+)/g)
                    if(image)
                        imgs_arr.push(image[0].replace(/(\)|')/g, ''))
                    if (imgs_arr.length == 3)
                        break
                }
            else{
                var src_images = images[0].match(/http:([^\s]+)(\)|"|')/g)
                for (var imi in src_images) {
                    imgs_arr.push(src_images[imi].replace(/(\)|"|')/g, ''))
                    if (imgs_arr.length == 3)
                        break
                }
            }
            arri_obj.pictures = imgs_arr.length
            console.log(JSON.stringify(arri_obj), 'dig web rend')
            if(gates.dig)
                arri_obj.imgs = imgs_arr
            saveImgLinks(gates, imgs_arr, function(){
                cb(arri_obj)
            })
        }).then(function (err) {
            if (err)
                cb(null)
        })
    }
    , analyseWebForOld = function(gates, info, cb){
        info = cleanCommHtml(info, gates)
        var arri_obj = {time:(gates.time ? gates.time : ''), location:{longitude:'', latitude:''}, pictures:0, content:{add_key:'tapOlds', add_value:[
            {id:'gate0', name:(gates.name ? gates.name : '')}, {id:'gate1', name:''}, {id:'gate2', contents:''}, {id:'gate4', contents:''}
        ]}, address:''}
        var p_labels = findSpecialHtml(info, '地址：(.*?)\/(.|\n|\r)*?\/li>')
        if(gates.type.match('58'))
            p_labels = findSpecialHtml(info, '区域：(.|[\n]+|[\r]+)*?\/a>')
        arri_obj.address = p_labels.replace(/.*<span/g, '').replace(/<.*?>|&nbsp;|\n|\r|\s+/g, '').replace(/.*?>/g, '')
        if(arri_obj.address == '')
            return cb(null)
        analyseAddrCity(arri_obj, gates)
        reanynisAddr(arri_obj.address).then(function (a_res) {
            arri_obj.location.longitude = a_res.lng
            arri_obj.location.latitude = a_res.lat
            if(!arri_obj.time){
                if(gates.type.match('58')){
                    p_labels = findSpecialHtml(info, '<li\\s+class=\"time\">(.|\n|\r)*?\/li>')
                    if(p_labels)
                        arri_obj.time = p_labels.replace(/<(.*?)>/g, '')
                    else
                        arri_obj.time = timegen.formatYmdTime(new Date())
                }
                else{
                    p_labels = labelFindParent(info, '首次发布于：')
                    if(p_labels)
                        arri_obj.time = p_labels.replace(/<(.*?)>|&nbsp;/g, '').replace(/(.*?)>/g, '')
                    else
                        arri_obj.time = timegen.formatYmdTime(new Date())
                }
            }
            p_labels = labelFindParent(info, '价格：.*?\/')
            if(gates.type.match('58'))
                p_labels = findSpecialHtml(info, '价格：(.|\r|\n)*?<a(.*?)>')
            arri_obj.content.add_value[1].name = p_labels.replace(/<.*?>|&nbsp;|\r|\n|\t|\s+|价格：/g, '')
            p_labels = findSpecialHtml(info, 'viewad-text(.|\n|\r)*?viewad-text-hide')
            if(gates.type.match('58'))
                p_labels = findSpecialHtml(info, '<article\\s+class=\"description_con\">(.|\n|\r)*?<\/article>')
            arri_obj.content.add_value[2].contents = p_labels.replace(/<.*?>|&nbsp;|&zwnj;|\r|\n/g, '').replace(/.*?>|<.*/g, '').replace(/\s+/g, ' ')
            revar = new RegExp("<strong>[0-9|-]+<\/strong>", "g")
            if(gates.type.match('58'))
                revar = new RegExp("<span\\s+id=\"t_phone\"(.|\r|\n)*?<\/span>", "g")
            var p_num = info.match(revar)
            if(p_num)
                arri_obj.content.add_value[3].contents = '联系电话：' + p_num[0].replace(/<(.*?)>|\r|\n|\t/g, "")
            revar = new RegExp("<div\\s+class='big-img-box'>(.|\r|\n)*?<ul", "g")
            if(gates.type.match('58'))
                revar = new RegExp("<div\\s+class=\"descriptionImg\">(.|\r|\n)*?<\/div>", "g")
            var images = info.match(revar), imgs_arr = []
            if(gates.type.match('bx')) {
                if(!images) {
                    revar = new RegExp("服务简介.*img(.*?)<\/div>", "g")
                    var t_images = info.match(revar)
                    if(t_images)
                        images = t_images[0].match(/img src='http:[^\s]*img[^\s]*'/g)
                }
                else
                    images = images[0].match(/http:[^\s]*img[^\s]*'/g)
            }
            else
                images = images[0].match(/http:[^\s]+[\s]/g)
            for (var imi in images) {
                imgs_arr.push(images[imi].replace(/'|img src=/g, ''))
                if (imgs_arr.length == 3)
                    break
            }
            arri_obj.pictures = imgs_arr.length
            if(gates.dig)
                arri_obj.imgs = imgs_arr
            saveImgLinks(gates, imgs_arr, function(){
                cb(arri_obj)
            })
        }).then(function (err) {
            if (err)
                cb(null)
        })
    }
    , fetchWebSite = function(page_link){
        return new Promise(function (resolve, reject) {
            fetch(page_link).then(function (res) {
                return res.buffer()
            }).then(function (buffer) {
                resolve(buffer.toString('utf8'))
            }).catch(function (err) {
                if(err)
                    reject(err)
                console.log(err)
            })
        })
    }
    , analyseWebInfo = function(atrrs, info, cb){
        console.log(atrrs, 'dig web')
        var arr_res = []
        if(atrrs.type.match('tapGates'))
            analyseWebForGate(atrrs, info, function(res){
                if(!res) return cb(null)
                if(atrrs.dig)
                    cb(res)
                else {
                    res.link = atrrs.link
                    var size = file.statSync(`${master_dir}tapGatesObjs/gatesobjs.txt`).size
                    if (size)
                        arr_res = JSON.parse(file.readFileSync(`${master_dir}tapGatesObjs/gatesobjs.txt`))
                    arr_res.push(res)
                    file.writeFile(`${master_dir}tapGatesObjs/gatesobjs.txt`, JSON.stringify(arr_res), function () {
                        cb(res)
                    })
                }
            })
        else if(atrrs.type.match('tapJobs'))
            analyseWebForJob(atrrs, info, function(res){
                if(!res) return cb(null)
                if(atrrs.dig)
                    cb(res)
                else {
                    res.link = atrrs.link
                    var size = file.statSync(`${master_dir}tapJobsObjs/jobsobjs.txt`).size
                    if (size)
                        arr_res = JSON.parse(file.readFileSync(`${master_dir}tapJobsObjs/jobsobjs.txt`))
                    arr_res.push(res)
                    file.writeFile(`${master_dir}tapJobsObjs/jobsobjs.txt`, JSON.stringify(arr_res), function () {
                        cb(res)
                    })
                }
            })
        else if(atrrs.type.match('tapServes'))
            analyseWebForServe(atrrs, info, function(res){
                if(!res) return cb(null)
                if(atrrs.dig)
                    cb(res)
                else {
                    res.link = atrrs.link
                    var size = file.statSync(`${master_dir}tapServesObjs/servesobjs.txt`).size
                    if(size)
                        arr_res = JSON.parse(file.readFileSync(`${master_dir}tapServesObjs/servesobjs.txt`))
                    arr_res.push(res)
                    file.writeFile(`${master_dir}tapServesObjs/servesobjs.txt`, JSON.stringify(arr_res), function () {
                        cb(res)
                    })
                }
            })
        else if(atrrs.type.match('tapRend'))
            analyseWebForRend(atrrs, info, function(res){
                if(!res) return cb(null)
                if(atrrs.dig)
                    cb(res)
                else {
                    res.link = atrrs.link
                    var size = file.statSync(`${master_dir}tapRendObjs/rendsobjs.txt`).size
                    if(size)
                        arr_res = JSON.parse(file.readFileSync(`${master_dir}tapRendObjs/rendsobjs.txt`))
                    arr_res.push(res)
                    file.writeFile(`${master_dir}tapRendObjs/rendsobjs.txt`, JSON.stringify(arr_res), function () {
                        cb(res)
                    })
                }
            })
        else
            analyseWebForOld(atrrs, info, function(res){
                if(!res) return cb(null)
                if(atrrs.dig)
                    cb(res)
                else {
                    res.link = atrrs.link
                    var size = file.statSync(`${master_dir}tapOldsObjs/oldsobjs.txt`).size
                    if(size)
                        arr_res = JSON.parse(file.readFileSync(`${master_dir}tapOldsObjs/oldsobjs.txt`))
                    arr_res.push(res)
                    file.writeFile(`${master_dir}tapOldsObjs/oldsobjs.txt`, JSON.stringify(arr_res), function () {
                        cb(res)
                    })
                }
            })
    }
    , randomFetch = function(pages, cb){
        if(!pages.links.length)
            return cb()
        var set_inter = interval_time()
        console.log(set_inter, pages.links[0])
        setTimeout(function(){
            fetchWebSite(pages.links[0]).then(function (f_res) {
                var arri_obj = {}
                if(pages.wnames.length)
                    arri_obj.name = pages.wnames[0]
                if(pages.wtimes.length)
                    arri_obj.time = pages.wtimes[0]
                arri_obj.type = pages.type
                if(pages.hasOwnProperty('cn'))
                    arri_obj.cn = pages.cn
                arri_obj.cn_city = pages.cn_city
                arri_obj.en_city = pages.en_city
                if(pages.waddrs && pages.waddrs.length)
                    arri_obj.addrs = pages.waddrs
                arri_obj.link = pages.links[0]
                analyseWebInfo(arri_obj, f_res, function(a_res){
                    if(!a_res)
                        unvalitedLinks.push(pages.links[0])
                    pages.links.splice(0, 1)
                    pages.wnames.splice(0, 1)
                    pages.wtimes.splice(0, 1)
                    if(pages.waddrs)
                        pages.waddrs.splice(0, 1)
                    randomFetch(pages, cb)
                })
            })
        },set_inter)
    }
    , readDirFiles = function(destination){
        if(!fetch_switch || !fetch_start)
            return
        file.readdir(destination, function(err,dirs){
            if(err){
                console.log(err)
                return
            }
            var rd_files = function(rdfs, rdcitys){
                if(!rdfs.length) {
                    rdcitys.splice(0, 1)
                    return rd_dirs(rdcitys)
                }
                if(rdfs[0].match(/links/g)) {
                    var pr_name = rdfs[0].split('links')[0] + '/'
                    var re_obj = reanynisType(pr_name, destination)
                    var f_path = `${destination}${rdcitys[0]}/${rdfs[0]}`
                    file.readFile(f_path, function (err, res) {
                        var f_obj = JSON.parse(res)
                        for (var rei in re_obj)
                            f_obj[`${rei}`] = re_obj[rei]
                        f_obj.cn_city = reanynisCity(rdcitys[0], destination)
                        f_obj.en_city = rdcitys[0]
                        var caches = {}
                        caches.links = f_obj.links.slice(0), caches.wnames = f_obj.wnames.slice(0), caches.wtimes = f_obj.wtimes.slice(0)
                        if(f_obj.waddrs)
                            caches.waddrs = f_obj.waddrs.slice(0)
                        randomFetch(f_obj, function () {
                            if (unvalitedLinks.length) {
                                for (var vi in unvalitedLinks) {
                                    for (var oi in caches.links) {
                                        if (unvalitedLinks[vi] == caches.links[oi]) {
                                            caches.links.splice(oi, 1)
                                            caches.wnames.splice(oi, 1)
                                            caches.wtimes.splice(oi, 1)
                                            if(caches.waddrs)
                                                caches.waddrs.splice(oi, 1)
                                            break
                                        }
                                    }
                                }
                                file.writeFile(f_path, JSON.stringify(caches), function () {})
                            }
                            rdfs.splice(0, 1)
                            rd_files(rdfs, rdcitys)
                        })
                    })
                }
                else{
                    rdfs.splice(0, 1)
                    rd_files(rdfs, rdcitys)
                }
            }
            var rd_dirs = function(rddirs){
                //console.log(rddirs)
                if(rddirs.length) {
                    file.readdir(`${destination}${rddirs[0]}`, function (err, c_files) {
                        //console.log(err, c_files, rddirs)
                        if (err)
                            return
                        rd_files(c_files, rddirs)
                    })
                }
                else {
                    fetch_start = false
                    fetch_switch = false
                    clearInterval(interval)
                    return
                }
            }
            rd_dirs(dirs)
        })
    }
    , unvalitedLinks = []
    , fetch_start = false
    , fetch_switch = false
    , interval
    , master_dir = '../../../master/'
    , bxDir = `${master_dir}downloads/bx/`
    , tc58Dir = `${master_dir}downloads/tc/`
    , bxlinkedtxts = `${master_dir}downloads/genedlinkstxts/bx/`
    , tclinkedtxts = `${master_dir}downloads/genedlinkstxts/tc/`
    , imgspos = `${master_dir}downloads/imgs/imgedlinks/`
var fetchInterval = function(){
    return 1200000//18000000
}
var aDayInterval = function(){
    return 1800000//86400000
}
var startInterval = function(starter){
    var order_time = starter.getTime()
    var curDayEnd = new Date()
    curDayEnd.setHours(starter.getHours(), starter.getMinutes()+30, starter.getSeconds(), 999)//curDayEnd.setHours(23, 59, 59, 999)
    var end_time = curDayEnd.getTime()
    return end_time-order_time
}
var loopInterval = function(){
    var curLoopEnd = fetchInterval()
    setTimeout(function(){
        fetch_switch = false
    }, curLoopEnd)
}
var startLoopFetch = function(){
    console.log('start loop pages')
    fetch_start = true
    fetch_switch = true
    //loopInterval()
    readDirFiles(tc58Dir)
}
module.exports = {
    getObjType: reanynisType,
    digWebInfo: analyseWebInfo,
    webPagesFetch: function(){
        fetch_start = true
        //var set_interval = startInterval(new Date())
        //setTimeout(function(){
            startLoopFetch()
            var aDayLoop = aDayInterval()
            interval = setInterval(function(){
                startLoopFetch()
            }, aDayLoop)
        //}, set_interval)
    },
    stopWebAction: function(){
        fetch_start = false
        fetch_switch = false
        clearInterval(interval)
    }
}
//startLoopFetch()