//app.js
"use strict"

const ws = require('ws')
const xml2js = require('xml2js')
const request = require('request')
const mysql = require('../../databases/mysqldata.js')
const redis = require('../../databases/rediscache.js')
const webfetch = require('./service/fetchweb.js')
const master = require('./service/master.js')
const joiners = require('./service/clients.js')
const txgeo = require('./service/txgeo.js')
const payprocess = require('./service/payunits.js')
const session_random = require('./service/shell.js')
const https_server = require('./httpssrv.js')
https_server.setMaxListeners(10000)
const wss_server = new ws.Server({server: https_server})
wss_server.setMaxListeners(10000)
require('events').EventEmitter.prototype.maxListeners = 10000
function sendEndDeal(mkey, conn, value){
    /*if(conn.readyState != 1){
        reqRestart(conn)
        return
    }
    try {
        conn.send(JSON.stringify({key: mkey, value: value}))
    }
    catch (e) {
        console.log(e)
    }
    conn.removeAllListeners('message')*/
}
function reqOpenid(conn, mData, cb){
    var double_leap = '//'
    var options = {
        url: `https:${double_leap}api.weixin.qq.com/sns/jscode2session?appid=wxf9a75ea1c3517fbe&secret=9aceb733968d171ed70207f87c5dcb9e&js_code=${mData.value}&grant_type=authorization_code`
    }
    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var info = JSON.parse(body)
            if (info.errcode) {
                sendEndDeal(mData.key, conn, 'openid undefined')
                return
            }
            cb(info)
        }
        else {
            joiners.appOptErr(mData.value, null, `${error}||${response.statusCode}`, 'app.reqOpenid', 'null', mData.value, 'null')
            sendEndDeal(mData.key, conn, '网站升级中...')
        }
    })
}
function reqSessionKey(mData, conn){
    if(mData.value.localkey) {
        sendEndDeal(mData.key, conn, 'login')
        redis.getUserCache('people:usr', mData.value.localkey).then(function (usr) {
            var active=JSON.parse(usr[0])
            active.active='on'
            redis.storeUserCache('people:usr', {[mData.value.localkey]:JSON.stringify(active)}).then(function (l_dir) {}).catch(function (err) {
                if (err)
                    sendEndDeal(mData.key, conn, 'failed getDir')//need promote
            })
        }).catch(function (err) {
            if (err)
                sendEndDeal(mData.key, conn, 'failed getDir')//need promote
        })
    }
    else
        reqOpenid(conn, mData, function (reop) {
            var sh_order = 'head -n 80 /dev/urandom | tr -dc A-Za-z0-9 | head -c 32'
            session_random.shellFunc(sh_order).then(function (result) {
                sendEndDeal(mData.key, conn, result)
                redis.getUserCache('people:usr', 'alls').then(function (all_arr) {
                    var usrs=[]
                    if(all_arr[0])
                        usrs=all_arr[0]
                    usrs.push({localkey:result, openid:reop.openid, active:'on'})
                    var values={alls:JSON.stringify(usrs), [result]:JSON.stringify({openid:reop.openid, active:'on'})}
                    redis.storeUserCache('people:usr', values).then(function (l_dir) {}).catch(function (err) {
                        console.log(err)
                        if (err)
                            sendEndDeal(mData.key, conn, 'failed getDir')//need promote
                    })
                }).catch(function (err) {
                    if (err)
                        sendEndDeal(mData.key, conn, 'failed getDir')
                })
            }).catch(function (err) {
                if (err) {
                    joiners.appOptErr(reop.openid, null, `${err}`, 'app.sessionKey.*.session_random.shellFunc', 'null', mData.value, 'null')
                    sendEndDeal(mData.key, conn, 'sessionKey failed')
                }
            })
        })
}
function reqGetMgrpHimg(mData, conn){
    joiners.reqGetHeadImage(mData.value.localKey, function(img_res){
        if(img_res == 'not in db'){
            if(!mData.value.avurl)
                return sendEndDeal(mData.key, conn, 'empty url')
            var sh_order = 'head -n 80 /dev/urandom | tr -dc A-Za-z0-9 | head -c 32'
            session_random.shellFunc(sh_order).then(function (result) {
                joiners.getUsrImg(mData.value.localKey, mData.value.avurl, result, function(res){
                    sendEndDeal(mData.key, conn, res)//consider for 'err wrong url'
                })
            }).catch(function (err) {
                if (err)
                    reqGetMgrpHimg(mData, conn)
            })
        }
        else
            sendEndDeal(mData.key, conn, img_res)
    })
}
function reqSubmitInfo(mData, conn){
    const values=mData.value
    redis.getUserCache('people:usr', values.localkey).then(function(res){
        var result=JSON.parse(res[0]), p_label = values.pages ? 'pages' : (values.questions ? 'questions' : 'files'), p_find=values[p_label]
        if(!values.update) {
            result[p_label] ? result[p_label].push(values[p_label]) : result[p_label] = [values[p_label]]
            redis.storeUserCache(`people:usr`, {[values.localkey]: JSON.stringify(result)}).then(function () {
                var strs=JSON.stringify(values[p_find])
                redis.storeUserCache(`people:${p_label}`, {[p_find]: strs}).then(function () {
                    sendEndDeal(mData.key, conn, 'submit received')
                }).catch(function (err) {
                    if (err)
                        sendEndDeal(mData.key, conn, 'submit failed')
                })
            }).catch(function (err) {
                if (err)
                    sendEndDeal(mData.key, conn, 'submit failed')
            })
        }
        else
            redis.storeUserCache(`people:${p_label}`, {[p_find]: JSON.stringify(values[p_find])}).then(function () {
                sendEndDeal(mData.key, conn, 'submit received')
            }).catch(function (err) {
                if (err)
                    sendEndDeal(mData.key, conn, 'submit failed')
            })
    }).catch(function(err){
        if(err)
            console.log(err)
    })
}
function reqGetSubmits(mData, conn){
    redis.getUserCache('people:usr', mData.value.localkey).then(function (cacheres) {
        if(cacheres[0].match(mData.value.type)){
            var chk_obj = JSON.parse(cacheres[0]), types=[]
            for(var prop in chk_obj){
                if(mData.value.type.match(prop)){
                    types=chk_obj[prop]
                    break
                }
            }
            sendEndDeal(mData.key, conn, types)
        }
        else
            sendEndDeal(mData.key, conn, 'empty')
    }).catch(function (err) {
        if (err) {
            //joiners.appOptErr(chk_keys.openid, mData.value.localKey, `${err}`, 'app.getSubmits.redis.getUserCache', 'people', mData.value, 'null')
            sendEndDeal(mData.key, conn, 'failed getSubmits')
        }
    })
}
function reqGetImagesProps(mData, conn){//rewrite
    var get_list = mData.value
    var getteds = []
    var recurse_gets = function(list){
        if(!list.length) {
            sendEndDeal(mData.key, conn, getteds)
            return
        }
        mysql.select_picsprops(list[0].time, list[0].key).then(function(res_rows){
            var g_obj = {key:list[0].key, time:list[0].time, value:res_rows}
            getteds.push(g_obj)
            list.splice(0, 1)
            recurse_gets(list)
        }).catch(function(res_err){
            if(res_err) {
                joiners.appOptErr(null, list[0].key, `${res_err}`, 'app.getImagesProps.mysql.select_picsprops', 'pictures', list[0].time, 'null')
                list.splice(0, 1)
                recurse_gets(list)
            }
        })
    }
    recurse_gets(get_list)
}
function reqPayment(mData, conn){
    redis.getUserCache(mData.value.localKey, conn, function(f_res){
        if(f_res){
            var openid = f_res.value.openid
            var pay_good = payprocess.helicalGoods(mData.value.type, mData.value.price)
            var local_order = payprocess.helicalOrder(mData.value.type, mData.value.stime)
            payprocess.options(openid, local_order, pay_good, mData.value.price, function(res_opt){
                if(res_opt){
                    request(res_opt.value, function(error, response, body){
                        if (!error && response.statusCode == 200) {
                            var xmlparser = new xml2js.Parser({explicitArray : false, ignoreAttrs : true})
                            xmlparser.parseString(body, function (err, result) {
                                var payid = result.xml.prepay_id
                                var currentsecs = Math.round(mData.value.stime/1000)
                                payprocess.genSecondsSign(payid, currentsecs, function(getsign){
                                    if(getsign) {
                                        sendEndDeal(mData.key, conn, {
                                            timeStamp: currentsecs,
                                            nonceStr: getsign.random,
                                            package: payid,
                                            paySign: getsign.sign
                                        })
                                    }
                                    else {
                                        joiners.appOptErr(openid, null, `${getsign}`, 'app.payRequest.*.payprocess.genSecondsSign', 'payment', mData.value, 'null')
                                        sendEndDeal(mData.key, conn, null)
                                    }
                                })
                            })
                        }
                        else {
                            joiners.appOptErr(openid, null, `${error}||${response.statusCode}`, 'app.payRequest.*.request', 'payment', mData.value, 'null')
                            sendEndDeal(mData.key, conn, null)
                        }
                    })
                }
                else {
                    joiners.appOptErr(openid, null, `${res_opt.value}`, 'app.payRequest.*.payprocess.options', 'payment', mData.value, 'null')
                    sendEndDeal(mData.key, conn, null)
                }
            })
        }
        else
            sendEndDeal(mData.key, conn, null)
    })
}
function reqSearchPeople(mData, conn){//rewrite
    var chk_local = {latitude: mData.value.latitude, longitude: mData.value.longitude}
    txgeo.findLocalAddr(chk_local, function (t_res) {
        if (t_res!='系统错误，请联系管理员！' && t_res!='error') {
            var detail_addr = t_res.split('市')[0] + '市'
            if(detail_addr.match(new RegExp('(省|自治|区|州)','g'))) {
                if(detail_addr.match('省'))
                    detail_addr = detail_addr.split('省')[1]
                if(detail_addr.match('自治区'))
                    detail_addr = detail_addr.split('自治区')[1]
                if(detail_addr.match('自治州'))
                    detail_addr = detail_addr.split('自治州')[1]
                if(detail_addr.match('地区'))
                    detail_addr = detail_addr.split('地区')[1]
            }
            redis.searchScope(mData.value.latitude, mData.value.longitude, mData.value.old_scope, mData.value.scope, {city: detail_addr, gate: mData.value.gate}).then(function (res) {
                if (res.length)
                    sendEndDeal(mData.key, conn, res)
                else {
                    var send_once = true
                    webfetch.digWebSrc(chk_local, mData.value.gate, mData.value.scope, function(w_res){
                        if(!w_res) {
                            if(send_once) {
                                sendEndDeal(mData.key, conn, 'no person now')
                                send_once = false
                            }
                        }
                        else{
                            var s_time = setTimeout(function(){
                                redis.searchScope(mData.value.latitude, mData.value.longitude, mData.value.old_scope, mData.value.scope, {city: detail_addr, gate: mData.value.gate}).then(function (s_res){
                                    clearTimeout(s_time)
                                    if(send_once) {
                                        if (s_res.length)
                                            sendEndDeal(mData.key, conn, s_res)
                                        else
                                            sendEndDeal(mData.key, conn, 'no person now')
                                        send_once = false
                                    }
                                }).catch(function(err){
                                    if(err && send_once) {
                                        sendEndDeal(mData.key, conn, 'searchPeople failed')
                                        send_once = false
                                    }
                                })
                            }, 200)
                        }
                    })
                }
            }).catch(function (err) {
                if (err) {
                    joiners.appOptErr(null, mData.value.localKey, `${err}`, 'app.searchPeople.*.redis.searchScope', 'people', mData.value, 'null')
                    sendEndDeal(mData.key, conn, 'searchPeople failed')
                }
            })
        }
        else {
            joiners.appOptErr(null, mData.value.localKey, `${t_res}`, 'app.searchPeople.txgeo', 'people', mData.value, 'null')
            sendEndDeal(mData.key, conn, 'searchPeople failed')
        }
    })
}
function reqDelSubmits(mData, conn){//rewrite
    if(mData.value.hasOwnProperty('master')){
        mysql.masterDelete(mData.value.time, JSON.stringify(mData.value.local), mData.value.addr).then(function(s_res){
            if(s_res.length) {
                redis.storeCache(s_res[0], s_res[1]).then(function (res) {
                    conn.send(JSON.stringify({key: 'delSubmits', value: 'delSubmits finished'}))
                }).catch(function (err) {
                    if (err) {
                        var js_key = JSON.parse(s_res[0])
                        joiners.appOptErr(js_key.openid, js_key.localKey, err, 'app.delSubmits.*.redis.storeCache', 'people', 'null', s_res[1])
                        sendEndDeal(mData.key, conn, 'delSubmits finished')
                    }
                })
            }
            else
                sendEndDeal(mData.key, conn, 'delSubmits finished')
        }).catch(function(err){
            if (err) {
                sendEndDeal(mData.key, conn, 'delSubmits finished')
                joiners.appOptErr(null, null, `${err}`, 'app.delSubmits.mysql.masterDelete', 'people', 'null', JSON.stringify(mData.value))
            }
        })
    }
    else {
        redis.getUserCache(mData.value.localKey, conn, function(f_res){
            if(f_res){
                if(f_res.db == 'redis') {
                    var key = JSON.stringify(f_res.value)
                    redis.getUserCache(key).then(function (val) {
                        if (val) {
                            var cache_objs = eval('(' + val + ')')
                            var old_caches = cache_objs.slice(0)
                            cache_objs.pop()
                            redis.storeCache(key, JSON.stringify(cache_objs)).then(function (res) {
                                sendEndDeal(mData.key, conn, 'delSubmits finished')
                            }).catch(function (err) {
                                if (err) {
                                    var js_key = JSON.parse(key)
                                    joiners.appOptErr(js_key.openid, null, err, 'app.delSubmits.redis.storeCache', 'people', JSON.stringify(old_caches), JSON.stringify(cache_objs))
                                    sendEndDeal(mData.key, conn, 'delSubmits finished')
                                }
                            })
                        }
                        else
                            sendEndDeal(mData.key, conn, 'delSubmits finished')
                    }).catch(function (err) {
                        if (err) {
                            var js_key = JSON.parse(key)
                            joiners.appOptErr(js_key.openid, null, `${err}`, 'app.delSubmits.redis.getUserCache', 'people', mData.value, 'null')
                            sendEndDeal(mData.key, conn, 'delSubmits finished')
                        }
                    })
                }
                else
                    sendEndDeal(mData.key, conn, 'delSubmits finished')
            }
            else
                sendEndDeal(mData.key, conn, 'delSubmits finished')
        })
    }
}
function reqDelUnpayeds(mData, conn){
    redis.getUserCache(mData.value.localKey, conn, function(f_res){
        if(f_res){
            if(f_res.db == 'redis') {
                var delsends = mData.value.unpayeds
                var tol_keys = f_res.value
                var key = JSON.stringify(tol_keys)
                redis.getUserCache(key).then(function (val) {
                    if (val.length) {
                        var cache_objs = eval('(' + val + ')')
                        for (var ti in delsends) {
                            for (var oi in cache_objs) {
                                if (oi == 0)
                                    continue
                                if (delsends[ti] == cache_objs[oi].time) {
                                    cache_objs.splice(oi, 1)
                                    break
                                }
                            }
                        }
                        redis.storeCache(key, JSON.stringify(cache_objs)).then(function (res) {
                            sendEndDeal(mData.key, conn, 'delUnpayeds finished')
                        }).catch(function (err) {
                            if (err) {
                                joiners.appOptErr(js_key.openid, null, err, 'app.delUnpayeds.redis.storeCache', 'people', JSON.stringify(cache_objs), JSON.stringify(d_time))
                                sendEndDeal(mData.key, conn, 'delUnpayeds finished')
                            }
                        })
                    }
                    else
                        sendEndDeal(mData.key, conn, 'delUnpayeds finished')
                    joiners.asynDelPics(delsends, tol_keys.openid)
                }).catch(function (err) {
                    if (err) {
                        joiners.appOptErr(tol_keys.openid, mData.value.localKey, `${err}`, 'app.delUnpayeds.redis.getUserCache', 'people', mData.value, 'null')
                        sendEndDeal(mData.key, conn, 'delUnpayeds finished')
                    }
                })
            }
            else
                sendEndDeal(mData.key, conn, 'delUnpayeds finished')
        }
        else
            sendEndDeal(mData.key, conn, 'delUnpayeds finished')
    })
}
function reqMsgsSubmit(mData, conn){
    redis.getUserCache(mData.value.localKey, conn, function(f_res){
        if(f_res){
            var openid = f_res.value.openid
            var msg_time = new Date().getTime()
            mysql.msgsSave(openid, mData.value.contents, msg_time, true).then(function (s_res) {
                sendEndDeal(mData.key, conn, s_res)
                joiners.msgAutoReply(openid, msg_time)
            }).catch(function (err) {
                if (err) {
                    sendEndDeal(mData.key, conn, 'failed')
                    joiners.appOptErr(openid, null, `${err}`, 'app.submitMsgs.mysql.msgsSave', 'messages', 'null', mData.value.contents)
                }
            })
        }
        else
            sendEndDeal(mData.key, conn, 'failed')
    })
}
function reqGetMsgs(mData, conn){
    redis.getUserCache(mData.value.localKey, conn, function(f_res){
        if(f_res){
            var openid = f_res.value.openid
            if(openid == master.id_master)
                master.getSuitableMsgs(mData.value.from).then(function(g_res){
                    sendEndDeal(mData.key, conn, g_res)
                }).catch(function (err) {
                    if (err) {
                        sendEndDeal(mData.key, conn, 'failed')
                        joiners.appOptErr(openid, null, `${err}`, 'app.getMsgs.master.getSuitableMsgs', 'messages', 'null', 'null')
                    }
                })
            else {
                mysql.msgsGetting(openid).then(function (s_res) {
                    if(s_res.length) {
                        var obj_arrs = eval('('+s_res.contents+')')
                        var obj_times = JSON.parse(s_res.time)
                        conn.send(JSON.stringify({key: 'getMsgs', value: obj_arrs, time: obj_times}))
                    }
                    else
                        conn.send(JSON.stringify({key: 'getMsgs', value: 'no msgs now'}))
                }).catch(function (err) {
                    if (err) {
                        sendEndDeal(mData.key, conn, 'failed')
                        joiners.appOptErr(openid, null, `${err}`, 'app.getMsgs.mysql.msgsGetting', 'messages', 'null', 'null')
                    }
                })
            }
        }
        else
            sendEndDeal(mData.key, conn, 'failed')
    })
}
function reqGroupSet(mData, conn){

}
function reqGroupUpdate(mData, conn){
    var m_key = ''
    if(mData.value.master == 'user')
        m_key = mData.value.user
    else
        m_key = mData.value.sendto
    redis.getUserCache(m_key, conn, function(m_res){
        if(m_res){
            var m_keys = m_res.value, cp_value = mData.value
            cp_value.mopenid = m_keys.openid
            if(mData.value.master == 'user')
                m_key = mData.value.sendto
            else
                m_key = mData.value.user
            if(mData.value.batch){
                mysql.grouperUpdate(cp_value).then(function () {
                    var m_online = joiners.chkOnlines(mData.value.members)
                    sendEndDeal(mData.key, conn, m_online)
                }).catch(function (err) {
                    if (err)
                        sendEndDeal(mData.key, conn, 'grp update failed')
                })
            }
            else {
                redis.getUserCache(m_key, conn, function (u_res) {
                    if (u_res) {
                        var u_keys = u_res.value
                        cp_value.uopenid = u_keys.openid
                        mysql.grouperUpdate(cp_value).then(function () {
                            var chk_onlines = []
                            if(mData.value.master.match('joiner')) {
                                chk_onlines = joiners.chkOnlines([m_key])
                                sendEndDeal(mData.key, conn, chk_onlines)
                            }
                            else if(mData.value.del && mData.value.del=='master and trans viewer to joiner'){
                                delete cp_value.del
                                cp_value.insert = 'joinning'
                                mysql.grouperUpdate(cp_value).then(function () {
                                    chk_onlines = joiners.chkOnlines([m_key])
                                    sendEndDeal(mData.key, conn, chk_onlines)
                                }).catch(function (err) {
                                    if (err) {
                                        sendEndDeal(mData.key, conn, 'grp update failed')
                                    }
                                })
                            }
                        }).catch(function (err) {
                            if (err) {
                                sendEndDeal(mData.key, conn, 'grp update failed')
                            }
                        })
                    }
                    else
                        sendEndDeal(mData.key, conn, 'grp update failed')
                })
            }
        }
        else
            sendEndDeal(mData.key, conn, 'grp update failed')
    })
}
function reqGroupData(mData, conn){
    var handups = joiners.communicationGet(mData.value.master)
    redis.getUserCache(mData.value.master, conn, function(f_res){
        if(f_res){
            var new_keys = f_res.value, grp_get = {openid:new_keys.openid, localKey:new_keys.localKey, time:mData.value.time}
            mysql.grouperGet(grp_get).then(function (g_res) {
                var g_joiners = []
                for(var ji=1; ji<g_res.length; ji++){
                    if(g_res[ji].joiner && !g_joiners.join().match(g_res[ji].joiner))
                        g_joiners.push(g_res[ji].joiner)
                }
                var m_online = joiners.chkOnlines(g_joiners)
                g_res.unshift({online:m_online})
                g_res.unshift({lookers:handups})
                console.log(JSON.stringify(g_res))
                sendEndDeal(mData.key, conn, g_res)
            }).catch(function (err) {
                if (err) {sendEndDeal(mData.key, conn, 'grp get failed')}
            })
        }
        else
            sendEndDeal(mData.key, conn, 'grp get failed')
    })
}
function reqChkGrp(mData, conn){
    var handups = joiners.communicationGet(mData.value.checker)
    redis.getUserCache(mData.value.master, conn, function(m_res){
        if(m_res){
            redis.getUserCache(mData.value.checker, conn, function(c_res){
                if(c_res){
                    var m_keys = m_res.value, c_keys = c_res.value, grp_chk = {master:m_keys.openid, openid:c_keys.openid, mlocalKey:m_keys.localKey, localKey:c_keys.localKey, time:mData.value.time}
                    if(mData.value.joiner)
                        grp_chk.joiner = mData.value.joiner
                    else
                        grp_chk.viewer = mData.value.viewer
                    mysql.reqChkGrp(grp_chk).then(function (g_res) {
                        if(g_res[0].joiner){
                            var m_online = joiners.chkOnlines([m_keys.localKey])
                            g_res.unshift({online:m_online})
                        }
                        else
                            g_res.unshift({online:[]})
                        g_res.unshift({lookers:handups})
                        console.log(JSON.stringify(g_res))
                        sendEndDeal(mData.key, conn, g_res)
                    }).catch(function (err) {
                        if (err) {sendEndDeal(mData.key, conn, 'grp chk failed')}
                    })
                }
                else
                    sendEndDeal(mData.key, conn, 'grp chk failed')
            })
        }
        else
            sendEndDeal(mData.key, conn, 'grp chk failed')
    })
}
function reqChkGroups(mData, conn){
    var handups = joiners.communicationGet(mData.value.checker)
    redis.getUserCache(mData.value.checker, conn, function(f_res){
        if(f_res){
            var new_keys = f_res.value, chk_results = []
            mysql.reqChkJoiners(new_keys).then(function(chk_res) {
                if(chk_res.length) {
                    var total_joineds = {joineds:chk_res}
                    chk_results.push(total_joineds)
                }
                mysql.reqChkViewers(new_keys).then(function(chk_vres) {
                    if(chk_vres.length) {
                        var total_joineds = {vieweds:chk_vres}
                        chk_results.push(total_joineds)
                    }
                    chk_results.unshift({lookers:handups})
                    console.log(JSON.stringify(chk_results))
                    sendEndDeal(mData.key, conn, chk_results)
                }).catch(function (err) {
                    if (err) {
                        joiners.appOptErr(mData.value, null, err, 'app.reqChkGroups.mysql.reqChkViewers', 'null', mData.value, 'null')
                        sendEndDeal(mData.key, conn, 'grp dchk failed')
                    }
                })
            }).catch(function (err) {
                if (err) {
                    joiners.appOptErr(mData.value, null, err, 'app.reqChkGroups.mysql.reqChkJoiners', 'null', mData.value, 'null')
                    sendEndDeal(mData.key, conn, 'grp dchk failed')
                }
            })
        }
        else
            sendEndDeal(mData.key, conn, 'grp dchk failed')
    })
}
function reqChkOnliner(mData, conn){
    var result = joiners.communicationHandup(mData.value.handto, mData.value.handfrom)
    if(result){
        if(!mData.value.joiner){
            if(!mData.value.img)
                joiners.reqGetHeadImage(mData.value.handto, function(res_img){
                    if(res_img != 'not in db')
                        sendEndDeal(mData.key, conn, res_img)
                    else
                        sendEndDeal(mData.key, conn, 'handup success')
                })
            else
                sendEndDeal(mData.key, conn, 'handup success')
        }
        else
            sendEndDeal(mData.key, conn, 'handup success')
    }
    else
        sendEndDeal(mData.key, conn, 'handto offline')
}
function reqOnlineTalk(mData, conn){
    var handfrom = mData.value.asker.localKey ? mData.value.asker.localKey : mData.value.asker.master
    var who = mData.value.answer.localKey ? mData.value.answer.localKey : mData.value.asker.master
    redis.getUserCache(mData.value.asker.master, conn, function(m_res){
        if(m_res){
            mData.value.asker.master = m_res.value.openid
            redis.getUserCache(mData.value.answer.localKey, conn, function(a_res){
                if(a_res){
                    mData.value.asker.openid = a_res.value.openid
                    mysql.comResponse(mData.value.asker, mData.value.answer).then(function(talk_res) {
                        console.log(JSON.stringify(talk_res))
                        if(talk_res.length)
                            sendEndDeal(mData.key, conn, {key:'talks get success', msgs:talk_res})
                        else{
                            var result = joiners.communicationHandup(who, handfrom)
                            if(result)
                                sendEndDeal(mData.key, conn, {key:'talks get success', msgs:[]})
                            else
                                sendEndDeal(mData.key, conn, {key:'offline'})
                        }
                    }).catch(function (err) {
                        if (err) {
                            joiners.appOptErr(mData.value.asker.master, null, err, 'app.reqOnlineTalk.mysql.comResponse', 'null', mData.value, 'null')
                            sendEndDeal(mData.key, conn, 'get talking failed')
                        }
                    })
                }
                else
                    sendEndDeal(mData.key, conn, 'get talking failed')
            })
        }
        else
            sendEndDeal(mData.key, conn, 'get talking failed')
    })
}
function reqMasterGets(mData, conn){
    mysql.masterGetting(mData.value).then(function (s_res) {
        if(s_res.length)
            sendEndDeal(mData.key, conn, s_res)
        else
            sendEndDeal(mData.key, conn, 'empty')
    }).catch(function (err) {
        if (err) {sendEndDeal(mData.key, conn, err)}
    })
}
function reqMasterDels(mData, conn){
    var info = mData.value
    mysql.deleteTblRow(info.table, info.id).then(function (s_res) {
        if(info.table == 'pictures'){
            if (!info.img.match('/'))
                info.img = '/data/release/helical/uploads/' + info.img
            var sh_order = `rm -rf ${info.img}`
            session_random.shellFunc(sh_order).then(function (result) {
                sendEndDeal(mData.key, conn, s_res)
            }).catch(function (err) {
                if (err) {
                    that.appOptErr('master', null, err, `reqMasterDels(${info.img})`, `${info.img}`, `${info.img}`, 'null')
                    sendEndDeal(mData.key, conn, 'del fail')
                }
            })
        }
        else
            sendEndDeal(mData.key, conn, s_res)
    }).catch(function (err) {
        if (err) {sendEndDeal(mData.key, conn, err)}
    })
}
function reqMasterOrders(mData, conn){
    mysql.loggerFound({key:'openid', value:mData.value.localKey}).then(function(openid_sql){
        if(openid_sql == master.id_master) {
            if (mData.value.order == 0)
                master.startWebIndexesFetch(mData.value.duration)
            else if (mData.value.order == 1)
                master.startGenWebLinks()
            else if (mData.value.order == 2)
                master.startGenWebObjs()
            else if (mData.value.order == 3)
                master.startGenWebImgs()
            else if (mData.value.order == 4)
                master.startInsertDb()
            else
                master.stopWebFetch()
            sendEndDeal(mData.key, conn, 'finished order')
        }
        else
            sendEndDeal(mData.key, conn, 'please not')
    }).catch(function(err){
        if (err)
            sendEndDeal(mData.key, conn, 'please not')
    })
}
function reqRestart(conn){
    conn.removeAllListeners('message')
    conn.removeAllListeners('close')
    conn.removeAllListeners('error')
    conn.terminate()
    joiners.appOptErr(null, null, 'restart', 'app.conn.on(restart)', 'null', 'null', 'pm2 restart wscsrv')
}
function closeAction(conn){
    conn.removeAllListeners('close')
}
function testcloseAction(){
    var sh_order = 'head -n 80 /dev/urandom | tr -dc A-Za-z0-9 | head -c 16'
    session_random.shellFunc(sh_order).then(function (result) {
        console.log(result)
    }).catch(function (err) {
        if (err) {
            console.log(err)
        }
    })
}
function connfunction(socket){
    socket.on('message', function(message) {
        console.log(message)
        var mData = JSON.parse(message)
        if(mData.key == 'sessionKey')
            reqSessionKey(mData, socket)
        else if(mData.key == 'submitInfo')
            reqSubmitInfo(mData, socket)
        else if(mData.key == 'getSubmits')
            reqGetSubmits(mData, socket)
        else if(mData.key == 'getImagesProps')
            reqGetImagesProps(mData, socket)
        else if(mData.key == 'payRequest') {
            joiners.updateConn(mData.value.localKey, socket)
            reqPayment(mData, socket)
        }
        else if(mData.key == 'searchPeople') {
            joiners.updateConn(mData.value.localKey, socket)
            reqSearchPeople(mData, socket)
        }
        else if(mData.key == 'delSubmits') {
            joiners.updateConn(mData.value.localKey, socket)
            reqDelSubmits(mData, socket)
        }
        else if(mData.key == 'delUnpayeds') {
            joiners.updateConn(mData.value.localKey, socket)
            reqDelUnpayeds(mData, socket)
        }
        else if(mData.key == 'submitMsgs') {
            joiners.updateConn(mData.value.localKey, socket)
            reqMsgsSubmit(mData, socket)
        }
        else if(mData.key == 'getMsgs') {
            joiners.updateConn(mData.value.localKey, socket)
            reqGetMsgs(mData, socket)
        }
        else if(mData.key == 'mgrphimg')
            reqGetMgrpHimg(mData, socket)
        else if(mData.key == 'grpset')
            reqGroupSet(mData, socket)
        else if(mData.key == 'grpget')
            reqGroupData(mData, socket)
        else if(mData.key == 'grpchk')
            reqChkGrp(mData, socket)
        else if(mData.key == 'grpdetailchk')
            reqChkGroups(mData, socket)
        else if(mData.key == 'updategrps')
            reqGroupUpdate(mData, socket)
        else if(mData.key == 'handact')
            reqChkOnliner(mData, socket)
        else if(mData.key == 'gettalking')
            reqOnlineTalk(mData, socket)
        else if(mData.key == 'mastergets')
            reqMasterGets(mData, socket)
        else if(mData.key == 'masterdels')
            reqMasterDels(mData, socket)
        else if(mData.key == 'masternet')
            reqMasterOrders(mData, socket)
        else if(mData.key == 'restart')
            reqRestart(socket)
    })
    socket.on('error', function() {
        console.log('socket error')
        socket.removeAllListeners('error')
        joiners.appOptErr(null, null, Array.prototype.join.call(arguments, ", "), 'app.conn.on(error)', 'all_table', 'null', 'null')
    })
    socket.on('close', function() {
        console.log('close')
        closeAction(socket)
    })
}
wss_server.on('connection', connfunction)

