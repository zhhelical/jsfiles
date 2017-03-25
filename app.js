//app.js
"use strict"

const ws = require('ws')
const xml2js = require('xml2js')
const request = require('request')
const fetch = require('node-fetch')
const mysql = require('../../databases/mysqldata.js')
const redis = require('../../databases/rediscache.js')
const webfetch = require('./service/fetchweb.js')
const co = require('co')
const master = require('./service/master.js')
const joiners = require('./service/clients.js')
const txgeo = require('./service/txgeo.js')
const payprocess = require('./service/payunits.js')
const session_random = require('./service/shell.js')
var sending = false
const https_server = require('./httpssrv.js')
const wss_server = new ws.Server({server: https_server})
wss_server.maxSockets = Infinity
var find_openid = function(local, conn, cb){
    var f_openid = joiners.findByKey(local)
    if(!f_openid){
        redis.getCacheKey(`*${local}*`).then(function (r_key) {
            if (!r_key.length) {
                mysql.newComerTest(`${local}`).then(function(sql_key) {
                    if(sql_key.length)
                        cb({db:'sql', value:JSON.parse(sql_key)})
                    else
                        cb(null)
                }).then(function(err){
                    if (err)
                        cb(null)
                })
            }
            else
                cb({db:'redis', value:JSON.parse(r_key)})
        }).then(function (err) {
            if (err)
                cb(null)
        })
    }
    else {
        redis.getCacheKey(`*${local}*`).then(function (r_key) {
            if (!r_key.length) {
                if (!f_openid.key.session_key)
                    cb({db:'sql', value:f_openid.key})
                else
                    cb({db:'joiner', value:f_openid.key})
            }
            else
                cb({db:'redis', value:f_openid.key})
        }).then(function (err) {
            if (err)
                cb(null)
        })
    }
}
var sendEndDeal = function(mkey, conn, value){
    if(sending) {
        try {
            //console.log('conn.send', value)
            conn.send(JSON.stringify({key: mkey, value: value}))
        }
        catch (e) {
            console.log(e)
        }
    }
    sending = false
}
var recurseForWxHide = function(mData, conn, err_code, cb){
    var recurse = JSON.stringify(mData)
    recurse = eval('('+recurse+')')
    mData.key = 'sessionKey'
    mData.value = mData.value.localKey
    reqSessionKey(mData, conn, false, function(s_res){
        if(s_res)
            cb(recurse, conn)
        else
            sendEndDeal(recurse.key, conn, err_code)
    })
}
var reqOpenid = function(conn, mData, cb){
    var double_leap = '//'
    var options = {
        url: `https:${double_leap}api.weixin.qq.com/sns/jscode2session?appid=wxf9a75ea1c3517fbe&secret=9aceb733968d171ed70207f87c5dcb9e&js_code=${mData.value}&grant_type=authorization_code`
    }
    request(options, function(error, response, body){
        if (!error && response.statusCode == 200) {
            var info = JSON.parse(body)
            if(info.errcode){
                sendEndDeal(mData.key, conn, 'openid undefined')
                return
            }
            mysql.loggersSave(info.openid)
            cb(info)
        }
        else {
            joiners.appOptErr(mData.value, null, `${error}||${response.statusCode}`, 'app.reqOpenid', 'null', mData.value, 'null')
            sendEndDeal(mData.key, conn, '网站升级中...')
        }
    })
}
var reqSessionKey = function(mData, conn, send, cb){
    if (!redis.redis_srv)
        redis.construct()
    mysql.newComerTest(`${mData.value}`).then(function(sql_key) {
        if(sql_key.length) {
            var key_obj = JSON.parse(sql_key)
            mysql.loggersSave(key_obj.openid)
            var feedback = {key: mData.key, value: key_obj.localKey}
            redis.getCacheKey(`${sql_key}`).then(function (r_key) {
                if (!r_key.length) {
                    joiners.joinEvent(key_obj, conn, true, false, function (j_res) {
                        if (j_res.key == 'join success') {
                            if(j_res.value != key_obj.localKey)
                                feedback.value = j_res.value
                            if(send)
                                sendEndDeal(mData.key, conn, feedback.value)
                            else
                                cb(true)
                        }
                        else {
                            joiners.appOptErr(key_obj.openid, key_obj.localKey, `${j_res}`, 'app.sessionKey.mysql.newComerTest.redis.getCacheKey.joiners.joinEvent_cache_false', 'null', mData.value, 'null')
                            if(send)
                                sendEndDeal(mData.key, conn, 'sessionKey failed')
                            else
                                cb(false)
                        }
                    })
                }
                else {
                    joiners.joinEvent(key_obj, conn, true, true, function (j_res) {
                        if (j_res.key == 'join success') {
                            if(j_res.value != key_obj.localKey)
                                feedback.value = j_res.value
                            if(send)
                                sendEndDeal(mData.key, conn, feedback.value)
                            else
                                cb(true)
                        }
                        else {
                            joiners.appOptErr(key_obj.openid, key_obj.localKey, `${j_res}`, 'app.sessionKey.mysql.newComerTest.redis.getCacheKey.joiners.joinEvent_cache_true', 'null', mData.value, 'null')
                            if(send)
                                sendEndDeal(mData.key, conn, 'sessionKey failed')
                            else
                                cb(false)
                        }
                    })
                }
            }).then(function (err) {
                if (err) {
                    joiners.appOptErr(key_obj.openid, null, `${err}`, 'app.sessionKey.*.redis.getCacheKey', 'null', mData.value, 'null')
                    if(send)
                        sendEndDeal(mData.key, conn, 'sessionKey failed')
                    else
                        cb(false)
                }
            })
        }
        else{
            reqOpenid(conn, mData, function(reop){
                mysql.newComerTest(`${reop.openid}`).then(function(sql_key) {
                    if(sql_key.length) {
                        var key_obj = JSON.parse(sql_key)
                        var feedback = {key: mData.key, value: key_obj.localKey}
                        joiners.joinEvent(key_obj, conn, true, false, function (j_res) {
                            if (j_res.key == 'join success') {
                                if(j_res.value != key_obj.localKey)
                                    feedback.value = j_res.value
                                if(send)
                                    sendEndDeal(mData.key, conn, feedback.value)
                                else
                                    cb(true)
                            }
                            else {
                                joiners.appOptErr(key_obj.openid, key_obj.localKey, `${j_res}`, 'app.sessionKey.*.mysql.newComerTest.redis.getCacheKey.joiners.joinEvent_cache_false', 'null', mData.value, 'null')
                                if(send)
                                    sendEndDeal(mData.key, conn, 'sessionKey failed')
                                else
                                    cb(false)
                            }
                        })
                    }
                    else{
                        var sh_order = 'head -n 80 /dev/urandom | tr -dc A-Za-z0-9 | head -c 168'
                        session_random.shellFunc(sh_order).then(function (result) {
                            var in_person = {localKey:result, openid:reop.openid, session_key:reop.session_key, expires_in:reop.expires_in}
                            joiners.joinEvent(in_person, conn, false, false, function (f_res) {
                                if(send)
                                    sendEndDeal(mData.key, conn, result)
                                else
                                    cb(true)
                            })
                        }).then(function (err) {
                            if (err) {
                                joiners.appOptErr(reop.openid, null, `${err}`, 'app.sessionKey.*.session_random.shellFunc', 'null', mData.value, 'null')
                                if(send)
                                    sendEndDeal(mData.key, conn, 'sessionKey failed')
                                else
                                    cb(false)
                            }
                        })
                    }
                }).then(function (err) {
                    if (err) {
                        joiners.appOptErr(reop.openid, null, `${err}`, 'app.sessionKey.*.request.mysql.newComerTest', 'null', mData.value, 'null')
                        if(send)
                            sendEndDeal(mData.key, conn, 'sessionKey failed')
                        else
                            cb(false)
                    }
                })
            })
        }
    }).then(function (err) {
        if (err) {
            joiners.appOptErr(mData.value, null, `${err}`, 'app.sessionKey.mysql.newComerTest', 'null', mData.value, 'null')
            if(send)
                sendEndDeal(mData.key, conn, 'sessionKey failed')
            else
                cb(false)
        }
    })
}
var oldUserStoreRedis = function(c_key, mData, conn){
    redis.getCacheValue(c_key).then(function (val) {
        if(val.length) {
            var cache_objs = eval('('+val+')')
            cache_objs.push(mData.value.nest)
            redis.storeCache(c_key, JSON.stringify(cache_objs)).then(function (res) {
                sendEndDeal(mData.key, conn, 'submit received')
            }).then(function (err) {
                if (err) {
                    var js_key = JSON.parse(c_key)
                    joiners.appOptErr(js_key.openid, null, err, 'app.submitInfo.redis.storeCache', 'people', mData.value, 'null')
                    sendEndDeal(mData.key, conn, 'submit failed')
                }
            })
        }
        else
            recurseForWxHide(mData, conn, 'submit failed', reqSessionKey)
    }).then(function(err){
        if(err){
            var js_key = JSON.parse(c_key)
            joiners.appOptErr(js_key.openid, null, `${err}`, 'app.submitInfo.redis.getCacheValue', 'people', mData.value, 'null')
            sendEndDeal(mData.key, conn, 'submit failed')
        }
    })
}
var reqSubmitInfo = function(mData, conn){
    txgeo.findLocalAddr(mData.value.nest.location, function (c_res) {
        if(c_res != 'error') {
            var detail_addr = c_res.split('市')[0] + '市'
            mData.value.nest.address = detail_addr
            redis.getCacheKey(`*${mData.value.localKey}*`).then(function (c_key) {
                if (c_key.length)
                    oldUserStoreRedis(c_key, mData, conn)
                else{
                    find_openid(mData.value.localKey, conn, function(f_res){
                        if(f_res){
                            var new_keys = f_res.value
                            if(new_keys.session_key) {
                                var first_store = {localKey: mData.value.localKey, openid: new_keys.openid}
                                var first_value = {session_key: new_keys.session_key, expires_in: new_keys.expires_in}
                                var first_array = []
                                first_array.push(first_value)
                                first_array.push(mData.value.nest)
                                redis.storeCache(JSON.stringify(first_store), JSON.stringify(first_array)).then(function (res) {
                                    sendEndDeal(mData.key, conn, 'submit received')
                                }).then(function (err) {
                                    if (err) {
                                        joiners.appOptErr(new_openid, null, err, 'app.submitInfo.redis.storeCache', 'people', 'null', mData.value)
                                        sendEndDeal(mData.key, conn, 'submit failed')
                                    }
                                })
                            }
                            else {
                                if(f_res.db == 'redis')
                                    oldUserStoreRedis(JSON.stringify(new_keys), mData, conn)
                                else
                                    recurseForWxHide(mData, conn, 'submit failed', reqSubmitInfo)
                            }
                        }
                        else
                            sendEndDeal(mData.key, conn, 'submit failed')
                    })
                }
            }).then(function(err){
                if(err){
                    joiners.appOptErr(null, mData.value.localKey, `${err}`, 'app.submitInfo.redis.getCacheKey', 'people', mData.value, 'null')
                    sendEndDeal(mData.key, conn, 'submit failed')
                }
            })
        }
        else {
            if(c_res) {
                joiners.appOptErr(null, mData.value.localKey, `${c_res}`, 'app.submitInfo.txgeo', 'people', mData.value, 'null')
                sendEndDeal(mData.key, conn, 'submit failed')
            }
        }
    })
}
var reqGetSubmits = function(mData, conn){
    find_openid(mData.value.localKey, conn, function(f_res){
        if(f_res){
            if(f_res.db == 'redis') {
                var which_gate = mData.value.gate
                var chk_keys = f_res.value
                var send_array = []
                redis.getCacheValue(JSON.stringify(chk_keys)).then(function (cacheres) {
                    if (cacheres.length) {
                        var chk_obj = eval('(' + cacheres + ')')
                        for (var ech in chk_obj) {
                            if (ech == 0)
                                continue
                            if (which_gate == chk_obj[ech].content.add_key)
                                send_array.push(chk_obj[ech])
                        }
                        if (send_array.length)
                            sendEndDeal(mData.key, conn, send_array)
                        else
                            sendEndDeal(mData.key, conn, 'no submits now')
                    }
                    else
                        sendEndDeal(mData.key, conn, 'no submits now')
                }).then(function (err) {
                    if (err) {
                        joiners.appOptErr(chk_keys.openid, mData.value.localKey, `${err}`, 'app.getSubmits.redis.getCacheValue', 'people', mData.value, 'null')
                        sendEndDeal(mData.key, conn, 'failed getSubmits')
                    }
                })
            }
            else
                recurseForWxHide(mData, conn, 'failed getSubmits', reqGetSubmits)
        }
        else
            sendEndDeal(mData.key, conn, 'failed getSubmits')
    })
}
var reqGetImagesProps = function(mData, conn){
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
        }).then(function(res_err){
            if(res_err) {
                joiners.appOptErr(null, list[0].key, `${res_err}`, 'app.getImagesProps.mysql.select_picsprops', 'pictures', list[0].time, 'null')
                list.splice(0, 1)
                recurse_gets(list)
            }
        })
    }
    recurse_gets(get_list)
}
var reqPayment = function(mData, conn){
    find_openid(mData.value.localKey, conn, function(f_res){
        if(f_res){
            var openid = f_res.value.openid
            var pay_good = payprocess.helicalGoods(mData.value.type, mData.value.price)
            var local_order = payprocess.helicalOrder(mData.value.type, mData.value.stime)
            payprocess.options(openid, local_order, pay_good, mData.value.price, function(res_opt){
                if(res_opt){
                    request(res_opt.value.urlobj/*here will delete urlobj for stable version*/, function(error, response, body){
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
var reqSearchPeople = function(mData, conn){
    find_openid(mData.value.localKey, conn, function(f_res){
        if(f_res){
            var chk_id = f_res.value.openid
            if(chk_id == master.id_master && !mData.value.map)
                master.getSuitableSubmits(mData.value.from).then(function(g_res){
                    sendEndDeal(mData.key, conn, {recs:g_res, master:true})
                }).then(function(err){
                    if(err)
                        sendEndDeal(mData.key, conn, {recs:'no any recs', master:true})
                })
            else {
                var lat = mData.value.latitude, lng = mData.value.longitude, scope = mData.value.scope
                var chk_local = {latitude: mData.value.latitude, longitude: mData.value.longitude}
                txgeo.findLocalAddr(chk_local, function (res) {
                    if (res != 'error') {
                        var detail_addr = res.split('市')[0] + '市'
                        redis.searchScope(mData.value.latitude, mData.value.longitude, mData.value.old_scope, mData.value.scope, {city: detail_addr, gate: mData.value.gate}).then(function (res) {
                            if (res.length) {
                                if (res.length > 30)
                                    sendEndDeal(mData.key, conn, 'so large')
                                else
                                    sendEndDeal(mData.key, conn, res)
                            }
                            else {
                                webfetch.digWebSrc(chk_local, mData.value.gate, mData.value.scope, function(w_res){
                                    if(!w_res)
                                        sendEndDeal(mData.key, conn, 'no person now')
                                    else{
                                        redis.searchScope(mData.value.latitude, mData.value.longitude, mData.value.old_scope, mData.value.scope, {city: detail_addr, gate: mData.value.gate}).then(function (res){
                                            if(res.length)
                                                sendEndDeal(mData.key, conn, res)
                                            else
                                                sendEndDeal(mData.key, conn, 'no person now')
                                        }).then(function(err){
                                            sendEndDeal(mData.key, conn, 'searchPeople failed')
                                        })
                                    }
                                })
                            }
                        }).then(function (err) {
                            if (err) {
                                joiners.appOptErr(null, mData.value.localKey, `${err}`, 'app.searchPeople.*.redis.searchScope', 'people', mData.value, 'null')
                                sendEndDeal(mData.key, conn, 'searchPeople failed')
                            }
                        })
                    }
                    else {
                        joiners.appOptErr(null, mData.value.localKey, `${res}`, 'app.searchPeople.txgeo', 'people', mData.value, 'null')
                        sendEndDeal(mData.key, conn, 'searchPeople failed')
                    }
                })
            }
        }
        else
            sendEndDeal(mData.key, conn, 'searchPeople failed')
    })
}
var reqDelSubmits = function(mData, conn){
    if(mData.value.hasOwnProperty('master')){
        mysql.masterDelete(mData.value.time, JSON.stringify(mData.value.local), mData.value.addr).then(function(s_res){
            if(s_res.length) {
                redis.storeCache(s_res[0], s_res[1]).then(function (res) {
                    conn.send(JSON.stringify({key: 'delSubmits', value: 'delSubmits finished'}))
                }).then(function (err) {
                    if (err) {
                        var js_key = JSON.parse(s_res[0])
                        joiners.appOptErr(js_key.openid, js_key.localKey, err, 'app.delSubmits.*.redis.storeCache', 'people', 'null', s_res[1])
                        sendEndDeal(mData.key, conn, 'delSubmits finished')
                    }
                })
            }
            else
                sendEndDeal(mData.key, conn, 'delSubmits finished')
        }).then(function(err){
            if (err) {
                sendEndDeal(mData.key, conn, 'delSubmits finished')
                joiners.appOptErr(null, null, `${err}`, 'app.delSubmits.mysql.masterDelete', 'people', 'null', JSON.stringify(mData.value))
            }
        })
    }
    else {
        find_openid(mData.value.localKey, conn, function(f_res){
            if(f_res){
                if(f_res.db == 'redis') {
                    var key = JSON.stringify(f_res.value)
                    redis.getCacheValue(key).then(function (val) {
                        if (val) {
                            var cache_objs = eval('(' + val + ')')
                            var old_caches = cache_objs.slice(0)
                            cache_objs.pop()
                            redis.storeCache(key, JSON.stringify(cache_objs)).then(function (res) {
                                sendEndDeal(mData.key, conn, 'delSubmits finished')
                            }).then(function (err) {
                                if (err) {
                                    var js_key = JSON.parse(key)
                                    joiners.appOptErr(js_key.openid, null, err, 'app.delSubmits.redis.storeCache', 'people', JSON.stringify(old_caches), JSON.stringify(cache_objs))
                                    sendEndDeal(mData.key, conn, 'delSubmits finished')
                                }
                            })
                        }
                        else
                            sendEndDeal(mData.key, conn, 'delSubmits finished')
                    }).then(function (err) {
                        if (err) {
                            var js_key = JSON.parse(key)
                            joiners.appOptErr(js_key.openid, null, `${err}`, 'app.delSubmits.redis.getCacheValue', 'people', mData.value, 'null')
                            sendEndDeal(mData.key, conn, 'delSubmits finished')
                        }
                    })
                }
                else
                    recurseForWxHide(mData, conn, 'delSubmits finished', reqDelSubmits)
            }
            else
                sendEndDeal(mData.key, conn, 'delSubmits finished')
        })
    }
}
var reqDelUnpayeds = function(mData, conn){
    find_openid(mData.value.localKey, conn, function(f_res){
        if(f_res){
            if(f_res.db == 'redis') {
                var delsends = mData.value.unpayeds
                var tol_keys = f_res.value
                var key = JSON.stringify(tol_keys)
                redis.getCacheValue(key).then(function (val) {
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
                        }).then(function (err) {
                            if (err) {
                                joiners.appOptErr(js_key.openid, null, err, 'app.delUnpayeds.redis.storeCache', 'people', JSON.stringify(cache_objs), JSON.stringify(d_time))
                                sendEndDeal(mData.key, conn, 'delUnpayeds finished')
                            }
                        })
                    }
                    else
                        sendEndDeal(mData.key, conn, 'delUnpayeds finished')
                    joiners.asynDelPics(delsends, tol_keys.openid)
                }).then(function (err) {
                    if (err) {
                        joiners.appOptErr(tol_keys.openid, mData.value.localKey, `${err}`, 'app.delUnpayeds.redis.getCacheValue', 'people', mData.value, 'null')
                        sendEndDeal(mData.key, conn, 'delUnpayeds finished')
                    }
                })
            }
            else
                recurseForWxHide(mData, conn, 'delUnpayeds finished', reqDelUnpayeds)
        }
        else
            sendEndDeal(mData.key, conn, 'delUnpayeds finished')
    })
}
var reqMsgsSubmit = function(mData, conn){
    find_openid(mData.value.localKey, conn, function(f_res){
        if(f_res){
            var openid = f_res.value.openid
            var msg_time = new Date().getTime()
            mysql.msgsSave(openid, mData.value.contents, msg_time, true).then(function (s_res) {
                sendEndDeal(mData.key, conn, s_res)
                joiners.msgAutoReply(openid, msg_time)
            }).then(function (err) {
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
var reqGetMsgs = function(mData, conn){
    find_openid(mData.value.localKey, conn, function(f_res){
        if(f_res){
            var openid = f_res.value.openid
            if(openid == master.id_master)
                master.getSuitableMsgs(mData.value.from).then(function(g_res){
                    sendEndDeal(mData.key, conn, g_res)
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
                }).then(function (err) {
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
var reqMasterGets = function(mData, conn){
    mysql.masterGetting(mData.value).then(function (s_res) {
        if(s_res.length)
            sendEndDeal(mData.key, conn, s_res)
        else
            sendEndDeal(mData.key, conn, 'empty')
    }).then(function (err) {
        if (err) {sendEndDeal(mData.key, conn, err)}
    })
}
var reqMasterDels = function(mData, conn){
    var info = mData.value
    mysql.deleteTblRow(info.table, info.id).then(function (s_res) {
        if(info.table == 'pictures'){
            if (!info.img.match('/'))
                info.img = '/data/release/helical/uploads/' + info.img
            var sh_order = `rm -rf ${info.img}`
            session_random.shellFunc(sh_order).then(function (result) {
                sendEndDeal(mData.key, conn, s_res)
            }).then(function (err) {
                if (err) {
                    that.appOptErr('master', null, err, `reqMasterDels(${info.img})`, `${info.img}`, `${info.img}`, 'null')
                    sendEndDeal(mData.key, conn, 'del fail')
                }
            })
        }
        else
            sendEndDeal(mData.key, conn, s_res)
    }).then(function (err) {
        if (err) {sendEndDeal(mData.key, conn, err)}
    })
}
var reqMasterOrders = function(mData, conn){
    if(mData.value.localKey == 'KszJ7tuIWKNdgzyivjzgqvGV7UEywp3oAylMbwtJWeiVoIi0E7Wkkd3A4Qe3R0AyarrT9Riuh23dbIfkExrHBN0PQq9322ILps3yUcq0bwgoCWm0CTaaNfBBKlrTOUghWQfKQHoE8d8kiN7um3wi4XpsMzpWT7UoZmYrrDrO') {
        if (mData.value.order == 0)
            master.startWebIndexesFetch(mData.value.duration)
        else if (mData.value.order == 1)
            master.startGenWebLinks()
        else if (mData.value.order == 2)
            master.startGenWebObjs()
        else if (mData.value.order == 3)
            master.startGenWebImgs()
        else
            master.stopWebFetch()
        sendEndDeal(mData.key, conn, 'finished order')
    }
    else
        sendEndDeal(mData.key, conn, 'please not')
}
var reqRestart = function(conn){
    var sh_order = 'pm2 restart wscsrv'
    session_random.shellFunc(sh_order).then(function (result) {
        conn = null
    }).then(function (err) {
        if (err)
            conn = null
    })
    joiners.appOptErr(null, null, 'restart', 'app.conn.on(restart)', 'null', 'null', 'pm2 restart wscsrv')
}
var closeAction = function(conn){
    var key_id = joiners.findEvent(conn)
    if(key_id) {
        var ids_str = JSON.stringify({localKey:key_id.localKey, openid:key_id.openid})
        redis.getCacheValue(ids_str).then(function (cacheres) {
            if(cacheres) {
                if(key_id.hasOwnProperty('expires_in')){
                    delete key_id.expires_in
                    delete key_id.session_key
                }
                var cache_objs = eval('('+cacheres+')')
                if (cache_objs.length > 0) {
                    mysql.text_exec(ids_str).then(function (result) {
                        if (result.length) {
                            if (result != cacheres) {
                                var sql_vals = eval('('+result+')')
                                if (cache_objs.length < sql_vals.length) {
                                    var rec_sql = sql_vals.pop()
                                    if (sql_vals.length == 1) {
                                        mysql.deletePeopleRow(ids_str).then(function (s_res) {
                                        }).then(function (err) {
                                            if (err)
                                                joiners.appOptErr(key_id.openid, null, `${err}`, 'app.conn.on(close).*.mysql.deletePeopleRow', 'people', result, cacheres)
                                        })
                                        redis.deleteData(ids_str).then(function (rd_res) {
                                        }).then(function (err) {
                                            if (err)
                                                joiners.appOptErr(key_id.openid, null, `${err}`, 'app.conn.on(close).*.redis.deleteData', 'people', result, cacheres)
                                        })
                                    }
                                    var arr_time = [rec_sql]
                                    joiners.asynDelPics(arr_time, key_id.openid)
                                }
                                mysql.update_exec(ids_str, cacheres).then(function (res) {
                                    joiners.recordsExpired(ids_str)
                                    console.log('mysql update')
                                }).then(function (err) {
                                    if (err)
                                        joiners.appOptErr(key_id.openid, null, `${err}`, 'app.conn.on(close).*.mysql.update_exec', 'people', result, cacheres)
                                })
                            }
                        }
                        else {
                            mysql.insert_exec(ids_str, cacheres).then(function () {
                            }).then(function (err) {
                                if (err)
                                    joiners.appOptErr(key_id.openid, null, `${err}`, 'app.conn.on(close).*.mysql.insert_exec', 'people', 'null', cacheres)
                            })
                            console.log('mysql insert')
                        }
                    })
                }
            }
        }).then(function(err){
            if(err)
                joiners.appOptErr(key_id.openid, null, `${err}`, 'app.conn.on(close).redis.getCacheValue', 'people', 'null', 'null')
        })
    }
}

wss_server.on('connection', function(socket){
    socket.setMaxListeners(0)
    socket.on('message', function(message) {
        console.log(message)
        sending = true
        var mData = JSON.parse(message)
        if(mData.key == 'sessionKey')
            reqSessionKey(mData, socket, true)
        else if(mData.key == 'submitInfo') {
            joiners.updateConn(mData.value.localKey, socket)
            reqSubmitInfo(mData, socket)
        }
        else if(mData.key == 'getSubmits')
            reqGetSubmits(mData, socket)
        else if(mData.key == 'getImagesProps')
            reqGetImagesProps(mData, socket)
        else if(mData.key == 'payRequest')
            reqPayment(mData, socket)
        else if(mData.key == 'searchPeople')
            reqSearchPeople(mData, socket)
        else if(mData.key == 'delSubmits') {
            joiners.updateConn(mData.value.localKey, socket)
            reqDelSubmits(mData, socket)
        }
        else if(mData.key == 'delUnpayeds') {
            joiners.updateConn(mData.value.localKey, socket)
            reqDelUnpayeds(mData, socket)
        }
        else if(mData.key == 'submitMsgs')
            reqMsgsSubmit(mData, socket)
        else if(mData.key == 'getMsgs')
            reqGetMsgs(mData, socket)
        else if(mData.key == 'mastergets')
            reqMasterGets(mData, socket)
        else if(mData.key == 'masterdels')
            reqMasterDels(mData, socket)
        else if(mData.key == 'masternet')
            reqMasterOrders(mData, socket)
        else if(mData.key == 'restart') {
            joiners.updateConn(mData.value, socket)
            reqRestart(socket)
        }
        else if(mData.key == 'closing') {
            socket.send(JSON.stringify({key: mData.key, value:'joiners deleted'}))
            joiners.leaveEvent(mData.value)
        }
    })
    socket.on('error', function() {
        console.log(socket)
        joiners.appOptErr(null, null, Array.prototype.join.call(arguments, ", "), 'app.conn.on(error)', 'all_table', 'null', 'null')
    })
    socket.on('close', function() {
        console.log('close')
        closeAction(socket)
    })
})
//webfetch.digWebSrc({"longitude":125.34938,"latitude":43.88495}, 'tapGates')
//webfetch.webIndexesFetch()


