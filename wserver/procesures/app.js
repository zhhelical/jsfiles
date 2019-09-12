//app.js
"use strict"
var tmp_weathdata={}
const xml2js = require('xml2js')
const request = require('request')
const  url = require('url')
const mysql = require('../../databases/mysqldata.js')
const redis = require('../../databases/rediscache.js')
const joiners = require('./service/clients.js')
const payprocess = require('./service/payunits.js')
const session_random = require('./service/shell.js')

function sendEndDeal(mkey, conn, value){
    if(conn.readyState != 1){
        reqRestart(conn)
        return
    }
    try {
        conn.send(JSON.stringify({key: mkey, value: value}))
    }
    catch (e) {
        joiners.appOptErr(e, value.localkey, 'ws send failed')
    }
}
function emitEndDeal(mkey, value, broadcast, cb){
    try {
        broadcast.forEach(function(client){
            client.send(JSON.stringify({key: mkey, value: value}))
        })
	if(cb)
            cb('success')
    }
    catch (e) {
        if(cb)
            cb(e)
    }
}
function reqOpenid(conn, code, cb){
    var double_leap = '//'
    var options = {
        url: `https:${double_leap}api.weixin.qq.com/sns/jscode2session?appid=wxf9a75ea1c3517fbe&secret=9aceb733968d171ed70207f87c5dcb9e&js_code=${code}&grant_type=authorization_code`
    }
    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var info = JSON.parse(body)
            if (info.errcode) 
                return cb('fail openid_'+info.errcode)
            cb(info)
        }
        else 
            cb('web request fail')
    })
}
function reqSessionKey(mData, conn){
    reqOpenid(conn, mData.value.code, function (reop) {
        if(typeof(reop)==='String'){
            if(reop.match('openid'))
                sendEndDeal(mData.key, conn, 'openid undefined')
            else{
                sendEndDeal(mData.key, conn, '网站升级中...')
                joiners.appOptErr(reop, 'app.reqOpenid', 'empty')
            }
        }
        else
            redis.getUsrField('people:usrs', reop.openid).then(function (usr) {
                if(usr) {
                    joiners.getUsrWealth(mData.value.localkey).then(function(res){
                        if (res)
                            sendEndDeal(mData.key, conn, {localkey: usr, openid: reop.openid, wealth:res})
                        else
                            sendEndDeal(mData.key, conn, {localkey: usr, openid: reop.openid})
                    }).catch(function(err){
                        sendEndDeal(mData.key, conn, {localkey: usr, openid: reop.openid, wealth:'load wrong'})
                    })
                }
                else{
                    let sh_order = 'head -n 80 /dev/urandom | tr -dc A-Za-z0-9 | head -c 32'
                    session_random.shellFunc(sh_order).then(function (result) {
                        sendEndDeal(mData.key, conn, {localkey:result, openid:reop.openid})
                        redis.storeUsrHash('people:usrs', [reop.openid,result]).then(function () {
                            redis.appendUsrsList('people:lkeys', [result]).then(function () {}).catch(function (err) {
                                if (err)
                                    joiners.appOptErr(err, 'reqSessionKey appendUsrsList', result)
                            })
                        }).catch(function (err) {
                            if (err) {
                                sendEndDeal(mData.key, conn, 'failed after sh_order storeUsrHash')
                                joiners.appOptErr(err, 'reqSessionKey failed after sh_order storeUsrHash', JSON.stringify({[reop.openid]:result}))
                            }
                        })
                    }).catch(function (err) {
                        if (err) {
                            sendEndDeal(mData.key, conn, 'sessionKey failed')
                            joiners.appOptErr(err, 'reqSessionKey.session_random.shellFunc', 'empty')
                        }
                    })
                }
            }).catch(function (err) {
                if (err) {
                    sendEndDeal(mData.key, conn, 'failed getUsrField')
                    joiners.appOptErr(err, 'reqSessionKey.redis.getUsrField', 'empty')
                }
            })
    })
}
function reqSubmitInfo(mData, conn){
    let values = mData.value.val, results = values.types ? [] : {}, p_label = values.pages ? 'pages' : (values.groups ? 'groups' : (values.rooms ? 'rooms' : 'questions'))
    function rediStore(dels, cb){
        let store_contents = values.types ? results : [`${p_label}:${mData.value.localkey}`, JSON.stringify(results)]
        if(p_label == 'groups' && values.mywealth)
            store_contents = store_contents.concat([`wealth:${mData.value.localkey}`, JSON.stringify(values.mywealth)])
        redis.storeUsrHash('people:data', store_contents).then(function (res) {
            if(cb)
                return cb('success')
      	    sendEndDeal(mData.key, conn, 'submit received')
            if(dels)
                joiners.delUsrRelateds(mData.value.localkey, values.update, dels).then(function(){}).catch(function(){})
        }).catch(function (err) {
            if (err) {
                if(cb)
                    return cb('failed')
                sendEndDeal(mData.key, conn, 'submit failed')
                joiners.appOptErr(err, 'reqSubmitInfo.redis.storeUsrHash', 'empty')
            }
        })
    }
    if(values.types)
        redis.getUsrFieldsValue('people:data', values.types.fields).then(function (datas) {
            datas=datas.map(function(data, index){
                let f_data = JSON.parse(data), store_data = values.types.stores[index], s_times = Object.getOwnPropertyNames(store_data)
                s_times.forEach(function(time){
                    f_data[time] = store_data[time]
                })
                return JSON.stringify(f_data)
            })
            values.types.fields.forEach(function(field, index){
                results.push(field)
                results.push(datas[index])
            })
            rediStore()
        }).catch(function (err) {
            if (err) {
                sendEndDeal(mData.key, conn, 'submit failed')
                joiners.appOptErr(err, 'reqSubmitInfo.values.types.redis.getUsrFieldsValue', 'empty')
            }
        })
    else
        redis.getUsrField('people:data', `${p_label}:${mData.value.localkey}`).then(function(res){
            if(res)
                results = JSON.parse(res)
            results[values[p_label]] = values[values[p_label]]
            if(values.old_answerings)
                joiners.delOldanswerings(mData.value.localkey, values.update, values.old_answerings, values.old_times).then(function (res) {
                    if(res)
                        rediStore(res)
                    else
                        rediStore()
                }).catch(function (err) {
                    if (err)
                        sendEndDeal(mData.key, conn, 'submit failed')
                })
            else{
                if(values.update)
                    redis.getUsrFieldsValue(`media:${mData.value.localkey}`, values.update).then(function (dres) {
                        rediStore(dres)
                    }).catch(function (err) {
                        if (err) {
                            sendEndDeal(mData.key, conn, 'submit failed')
                            joiners.appOptErr(err, 'reqSubmitInfo.redis.getUsrFieldsValue', 'empty')
                        }
                    })
                else if(values.answering)
                    redis.getUsrField(`communicate:${values.answer}`, values.owner).then(function (contents) {
                        let obj_contents = null, a_time = values.answering.time
                        if (contents) {
                            obj_contents = JSON.parse(contents)
                            let answers = obj_contents.answering
                            if(answers)
                                answers[a_time] = values.answering.answering
                            else
                                obj_contents.answering = {[a_time]:values.answering.answering}
                        } else
                            obj_contents = {answering:{[a_time]:values.answering.answering}}
                        rediStore(undefined, function(sres){
                            if(sres == 'success'){
                                redis.storeUsrHash(`communicate:${values.answer}`, [values.owner, JSON.stringify(obj_contents)]).then(function () {
                                    sendEndDeal(mData.key, conn, 'submit received')
                                }).catch(function (err) {
                                    if (err) {
                                        sendEndDeal(mData.key, conn, 'failed')
                                        redis.storeUsrHash('people:data', [`${p_label}:${mData.value.localkey}`, res]).then(function () {}).catch(function (err) {
                                            if (err)
                                                joiners.appOptErr(err+'reqSubmitInfo.redis.storeUsrHash.after communicate store failed', `${p_label}:${mData.value.localkey}:${JSON.stringify(values.answering)}`, res)
                                        })
                                    }
                                })
                            }
                        })
                    }).catch(function (err) {
                        if (err) {
                            sendEndDeal(mData.key, conn, 'failed')
                            joiners.appOptErr(err, 'reqSubmitInfo.redis.getUsrField', `${mData.value.owner}&${mData.value.localkey}`)
                        }
                    })
                else
                    rediStore()
            }
        }).catch(function(err){
            if (err) {
                sendEndDeal(mData.key, conn, 'submit failed')
                joiners.appOptErr(err, 'reqSubmitInfo.redis.getUsrField', 'empty')
            }
        })
}
function reqUsrWealthTransfer(mData, conn){
    let f_get = mData.value.to.wealth ? [mData.value.localkey, mData.value.to.wealth, mData.value.to.data] : [mData.value.localkey, mData.value.to.data]
    redis.getUsrFieldsValue('people:data', f_get).then(function (wealths) {
        let mykey = mData.value.localkey.split(':')[1]
        wealths=wealths.map(function(wealth, index){
            if(index==0)
                return mData.value.mywealth
            let usr_wealth = JSON.parse(wealth)
            if(index==1 && mData.value.to.wealth) {
                let himwealths = Object.getOwnPropertyNames(mData.value.himwealth)
                himwealths.forEach(function (coin) {
                    if (usr_wealth[coin])
                        usr_wealth[coin] += mData.value.himwealth[coin]
                    else
                        usr_wealth[coin] = mData.value.himwealth[coin]
                })
                return usr_wealth
            }
            usr_wealth[mData.value.to.setime] = mData.value.to.contents
	    return usr_wealth
        })
	console.log(wealths)
	let f_set = mData.value.to.wealth ? [mData.value.localkey, JSON.stringify(wealths[0]), mData.value.to.wealth, JSON.stringify(wealths[1]), mData.value.to.data, JSON.stringify(wealths[2])] : [mData.value.localkey, JSON.stringify(wealths[0]), mData.value.to.data, JSON.stringify(wealths[1])]
        redis.storeUsrHash('people:data', f_set).then(function () {
            sendEndDeal(mData.key, conn, 'success')
            if(JSON.stringify(mData.value.mywealth) == '{}')
                redis.deleteHmData('people:data', [`wealth:${mykey}`]).then(function () {
                }).catch(function (err) {
                    if (err)
                        joiners.appOptErr(err + '_redis.reqUsrWealthTransfer.deleteHmData', mykey, 'wealth')
                })
        }).catch(function (err) {
            if (err) {
                sendEndDeal(mData.key, conn, 'failed')
                joiners.appOptErr(err, 'reqUsrWealthTransfer.redis.storeUsrHash', 'empty')
            }
        })
    }).catch(function (err) {
        if (err) {
            sendEndDeal(mData.key, conn, 'failed')
            joiners.appOptErr(err, 'reqUsrWealthTransfer.redis.getUsrFieldsValue', 'empty')
        }
    })
}
function reqGetUsrImg(mData, conn){
    redis.getUsrField('usr:property', mData.value.localkey).then(function(ires){
	console.log(ires)
        if(ires){
            let usr_info = JSON.parse(ires)
            sendEndDeal(mData.key, conn, usr_info.imgname)
        }
        else
            joiners.getUsrImg(mData.value).then(function(res){
                sendEndDeal(mData.key, conn, res)
            }).catch(function(err){
                if(err)
                    sendEndDeal(mData.key, conn, err)
            })
    }).catch(function(err){
        if(err) {
            sendEndDeal(mData.key, conn, 'failed')
            joiners.appOptErr(err, 'reqGetUsrImg.redis.getUsrField', 'empty')
        }
    })
}
function redisStoreAfterFail(serr, mData, data){
    if(!data && tmp_weathdata[mData.value.localkey])
        data=tmp_weathdata[mData.value.localkey].data
    if(!data)
        return
    data[mData.value.type]-=mData.value.count
    if(data[mData.value.type]<=0){
        delete data[mData.value.type]
        if(JSON.stringify(data) == "{}") {
            redis.deleteHmData('people:data', [`wealth:${mData.value.localkey}`]).then(function () {
            }).catch(function (err) {
                if (err)
                    joiners.appOptErr(err + '_redis.deleteHmData', mData.value.localkey, mData.value.count)
            })
            return
        }
    }
    var after_data = JSON.stringify(data)
    redis.storeUsrHash('people:data', [`wealth:${mData.value.localkey}`, after_data]).then(function () {}).catch(function (err) {
        if (err)
            joiners.appOptErr(err + serr, `wealth:${mData.value.localkey}`, after_data)
    })
}
function reqPayment(mData, conn){
    redis.getUsrField('people:data', `wealth:${mData.value.localkey}`).then(function(f_res){
        var data={}, openid = mData.value.openid
            , pay_good = payprocess.helicalGoods(mData.value.type, mData.value.price)
            , local_order = payprocess.helicalOrder(mData.value.type, mData.value.stime)
        if(f_res)
            data=JSON.parse(f_res)
        if(data[mData.value.type])
            data[mData.value.type] += mData.value.count
        else
            data[mData.value.type]=mData.value.count
        var d_store=JSON.stringify(data)
        redis.storeUsrHash('people:data', [`wealth:${mData.value.localkey}`, d_store]).then(function () {
            tmp_weathdata[mData.value.localkey]={}
            tmp_weathdata[mData.value.localkey].data=data
            if(mData.value.type=='goods')
                return sendEndDeal(mData.key, conn, 'success')
            payprocess.options(openid, local_order, pay_good, mData.value.price, function(res_opt){
                if(res_opt){
                    request(res_opt.value, function(error, response, body){
                        if (!error && response.statusCode == 200) {
                            var xmlparser = new xml2js.Parser({explicitArray : false, ignoreAttrs : true})
                            xmlparser.parseString(body, function (err, result) {
                                if(err || !result.xml.prepay_id){
                                    redisStoreAfterFail('_payprocess.genSecondsSign.redis.storeUsrHash', mData, data)
                                    return sendEndDeal(mData.key, conn, 'pay fail')
                                }
                                var payid = result.xml.prepay_id, currentsecs = Math.round(mData.value.stime/1000)
                                payprocess.genSecondsSign(payid, currentsecs, function(getsign){
                                    if(getsign)
                                        sendEndDeal(mData.key, conn, {
                                            timeStamp: currentsecs,
                                            nonceStr: getsign.random,
                                            package: payid,
                                            paySign: getsign.sign
                                        })
                                    else {
                                        sendEndDeal(mData.key, conn, 'pay fail')
                                        joiners.appOptErr('payprocess.genSecondsSign', 'empty', 'empty')
                                        redisStoreAfterFail('_payprocess.genSecondsSign.redis.storeUsrHash', mData, data)
                                    }
                                })
                            })
                        }
                        else {
                            sendEndDeal(mData.key, conn, 'pay fail')
                            joiners.appOptErr(`${error}||${response.statusCode}`, 'reqPayment.request', 'empty')
                            redisStoreAfterFail('_request.redis.storeUsrHash', mData, data)
                        }
                    })
                }
                else {
                    sendEndDeal(mData.key, conn, 'pay fail')
                    joiners.appOptErr(res_opt.value, 'payprocess.options', 'empty')
                    redisStoreAfterFail('_payprocess.options.redis.storeUsrHash', mData, data)
                }
            })
        }).catch(function (err) {
            if (err) {
                sendEndDeal(mData.key, conn, 'pay fail')
                joiners.appOptErr(err+(mData.value.type=='goods' ? '_reqPayment.redis.storeUsrHash' : ''), (mData.value.type=='goods' ? mData.value.count : 'reqPayment.redis.storeUsrHash'), 'empty')
            }
        })
    }).catch(function(err){
        if(err) {
            sendEndDeal(mData.key, conn, 'pay fail')
            joiners.appOptErr(err, 'reqPayment.redis.getUsrField', 'empty')
        }
    })
}
function reqDelUnpayeds(mData, conn){
    redisStoreAfterFail('_reqDelUnpayeds', mData)
    sendEndDeal(mData.key, conn, 'reqDelUnpayeds')
}
function reqPayCustomer(mData, conn){
    payprocess.payCustomer(mData.value.openid, mData.value.seconds, mData.value.price, function(res_opt){
        if(res_opt){
            request(res_opt, function(error, response, body){
		console.log('request', body)
                if (!error && response.statusCode == 200) {
                    var xmlparser = new xml2js.Parser({explicitArray : false, ignoreAttrs : true})
                    xmlparser.parseString(body, function (err, result) {
			console.log(err, result)
                        if(err || result.xml.result_code=='FAIL'){
                            sendEndDeal(mData.key, conn, 'pay fail')
                            joiners.appOptErr(err + result.xml.result_code, 'reqPayCustomer.payCustomer.request.parse', 'empty')
                        }
                        else{
                            sendEndDeal(mData.key, conn, 'pay success')
                            var new_wealth = JSON.stringify(mData.value.wealth)
                            redis.storeUsrHash('people:data', [`wealth:${mData.value.localkey}`, new_wealth]).then(function () {}).catch(function (err) {
                                if (err)
                                    joiners.appOptErr(err+'_reqPayCustomer.redis.storeUsrHash', `wealth:${mData.value.localkey}`, new_wealth)
                            })
                        }
                    })
                }
                else {
                    sendEndDeal(mData.key, conn, 'pay fail')
                    joiners.appOptErr(`${error}||${response.statusCode}`, 'reqPayment.reqPayCustomer.request', 'empty')
                }
            })
        }
        else {
            sendEndDeal(mData.key, conn, 'pay fail')
            joiners.appOptErr('empty res', 'reqPayCustomer.payCustomer', 'empty')
        }
    })
}
function reqGetUsrData(mData, conn){
    if(typeof(mData.value.type) === 'string')
        redis.getUsrField('people:data', mData.value.type).then(function (data) {
            if (data)
                sendEndDeal(mData.key, conn, JSON.parse(data))
            else
                sendEndDeal(mData.key, conn, 'empty')
        }).catch(function (err) {
            if (err) {
                sendEndDeal(mData.key, conn, 'failed getUsrField')
                joiners.appOptErr(err, 'reqGetUsrData.redis.getUsrField', 'empty')
            }
        })
    else
        redis.getUsrFieldsValue('people:data', mData.value.type).then(function (usrs) {
            sendEndDeal(mData.key, conn, usrs)            
        }).catch(function (err) {
            if (err) {
                sendEndDeal(mData.key, conn, 'failed getUsrFieldsValue')
                joiners.appOptErr(err, 'reqGetUsrData.redis.getUsrFieldsValue', 'empty')
            }
        })
}
function reqGetUsrsData(mData, conn){
    function getdata(list){
        let maps = null
        if(typeof(mData.value.type) === 'string')
            maps = joiners.usrsArrMapProp(list, mData.value.type)
        else{
            let maps0 = joiners.usrsArrMapProp(list, mData.value.type[0]), maps1 = joiners.usrsArrMapProp(list, mData.value.type[1])
            maps = maps0.concat(maps1)
        }
        redis.getUsrFieldsValue('people:data', maps).then(function (usrs) {
            if (usrs.length) {
                if(mData.value.search=='time')
                    sendEndDeal(mData.key, conn, {lkarr: maps, data: usrs})
                else
                    sendEndDeal(mData.key, conn, {lkarr: maps, locations:list, data: usrs})
            }
            else
                sendEndDeal(mData.key, conn, 'empty')
        }).catch(function (err) {
            if (err) {
                sendEndDeal(mData.key, conn, 'failed')
                joiners.appOptErr(err, 'reqGetUsrsData.redis.getUsrFieldsValue', 'empty')
            }
        })
    }
    if(mData.value.search=='time') {
        redis.getListUsrs(mData.value.range).then(function (lks) {
            getdata(lks)
        }).catch(function (err) {
            if (err) {
                sendEndDeal(mData.key, conn, 'failed')
                joiners.appOptErr(err, 'reqGetUsrsData.redis.getListUsrs', 'empty')
            }
        })
    }
    else if(mData.value.search=='area')
        joiners.recurseGeoInfo(mData.value.lng, mData.value.lat).then(function(res){
            if(res.length)
                getdata(res)
            else
                sendEndDeal(mData.key, conn, 'empty')
        }).catch(function(err){
            if(err) {
                sendEndDeal(mData.key, conn, 'failed')
                joiners.appOptErr(err, 'reqGetUsrsData.joiners.recurseGeoInfo', 'empty')
            }
        })  
    else{
        let result = []
        redis.scanUsrHash('people:data', mData.value.field, result).then(function (data) {//upgrade after online
            if(mData.value.expert)
                redis.getUsrField('usr:property', mData.value.localkey).then(function (experts) {
                    sendEndDeal(mData.key, conn, {experts:experts, data:(data.length ? data : 'empty')})
                }).catch(function (err) {
                    if (err) {
                        sendEndDeal(mData.key, conn, 'failed')
                        joiners.appOptErr(err, 'reqGetUsrsData.redis.expert.getUsrField', 'empty')
                    }
                })
            else
                sendEndDeal(mData.key, conn, data.length ? data : 'empty')
        }).catch(function (err) {
            if (err) {
                sendEndDeal(mData.key, conn, 'failed')
                joiners.appOptErr(err, 'reqGetUsrsData.redis.scanUsrHash', 'empty')
            }
        })	
    }
}
function reqDelUsrData(mData, conn){
    function deleteMediaes(){
        redis.getUsrFieldsValue(`media:${mData.value.localkey}`, mData.value.dels).then( function (dres) {
            joiners.delUsrRelateds(mData.value.localkey, mData.value.dels, dres)
        }).catch(function(err){
            if(err)
                joiners.appOptErr(err, 'reqDelUsrData.redis.getUsrFieldsValue', JSON.stringify(mData.value.dels))
        })
    }
    function wealthrecover(){
        let wealth = JSON.stringify(mData.value.wealth)
        redis.storeUsrHash('people:data', [`wealth:${mData.value.localkey}`, wealth]).then(function () {}).catch(function (err) {
            if (err)
                joiners.appOptErr(err, 'reqDelUsrData.wealthrecover', `${mData.value.localkey}&${wealth}`)
        })
    }
    redis.getUsrField('people:data', mData.value.type).then(function (data) {
        var svs=JSON.parse(data)
        delete svs[mData.value.setime]
        if(Object.getOwnPropertyNames(svs).length==0)
            redis.deleteHmData('people:data', mData.value.type).then(function () {
                sendEndDeal(mData.key, conn, 'success')
		if(mData.value.wealth)
                    wealthrecover()
		if(mData.value.dels.length)
                    deleteMediaes()
		if(mData.value.old_answerings)
                    joiners.delOldanswerings(mData.value.localkey, undefined, mData.value.old_answerings).then(function(){}).catch(function(){})
		joiners.usruploadeletion(`${mData.value.setime}:${mData.value.localkey}`)
            }).catch(function (err) {
                if (err) {
                    sendEndDeal(mData.key, conn, 'failed')
                    joiners.appOptErr(err, 'reqDelUsrData.redis.deleteHmData', 'empty')
                }
            })
        else
            redis.storeUsrHash('people:data', [mData.value.type, JSON.stringify(svs)]).then(function () {
                sendEndDeal(mData.key, conn, 'success')
		if(mData.value.wealth)
                    wealthrecover()
		if(mData.value.dels.length)
                    deleteMediaes()
		joiners.usruploadeletion(`${mData.value.setime}:${mData.value.localkey}`)
            }).catch(function (err) {
                if (err) {
                    sendEndDeal(mData.key, conn, 'failed')
                    joiners.appOptErr(err, 'reqDelUsrData.redis.storeUsrHash', 'empty')
                }
            })
    }).catch(function (err) {
        if (err) {
            sendEndDeal(mData.key, conn, 'failed')
            joiners.appOptErr(err, 'reqDelUsrData.redis.getUsrField', 'empty')
        }
    })
}
function reqGetCommunicators(mData, conn){
    if(mData.value.details=='prfan') {
	if(mData.value.init)
            joiners.roomsViewersJoin(mData.value.owner, mData.value.owner, conn)
        if(mData.value.done)
            return sendEndDeal(mData.key, conn, 'success')
        redis.getUsrField('usr:property', mData.value.owner).then(function (res) {
            sendEndDeal(mData.key, conn, {localkey:mData.value.owner, data:res})
        }).catch(function (err) {
            if (err) {
                sendEndDeal(mData.key, conn, 'failed')
                joiners.appOptErr(err, 'reqGetCommunicators.redis.getUsrField', 'empty')
            }
        })
    }
    else
        redis.getUsrSet(mData.value.owner).then(function (sets) {
            if (sets.length) {
                if(mData.value.details){
                    let maped_sets = joiners.usrsArrMapProp(sets, mData.value.details, mData.value.owner), gets=[]
                    if(mData.value.details=='communicate')
                        joiners.recurseHmGet(maped_sets, gets).then(function (res) {
                            sendEndDeal(mData.key, conn, {localkeys:sets, details:res})
                        }).catch(function (err) {
                            if (err)
                                sendEndDeal(mData.key, conn, 'failed')
                        })
                    else {
			let owner = mData.value.owner.split(':')[1]
                        if(!mData.value.owner.match(mData.value.localkey))
                            maped_sets.push(owner)
                        redis.getUsrFieldsValue('usr:property', maped_sets).then(function (res) {
                            let back_info = {localkeys: maped_sets, details: res}
                            if (mData.value.openroom) {
                                joiners.roomsViewersJoin(mData.value.localkey, owner, conn)
                                let onlines = joiners.checkRoomMembers(owner), o_sendings = []
                                back_info.onlines = onlines.map(function (onliner) {
                                    let whose = Object.getOwnPropertyNames(onliner)[0]
                                    if(whose != mData.value.localkey)
                                        o_sendings.push(onliner[whose].client)
                                    return whose
                                })
                                if (o_sendings.length) {
                                    back_info.chairs = joiners.chkRoomChairs(o_sendings)
                                    emitEndDeal('broadcast', {
                                        localkey: mData.value.localkey,
                                        openroom: true
                                    }, o_sendings)
                                }
                            }
                            sendEndDeal(mData.key, conn, back_info)
                            if (mData.value.owner.viewer) {
                                let viewer = sets.filter(function (item) {
                                    if (item.match(mData.value.owner.viewer))
                                        return item
                                })
                                if (!viewer.length)
                                    redis.storeUsrSet(mData.value.owner, mData.value.owner.viewer).then(function () {
                                    }).catch(function (err) {
                                        if (err)
                                            joiners.appOptErr(err + '_reqGetCommunicators.redis.storeUsrSet', mData.value.owner, `${mData.value.owner.viewer}&view`)
                                    })
                            }
                        }).catch(function (err) {
                            if (err) {
                                sendEndDeal(mData.key, conn, 'failed')
                                joiners.appOptErr(err, 'reqGetCommunicators.redis.getUsrFieldsValue', 'empty')
                            }
                        })
                    }
                }
                else
                    sendEndDeal(mData.key, conn, sets)
            }
            else
                sendEndDeal(mData.key, conn, 'empty')
        }).catch(function (err) {
            if (err) {
                sendEndDeal(mData.key, conn, 'failed')
                joiners.appOptErr(err, 'reqGetCommunicators.redis.getUsrSet', 'empty')
            }
        })
}
function reqGetCommunicatorImg(mData, conn){
    redis.getUsrField('usr:property', mData.value.communicator).then(function(res){
        if(res){
            let usr_info = JSON.parse(res), send_info = mData.value.whose!==undefined ? {whose:mData.value.whose, img:usr_info.imgname} : usr_info.imgname
            sendEndDeal(mData.key, conn, send_info)
        }
        else
            sendEndDeal(mData.key, conn, mData.value.whose!==undefined ? {whose:mData.value.whose, img:'empty'} : 'empty')
    }).catch(function(err){
        if(err){
            sendEndDeal(mData.key, conn, 'failed')
            joiners.appOptErr(err, 'reqGetCommunicatorImg.redis.getUsrsSet', 'empty')
        }
    })
}
function reqGetUsrGeo(mData, conn){
    redis.getlocation(mData.value.owners).then(function(res){
        sendEndDeal(mData.key, conn, res)
    }).catch(function(err){
        if(err){
            sendEndDeal(mData.key, conn, 'failed')
            joiners.appOptErr(err, 'reqGetInfoByGeo.redis.getlocation', 'empty')
        }
    })
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
function reqUsrCommunication(mData, conn){
   if(mData.value.experts) {
        if(mData.value.talks)
            redis.getUsrField('usr:property', mData.value.localkey).then(function (usr) {
                let obj_usr = JSON.parse(usr), talkto = mData.value.owner
                if(obj_usr.experts && obj_usr.experts[talkto]) {
                    if (!obj_usr.experts[talkto].talks)
                        obj_usr.experts[talkto].talks = mData.value.talks
                    else {
                        let time = Object.getOwnPropertyNames(mData.value.talks)[0]
                        obj_usr.experts[talkto].talks[time] = mData.value.talks[time]
                    }
                }
                else{
                    if(!obj_usr.fans[talkto].talks)
                        obj_usr.fans[talkto].talks = mData.value.talks
                    else {
                        let time = Object.getOwnPropertyNames(mData.value.talks)[0]
                        obj_usr.fans[talkto].talks[time] = mData.value.talks[time]
                    }
                }
                redis.storeUsrHash('usr:property', [mData.value.localkey, JSON.stringify(obj_usr)]).then(function () {
                    if(joiners.checkRoomOwner(talkto)){
                        let to_client = joiners.checkRoomOwner(talkto).client
                        emitEndDeal('broadcast', {localkey: mData.value.localkey, experts: 'talks', talks: mData.value.talks}, [to_client], function (remit) {
                            if (remit != 'success')
                                joiners.appOptErr(remit, 'reqUsrCommunication.experts.talks.emitEndDeal', 'empty')
                        })
                    }
                    sendEndDeal(mData.key, conn, {localkey: mData.value.localkey, experts:'talks', talks: mData.value.talks, res:'success'})
                }).catch(function (err) {
                    if (err) {
                        sendEndDeal(mData.key, conn, 'failed')
                        joiners.appOptErr(err, 'reqUsrCommunication.experts.talks.redis.getUsrField.storeUsrHash', 'empty')
                    }
                })
            }).catch(function (err) {
                if (err) {
                    sendEndDeal(mData.key, conn, 'failed')
                    joiners.appOptErr(err, 'reqUsrCommunication.experts.talks.redis.getUsrField', 'empty')
                }
            })
        else {
            if(mData.value.experts=='done')
                redis.getUsrFieldsValue('usr:property', [mData.value.expert.localkey, mData.value.localkey]).then(function (usrs) {
                    usrs = usrs.map(function (usr, index) {
                        let obj_usr = JSON.parse(usr)
                        if (index == 0) {
                            if (mData.value.expert.del) {
                                delete obj_usr.fans[mData.value.localkey]
                                if (JSON.stringify(obj_usr.fans) == '{}')
                                    delete obj_usr.fans
                            } else {
                                if (!obj_usr.fans)
                                    obj_usr.fans = {}
                                obj_usr.fans[mData.value.localkey] = {time: mData.value.expert.time}
                            }
                        } else {
                            if (mData.value.expert.del) {
                                delete obj_usr.experts[mData.value.expert.localkey]
                                if (JSON.stringify(obj_usr.experts) == '{}')
                                    delete obj_usr.experts
                            } else {
                                if (!obj_usr.experts)
                                    obj_usr.experts = {}
                                obj_usr.experts[mData.value.expert.localkey] = {time: mData.value.expert.time}
                            }
                        }
                        return obj_usr
                    })
                    redis.storeUsrHash('usr:property', [mData.value.expert.localkey, JSON.stringify(usrs[0]), mData.value.localkey, JSON.stringify(usrs[1])]).then(function () {
                        sendEndDeal(mData.key, conn, 'success')
                    }).catch(function (err) {
                        if (err) {
                            sendEndDeal(mData.key, conn, 'failed')
                            joiners.appOptErr(err, 'reqUsrCommunication.expert.redis.getUsrFieldsValue.storeUsrHash', 'empty')
                        }
                    })
                }).catch(function (err) {
                    if (err) {
                        sendEndDeal(mData.key, conn, 'failed')
                        joiners.appOptErr(err, 'reqUsrCommunication.experts.done.redis.getUsrFieldsValue', 'empty')
                    }
                })
            else
                redis.getUsrFieldsValue('usr:property', mData.value.experts).then(function (usrs) {
                    let mapeds = []
                    usrs.forEach(function (usr, index) {
                        let obj_usr = JSON.parse(usr)
                        if(index == mData.value.experts.length-1){
                            if(mData.value.dels[index].experts) {
                                if(JSON.stringify(mData.value.dels[1].experts) == '{}')
                                    delete obj_usr.experts
                                else
                                    obj_usr.experts = mData.value.dels[1].experts
                            }
                            if(mData.value.dels[index].fans) {
                                if(JSON.stringify(mData.value.dels[1].fans) == '{}')
                                    delete obj_usr.fans
                                else
                                    obj_usr.fans = mData.value.dels[1].fans
                            }
                        }
                        else {
                            if (obj_usr.experts && obj_usr.experts[mData.value.dels[0]]) {
                                delete obj_usr.experts[mData.value.dels[0]]
                                if(JSON.stringify(obj_usr.experts) == '{}')
                                    delete obj_usr.experts
                            }
                            if (obj_usr.fans && obj_usr.fans[mData.value.dels[0]]) {
                                delete obj_usr.fans[mData.value.dels[0]]
                                if(JSON.stringify(obj_usr.fans) == '{}')
                                    delete obj_usr.fans
                            }
                        }
                        mapeds = mapeds.concat([mData.value.experts[index], JSON.stringify(obj_usr)])
                    })
                    redis.storeUsrHash('usr:property', mapeds).then(function () {
                        sendEndDeal(mData.key, conn, 'success')
			joiners.roomerLeaveEvent(mData.value.localkey)
                    }).catch(function (err) {
                        if (err) {
                            sendEndDeal(mData.key, conn, 'failed')
                            joiners.appOptErr(err, 'reqUsrCommunication.experts.redis.getUsrFieldsValue.storeUsrHash', 'empty')
                        }
                    })
                }).catch(function (err) {
                    if (err) {
                        sendEndDeal(mData.key, conn, 'failed')
                        joiners.appOptErr(err, 'reqUsrCommunication.experts.redis.getUsrFieldsValue', 'empty')
                    }
                })
        }
    }
    else {
        if(mData.value.onchair!==undefined){
            let onliners = joiners.checkRoomMembers(mData.value.owner), o_sendings = []
            onliners.forEach(function(roomer){
                let whose = Object.getOwnPropertyNames(roomer)[0]
                if(whose != mData.value.localkey)
                    o_sendings.push(roomer[whose].client)
            })
            if(o_sendings.length)
                emitEndDeal('broadcast', {localkey: mData.value.localkey, chair:mData.value.onchair}, o_sendings)
        }
        if(mData.value.contents && mData.value.contents.talks) {
	    let databasor = mData.value.owner.match(mData.value.localkey) ? mData.value.communicator : mData.value.localkey
            redis.getUsrField(`communicate:${databasor}`, mData.value.owner).then(function (contents) {
                let obj = contents ? JSON.parse(contents) : {}, saved = obj.talks ? obj.talks : null
                if(saved) {
                    let send_time = Object.getOwnPropertyNames(mData.value.contents.talks)[0]
                    saved[send_time] = mData.value.contents.talks[send_time]
                }
                else
                    saved = mData.value.contents.talks
                obj.talks = saved
                redis.storeUsrHash(`communicate:${databasor}`, [mData.value.owner, JSON.stringify(obj)]).then(function () {
                    let to_owner = joiners.talkToRoomer(mData.value.communicator)
                    if(to_owner)
                        emitEndDeal('broadcast', {
                            localkey: mData.value.localkey,
                            contents: mData.value.contents.talks
                        }, [to_owner], function (remit) {
                            if (remit != 'success')
                                joiners.appOptErr(remit, 'reqUsrCommunication.talks.emitEndDeal', `${mData.value.owner}${mData.value.localkey}${JSON.stringify(saved)}`)
                        })
                    sendEndDeal(mData.key, conn, {localkey: mData.value.localkey, talks: mData.value.contents.talks, res:'success'})
                }).catch(function (err) {
                    if (err) {
                        sendEndDeal(mData.key, conn, 'failed')
                        joiners.appOptErr(err, 'reqUsrCommunication.redis.storeUsrHash', `${mData.value.owner}${mData.value.localkey}${JSON.stringify(saved)}`)
                    }
                })
            }).catch(function (err) {
                if (err) {
                    sendEndDeal(mData.key, conn, 'failed')
                    joiners.appOptErr(err, 'reqUsrCommunication.redis.getUsrField', `${mData.value.owner}${mData.value.localkey}talks`)
                }
            })
	}
        else{
             if(mData.value.clicks) {
                sendEndDeal(mData.key, conn, 'success')
                redis.getDestSheets('[1]*').then(function (locs) {
                    if (locs.length) {
                        let sheets = locs.join(','), old_sets = [], new_sets = []
                        for (let i = mData.value.clicks.length - 1; i > -1; i--) {
                            if (!sheets.match(mData.value.clicks[i]))
                                new_sets.push({sheet: mData.value.clicks[i], localkey: mData.value.localkey})
                            else
                                old_sets.push({
                                    match: true,
                                    sheet: mData.value.clicks[i],
                                    localkey: mData.value.localkey
                                })
                        }
                        joiners.recurSettingSet(new_sets.concat(old_sets)).then(function () {}).catch(function () {})
                    } else {
                        mData.value.clicks = mData.value.clicks.map(function (click) {
                            return {sheet: click, localkey: mData.value.localkey}
                        })
                        joiners.recurSettingSet(mData.value.clicks).then(function () {}).catch(function () {})
                    }
                }).catch(function (err) {
                    if (err)
                        joiners.appOptErr(err, 'reqUsrCommunication.redis.getUsrSet', `${mData.value.owner} ${mData.value.localkey} ${mData.value.contents}`)
                })
            }
            else{
                let left_prop = mData.value.contents.prop.match('tip') ? mData.value.contents.prop.split('#')[0] : mData.value.contents.prop
                function removeSetsMember(r_str){
                    redis.removeSetMember(mData.value.owner, r_str).then(function () {}).catch(function (err) {
                        if (err) 
                            joiners.appOptErr(err, 'reqUsrCommunication.redis.removeSetMember', `${mData.value.owner} ${mData.value.localkey} ${r_str}`)
                    })
                }
                function setsStore(){
                    redis.getUsrSet(mData.value.owner).then(function (locs) {
                        let localkey = '', old_loc = ''
                        if (locs.length) {
                            for (let i = 0; i < locs.length; i++) {
                                if (locs[i].match(mData.value.localkey)) {
                                    localkey = locs[i]
                                    old_loc = locs[i]
                                    break
                                }
                            }
                            if (localkey) {
                                if(!localkey.match(left_prop)){
                                    if(left_prop=='tip')
                                        localkey += '&' + mData.value.contents.prop
                                    else
                                        localkey += '&' + left_prop
                                }
                                else if(mData.value.contents.prop.match('withdraw'))
                                    localkey = localkey.replace(/&tip(.*?)!/, '')
                            }
                        }
			if (!localkey)
                            localkey = mData.value.localkey + '&' + left_prop
                        redis.storeUsrSet(mData.value.owner, localkey).then(function (){
                            if(left_prop == 'tip')
                                sendEndDeal(mData.key, conn, 'success')
                            if (old_loc && old_loc != localkey)
                                removeSetsMember(old_loc)
                        }).catch(function (err) {
                            if (err) {
                                if(left_prop=='tip')
                                    sendEndDeal(mData.key, conn, 'failed')
                                joiners.appOptErr(err, 'reqUsrCommunication.redis.storeUsrSet', `${mData.value.owner} ${mData.value.localkey} ${localkey}`)
                            }
                        })
                    }).catch(function (err) {
			if (err) {
                            if(left_prop=='tip')
                                sendEndDeal(mData.key, conn, 'failed')
                            joiners.appOptErr(err, 'reqUsrCommunication.redis.getUsrSet', `${mData.value.owner} ${mData.value.localkey} ${mData.value.contents}`)
                        }
                    })
                }
                if(left_prop == 'tip')
                    setsStore()
                else
                    redis.getUsrField(`communicate:${mData.value.localkey}`, mData.value.owner).then(function (contents) {//check and promote for set init
                        let obj_contents = null
                        if (contents) {
                            obj_contents = JSON.parse(contents)
                            if (obj_contents[left_prop])
                                obj_contents[left_prop][mData.value.contents.time] = mData.value.contents[left_prop][mData.value.contents.time]
                            else
                                obj_contents[left_prop] = mData.value.contents[left_prop]
                        } else {
                            delete mData.value.contents.prop
                            delete mData.value.contents.time
                            obj_contents = mData.value.contents
                        }
                        redis.storeUsrHash(`communicate:${mData.value.localkey}`, [mData.value.owner, JSON.stringify(obj_contents)]).then(function () {
                            sendEndDeal(mData.key, conn, 'success')
                            setsStore()
                        }).catch(function (err) {
                            if (err) {
                                sendEndDeal(mData.key, conn, 'failed')
                                joiners.appOptErr(err, 'reqUsrCommunication.redis.getUsrField.storeUsrHash', `${mData.value.owner}${mData.value.localkey}`)
                            }
                        })
                    }).catch(function (err) {
                        if (err) {
                            sendEndDeal(mData.key, conn, 'failed')
                            joiners.appOptErr(err, 'reqUsrCommunication.redis.getUsrField', `${mData.value.owner}${mData.value.localkey}`)
                        }
                    })
            }
        }
    } 
}
function reqGetCommunications(mData, conn){
    if(mData.value.owners=='*')
        redis.getUsrFields(`communicate:${mData.value.communicator}`).then(function (owners) {
            if(owners && owners.length){
                if(mData.value.preview){
                    let fields = joiners.usrsArrMapProps(owners, mData.value.types)
                    redis.getUsrFieldsValue('people:data', fields).then(function (data) {
                        if(mData.value.expert)
                            redis.getUsrField('usr:property', mData.value.communicator).then(function (experts) {
                                sendEndDeal(mData.key, conn, {previews:owners, experts:experts, fields:fields, data:data})
                            }).catch(function (err) {
                                if (err) {
                                    sendEndDeal(mData.key, conn, 'failed')
                                    joiners.appOptErr(err, 'reqGetCommunications.redis.expert.getUsrField', 'empty')
                                }
                            })
                        else
                            sendEndDeal(mData.key, conn, {previews:owners, fields:fields, data:data})
                    }).catch(function (err) {
                        if (err) {
                            sendEndDeal(mData.key, conn, 'failed')
                            joiners.appOptErr(err, 'reqGetCommunications.redis.getUsrFieldsValue.preview', 'empty')
                        }
                    })
                }
                else {
                    let maps = joiners.usrsArrMapProps(owners, mData.value.types)
                    redis.getUsrFieldsValue('people:data', maps).then(function (usrs) {
                        sendEndDeal(mData.key, conn, {owners: owners, lkarr: maps, data: usrs})
                    }).catch(function (err) {
                        if (err) {
                            sendEndDeal(mData.key, conn, 'failed')
                            joiners.appOptErr(err, 'reqGetCommunications.redis.getUsrFields.getUsrFieldsValue', 'empty')
                        }
                    })
                }
            }
            else
                sendEndDeal(mData.key, conn, 'empty')
        }).catch(function (err) {
            if (err) {
                sendEndDeal(mData.key, conn, 'failed')
                joiners.appOptErr(err, 'reqGetCommunications.redis.getUsrFields', 'empty')
            }
        })
    else if(mData.value.communicator=='*')
        redis.getUsrSet(mData.value.owners).then(function (communicators) {
            sendEndDeal(mData.key, conn, communicators)
        }).catch(function (err) {
            if (err) {
                sendEndDeal(mData.key, conn, 'failed')
                joiners.appOptErr(err, 'reqGetCommunications.redis.getUsrSet', 'empty')
            }
        })
    else if(mData.value.communicators) {
        let gets = []
        joiners.recurseHmGet(mData.value.communicators, gets).then(function (res) {
            sendEndDeal(mData.key, conn, res)
        }).catch(function (err) {
            if (err)
                sendEndDeal(mData.key, conn, 'failed')
        })
    }
    else {
        let getor = '', owner = mData.value.owners.split(':')[1], chairor = null
        if (mData.value.onchair!==undefined && mData.value.onchair!='owner') {
            if(mData.value.communicator==owner) {
                chairor = joiners.chkRoomChair(mData.value.communicator, mData.value.onchair)
                if(!chairor)
                    return sendEndDeal(mData.key, conn, {chair: mData.value.onchair, res: 'chairing'})
                getor = Object.getOwnPropertyNames(chairor)[0]
            }
            else {
                if (joiners.takeRoomChair(mData.value.communicator, mData.value.onchair))
                    getor = mData.value.communicator
                else
                    return sendEndDeal(mData.key, conn, {chair: mData.value.onchair, res: 'chaired'})
            }
        }
        else
            getor = mData.value.communicator
	console.log(getor)
        redis.getUsrFieldsValue(`communicate:${getor}`, mData.value.owners).then(function (communications) {
            if(mData.value.onchair!==undefined && mData.value.onchair!='owner' && mData.value.communicator!=owner){
                let onlines = joiners.checkRoomMembers(owner), o_sendings = []
                onlines.forEach(function(onliner){
                    let whose = Object.getOwnPropertyNames(onliner)[0]
                    if(whose != getor)
                        o_sendings.push(onliner[whose].client)
                })
                if (o_sendings.length)
                    emitEndDeal('broadcast', {localkey: getor, onchair: mData.value.onchair}, o_sendings)
            }
            if(chairor){
                let c_client = chairor[getor].client
                redis.getUsrField('usr:property', owner).then(function (usr) {
                    emitEndDeal('broadcast', {localkey: owner, prop:usr, onchair: mData.value.onchair}, [c_client])
                }).catch(function (err) {
                    if (err)
                        joiners.appOptErr(err, 'reqGetCommunications.getUsrFieldsValue.chairor.redis.getUsrField', 'empty')
                })
                sendEndDeal(mData.key, conn, {localkey: getor, onchair: mData.value.onchair, communications:communications})
            }
            else
                sendEndDeal(mData.key, conn, communications)
            let deling = false
            if (communications[0] && communications[0] == '{}') {
                deling = true
                communications[0] = null
            }
            if (deling)
                redis.deleteHmData(`communicate:${mData.value.communicator}`, mData.value.owners).then(function () {
                }).catch(function (err) {
                    if (err)
                        joiners.appOptErr(err + '_reqGetCommunications.redis.deleteHmData', `communicate:${mData.value.communicator}`, mData.value.owners)
                })
        }).catch(function (err) {
            if (err) {
                sendEndDeal(mData.key, conn, 'failed')
                joiners.appOptErr(err, 'reqGetCommunications.redis.getUsrFieldsValue', 'empty')
            }
        })
    } 
}
function reqUsrsCommunication(mData, conn){
    if(mData.value.exwealth) {
        let fans = Object.getOwnPropertyNames(mData.value.fans)
        redis.getUsrFieldsValue('usr:property', fans).then(function (usrs) {
            let keys = []
            usrs=usrs.map(function(fan, index){
                let obj_usr = JSON.parse(fan)
                obj_usr.exwealth = mData.value.fans[fans[index]]
                keys.push('usr:property')
                return {field:fans[index], value:obj_usr}
            })
            sendEndDeal(mData.key, conn, 'success')
            joiners.recurseHmSet(keys, usrs)
        }).catch(function (err) {
            if (err) {
                sendEndDeal(mData.key, conn, 'failed')
                joiners.appOptErr(err, 'reqUsrsCommunication.redis.getUsrFieldsValue', 'empty')
            }
        })
    }
    else {
        sendEndDeal(mData.key, conn, 'success')
        joiners.recurseHmSet(mData.value.keys, mData.value.values)
    }
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
function reqUsrLeaveChair(mData, conn){
    let owner = mData.value.owner, taker = mData.value.localkey, members = joiners.checkRoomMembers(owner), o_sendings = []
    members.forEach(function(member){
        let whose = Object.getOwnPropertyNames(member)[0]
        if(whose != taker)
            o_sendings.push(member[whose].client)
    })
    if(o_sendings.length)
        emitEndDeal('broadcast', {
            localkey: taker,
            leaveChair: mData.value.chair
        }, o_sendings, function (remit) {
            if (remit != 'success')
                joiners.appOptErr(remit, 'reqUsrLeaveChair.emitEndDeal', `${mData.value.owner},${mData.value.localkey},chair,${mData.value.chair}`)
        })
    joiners.removeTakerChair(taker)
}
function reqRestart(conn){
    conn.removeAllListeners('message')
    conn.removeAllListeners('close')
    conn.removeAllListeners('error')
    conn.terminate()
    joiners.appOptErr('restart', 'app.conn.on(restart)', 'pm2 restart wscsrv')
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
    //var location = url.parse(socket.upgradeReq.url, true)
    socket.on('message', function(message) {
        console.log(message)
        var mData = JSON.parse(message)
        if(mData.key == 'sessionKey')
            reqSessionKey(mData, socket)
        else if(mData.key == 'submitInfo')
            reqSubmitInfo(mData, socket)
        else if(mData.key == 'wealthtrans')
            reqUsrWealthTransfer(mData, socket)
        else if(mData.key == 'getUsrImg')
            reqGetUsrImg(mData, socket)
        else if(mData.key == 'payRequest') 
            reqPayment(mData, socket)
	else if(mData.key == 'delUnpayeds')
            reqDelUnpayeds(mData, socket)
        else if(mData.key == 'payCustomer')
            reqPayCustomer(mData, socket)
	else if(mData.key == 'getUsrData')
            reqGetUsrData(mData, socket)
        else if(mData.key == 'getUsrsData')
            reqGetUsrsData(mData, socket)
        else if(mData.key == 'delUsrData')
            reqDelUsrData(mData, socket)
        else if(mData.key == 'getcommunicators')
            reqGetCommunicators(mData, socket)
        else if(mData.key == 'getCommunicatorImg')
            reqGetCommunicatorImg(mData, socket)
        else if(mData.key == 'getusrgeo')
            reqGetUsrGeo(mData, socket)
        else if(mData.key == 'updategrps')
            reqGroupUpdate(mData, socket)
        else if(mData.key == 'communications')
            reqUsrCommunication(mData, socket)
	else if(mData.key == 'usrscommunications')
            reqUsrsCommunication(mData, socket)
        else if(mData.key == 'getCommunications')
            reqGetCommunications(mData, socket)
        else if(mData.key == 'mastergets')
            reqMasterGets(mData, socket)
        else if(mData.key == 'masterdels')
            reqMasterDels(mData, socket)
        else if(mData.key == 'leavechair')
            reqUsrLeaveChair(mData, socket)
        else if(mData.key == 'restart')
            reqRestart(socket)
        else if(mData.key == 'closing') {
	    let onliners = joiners.checkRoomMembers(mData.value.owner), o_sendings = []
            onliners.forEach(function(roomer){
                let whose = Object.getOwnPropertyNames(roomer)[0]
                if(whose != mData.value.localkey)
                    o_sendings.push(roomer[whose].client)
            })
            if(o_sendings.length)
                emitEndDeal('broadcast', {localkey: mData.value.localkey, leaveroom: true}, o_sendings, function (res) {
                    sendEndDeal(mData.key, socket, 'joiner deleted')
                    if (res != 'success')
                        joiners.appOptErr(res, mData.value.localkey, 'broadcast for closing failed')
                })
            else
                sendEndDeal(mData.key, socket, 'joiner deleted')            
            joiners.roomerLeaveEvent(mData.value.localkey)
        }
    })
    socket.on('error', function() {
        console.log('socket error')
        socket.removeAllListeners('error')
        joiners.appOptErr(null, null, Array.prototype.join.call(arguments, ", "), 'app.conn.on(error)', 'all_table', 'null', 'null')
    })
    socket.on('disconnect', function() {
        console.log('disconnect')
        closeAction(socket)
    })
}
module.exports = {
    connfunction:connfunction
}