wss_server.on('error', function(err){
    console.log(err)
    wss_server.removeAllListeners('error')
})
//reqGroupSet({"key":"grpset","value":{"master":"3yh1swTl1dRpL3AbIUelpJ1Pw9II4kPIo0N24fk4u1LWHFgj94pOapg8hOdkzDbP2NYYEQDe2fxMKC2F0dU7XTj5OmkeE0C4QMJ6JRsaPiBupnkTTU55ZnKs2KiM9qYO8Iq8eLLn49USuqxI2augboDrYrql0VL5rRp4sMyc","nick":"段变条"},"avurl":"http://wx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTLGrLmlArP7ibs5g42LPN0Twnem4EcNbOC99rYhAjibPRdBibhYS2nk01yribeedjk5hEdcs09avwfrOA/0"})
//reqSubmitInfo({key: 'submitInfo', value: {localkey:'iFE8WQJsBOw6e8afZJ9B9aORbcBkvnin', pages: "iFE8WQJsBOw6e8afZJ9B9aORbcBkvnin_1545016345328", iFE8WQJsBOw6e8afZJ9B9aORbcBkvnin_1545016345328: [{top: 18, left: 0, width: 375, height: 603, view_height: 585, background: "#c1e5a9", cons:[{picture: {top: 6, width: 365, height: 64, left: 5}, scale: 1, type: "pic-pturn"}]}]}})
//reqGetSubmits({key:'getSubmits', value:{type:'pages', localkey:'iFE8WQJsBOw6e8afZJ9B9aORbcBkvnin'}})
testcloseAction()