 //clients.js
 'use strict'
var roomsViewers={}
const co = require('co')
const mysql = require('../../../databases/mysqldata.js')
const redis = require('../../../databases/rediscache.js')
const shell = require('./shell.js')

function isArrayFn(value){
    if (typeof Array.isArray === "function")
        return Array.isArray(value)
    else
        return Object.prototype.toString.call(value) === "[object Array]"
}
function roomsViewersJoin(joiner, owner, client) {
    roomsViewers[joiner]={owner:owner, client:client}
}
function takeRoomChair(joiner, chair) {
    let member = roomsViewers[joiner], o_members = checkRoomMembers(member.owner)
    let chaired = o_members.filter(function(member){
        let o_mem = Object.getOwnPropertyNames(member)[0]
        if(member[o_mem].chair!==undefined && member[o_mem].chair==chair)
            return member
    })
    if(chaired.length)
        return false
    roomsViewers[joiner].chair = chair
    return true
}
function removeTakerChair(taker) {
    delete roomsViewers[taker].chair
}
function chkRoomChairs(onliners) {
    return onliners.filter(function(member){
        if(roomsViewers[member] && roomsViewers[member].chair!==undefined)
            return member
    })
}
function chkRoomChair(owner, chair) {
    let o_members = checkRoomMembers(owner)
    let chaired = o_members.filter(function(member){
        let o_mem = Object.getOwnPropertyNames(member)[0]
        if(member[o_mem].chair!==undefined && member[o_mem].chair==chair)
            return member
    })
    if(chaired.length)
        return chaired[0]
    return null
}
function checkRoomOwner(owner) {
    return roomsViewers[owner]
}
function checkRoomMembers(owner) {
    let members = Object.getOwnPropertyNames(roomsViewers), m_clients = []
    for(let i=0; i<members.length; i++){
        if(roomsViewers[members[i]].owner == owner)
            m_clients.push({[members[i]]:roomsViewers[members[i]]})
    }
    return m_clients   
}
function roomerLeaveEvent(localkey){
    delete roomsViewers[localkey]
}
function talkToRoomer(to) {
    if(roomsViewers[to])
        return roomsViewers[to].client
    return null
}
function getUsrImg(usr){
    return new Promise(function (resolve, reject){
        let sh_order = 'head -n 80 /dev/urandom | tr -dc A-Za-z0-9 | head -c 32'
            , options = {
            method: 'GET',
            url: usr.url,
            encoding: 'binary',
            headers:{'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:46.0) Gecko/20100101 Firefox/46.0'}
            }, property=JSON.stringify(usr)
         , http = require("http-request")
        shell.shellFunc(sh_order).then(function (result) {
            http.get(options, `/data/uploads/${result}`, function (err, res) {
                if (err){
                    reject('failed')
                    appOptErr(err, 'clients.getUsrImg.shell.shellFunc.http.get', result)
                }
                else {
                    delete usr.url
                    let localkey=usr.localkey
                    delete usr.localkey
                    usr.imgname = result
                    property = JSON.stringify(usr)
                    redis.storeUsrHash('usr:property', [localkey, property]).then(function () {
                        resolve(result)
                    }).catch(function (err) {
                        if (err) {
                            reject('failed')
                            appOptErr(err+'_clients.getUsrImg.redis.storeUsrHash', localkey, property)
                        }
                    })
                }
            })
        }).catch(function(err){
            if(err) {
                reject('failed')
                appOptErr(err, 'clients.getUsrImg.shell.shellFunc', property)
            }
        })
    })
}
function usrsArrMapProp(usrs, prop, owner){
    let is_arr=isArrayFn(usrs[0])
    return usrs.map(function(item){
        let key = item
        if(key.match('&'))
            key=key.split('&')[0]
        else if(is_arr)
            key=item[0]
        if(prop=='communicate')
            return {key:prop+':'+key, field:owner}
        else if(prop=='usr')
            return key
        return prop+':'+key
    })
}
function usrsArrMapProps(usrs, props){
    let is_arr=isArrayFn(usrs[0]), maps=[], lks=''
    let map=usrs.filter(function(usr){
        let key = is_arr ? usr[0] : usr.split(':')[1]
        if(key && !lks.match(key)) {
            lks += usr
            return usr
        }
    })
    props.forEach(function(item){
        let eusr=map.map(function(usr){
            return `${item}:${usr.split(':')[1]}`
        })
        maps=maps.concat(eusr)
    })
    return maps
}
function usrSharing(share_data){
    return new Promise(function (resolve, reject){
        const wxbdc = require('WXBizDataCrypt.js')
        let appId = 'wxf9a75ea1c3517fbe'
        try {
            let WXBizDataCrypt = new wxbdc.WXBizDataCrypt(appId, share_data.sessionKey), openGId = wxbdc.decryptData(share_data.encryptedData, share_data.iv)
            resolve(openGId)
        }
        catch(err) {
            if (err)
                reject(err)
        }
    })
}
function getUsrWealth(usr){
    return new Promise(function (resolve, reject){
         redis.getUsrField('people:data', `wealth:${usr}`).then(function(res){
             resolve(res)
         }).catch(function(err){
             if (err) {
                 reject('failed')
                 appOptErr(err, 'clients.getUsrWealth.redis.getUsrField', 'empty')
             }
         })
    })
}
function delUsrRelateds(localkey, dels, dres){
    return new Promise(function (resolve, reject){
        dres=dres.filter(function(nm){
            if(nm)
                return nm
        })
        let deletes = dres.length>1 ? dres.toString().replace(/\.(.*?),|,/g,' /data/uploads/').replace(/\.(.*?)$/, '') : dres[0].replace(/\.(.*?)$/, ''), sh_order = 'rm -rf '
        deletes = '/data/uploads/'+deletes
        sh_order+=deletes
        shell.shellFunc(sh_order).then(function () {
		console.log(localkey, dels, dres, sh_order)
            if(dels)
                redis.usrFieldsLen(`media:${localkey}`).then( function (res) {
                    if(res==dels.length)
                        redis.deleteCommKeys(`media:${localkey}`).then( function () {
                            resolve('success')
                        }).catch(function(err){
                            if(err) {
                                appOptErr(err + '_delUsrRelateds.redis.deleteCommKeys', res, `media:${localkey}`)
                                reject(err)
                            }
                        })
                    else
                        redis.deleteHmData(`media:${localkey}`, dels).then( function () {
                            resolve('success')
                        }).catch(function(err){
                            if(err) {
                                appOptErr(err + '_delUsrRelateds.redis.deleteHmData', res, `media:${localkey}`)
                                reject(err)
                            }
                        })
                }).catch(function(err){
                    if(err) {
                        appOptErr(err, 'delUsrRelateds.redis.usrFieldsLen', JSON.stringify(dels))
                        reject(err)
                    }
                })
            else
                resolve('success')
        }).catch(function (err) {
            if (err) {
                appOptErr(err, 'delUsrRelateds.shell.shellFunc', sh_order)
                reject(err)
            }
        })
    })
}
function delUsrsAnswerMedias(localkeys){
    return new Promise(function (resolve, reject){
        let localkey = localkeys.shift()
        delUsrRelateds(localkey.localkey, localkey.field, localkey.value).then(function(){
            if(localkeys.length)
                resolve(delUsrsAnswerMedias(localkeys))
            else
                resolve('success')
        }).catch(function(err){
            if(err) {
                appOptErr(err, 'joiners.delUsrsAnswerMedias', JSON.stringify(localkeys))
                reject(err)
            }
        })
    })
}
function delOldanswerings(localkey, update, old_answerings, c_passors){
    return new Promise(function (resolve, reject){
        let gets = [], answer_medias = [], cp_old_answerings = JSON.parse(JSON.stringify(old_answerings))
        function timesanswersChk(answering, times, del_medias, gate){
            times.forEach(function (time) {
                let multimedia = answering[time].multimedia
                if(gate !== undefined)
                    answering[time] = {[gate]: 'delete'}
                if (multimedia.length)
                    multimedia.forEach(function (media) {
                        let label = media.picture ? 'picture' : (media.sound_auth ? 'sound_auth' : (media.video ? 'video' : 'pdf')),
                            m_time = media[label].time ? media[label].time : media.time
                        del_medias.push(`${time}&${m_time}`)
                    })
            })
        }
        recurseHmGet(old_answerings, gets).then(function (res) {
            res=res.map(function(get, index){
                let contents = JSON.parse(get[0]), answering = contents.answering, passor = cp_old_answerings[index].key.split(':')[1], del_medias = []
                if(c_passors) {
                    let g_times = Object.getOwnPropertyNames(c_passors[passor])
                    g_times.forEach(function (gate) {
                        let times = c_passors[passor][gate]
                        timesanswersChk(answering, times, del_medias, gate)
                    })
                }
                else{
                    let g_times = Object.getOwnPropertyNames(answering)
                    timesanswersChk(answering, g_times, del_medias)
                    answering = 'delete'
                }
                if (del_medias.length)
                    answer_medias.push({key: `media:${passor}`, field: del_medias})
                return {key:cp_old_answerings[index].key, field:cp_old_answerings[index].field, value:contents}
            })
            recurseHmKeysSet(res).then(function () {
                if(update || answer_medias.length) {
                    if(update)
                        redis.getUsrFieldsValue(`media:${localkey}`, update).then(function (dres) {
                            resolve(dres)
                        }).catch(function (err) {
                            if (err) {
                                appOptErr(err, 'joiners.delOldanswerings.redis.recurseHmKeysSet.getUsrFieldsValue', 'empty')
                                reject(err)
                            }
                        })
                    else
                        resolve(null)
                    if(answer_medias.length){
                        let del_medias = [], all_dels = JSON.parse(JSON.stringify(answer_medias))
                        recurseHmGet(answer_medias, del_medias).then(function(ares){
                            all_dels=all_dels.map(function(passor, index){
                                return {localkey: passor.key.split(':')[1], field: passor.field, value:ares[index]}
                            })
                            delUsrsAnswerMedias(all_dels).then(function(){}).catch(function(){})
                        }).catch(function(err){
                            if(err) {
                                appOptErr(err, 'joiners.delOldanswerings.redis.recurseHmGet.answer_medias', JSON.stringify(answer_medias))
                                reject(err)
                            }
                        })
                    }
                }
                else
                    resolve(null)
            }).catch(function (err) {
                if (err)
                    reject(err)
            })
        }).catch(function (err) {
            if (err)
                reject(err)
        })
    })
}
function usruploadeletion(upload){
    redis.getUsrSet(upload).then(function (communicators) {
	if(!communicators || !communicators.length)
            return
        let comm_map = usrsArrMapProp(communicators, 'communicate', upload), cp_comms = JSON.parse(JSON.stringify(comm_map)), gets = []
        recurseHmGet(comm_map, gets).then(function (res) {
            let m_time = upload.split(':')[0]
            res=res.map(function(strs, index){
                let fields = strs[0].match(eval("/\\d{"+m_time.length+"}/g"))
                fields=fields.map(function(field){
                    return `${m_time}&${field}`
                })
                return {key:`media:${communicators[index].split('&')[0]}`, field:fields}
            })
	    let cp_res = JSON.parse(JSON.stringify(res))
            gets = []
            recurseHmGet(res, gets).then(function (ares) {
                let del_medias = []
                ares.forEach(function(arr){
                    del_medias = del_medias.concat(arr)
                })
                delUsrRelateds(undefined, undefined, del_medias).then(function(){
		    recurseHdel(cp_comms).then(function(){
                        recurseHdel(cp_res).then(function(){
                            redis.deleteCommKeys(upload).then(function(){}).catch(function(err){
                                if(err)
                                    appOptErr(err, 'clients.usruploadeletion.redis.recurseHmGet.recurseHmGet.delUsrRelateds.recurseHdel.recurseHdel.redis.deleteCommKeys', upload)
                            })
                        }).catch(function(err){
                            if(err)
                                appOptErr(err, 'clients.usruploadeletion.redis.recurseHmGet.recurseHmGet.delUsrRelateds.recurseHdel.recurseHdel', JSON.stringify(cp_res))
                        })
                    }).catch(function(err){
                        if(err)
                            appOptErr(err, 'clients.usruploadeletion.redis.recurseHmGet.recurseHmGet.delUsrRelateds.recurseHdel', JSON.stringify(comm_map))
                    })
		}).catch(function(err){
                    if(err)
                        appOptErr(err, 'clients.usruploadeletion.redis.recurseHmGet.recurseHmGet.delUsrRelateds', JSON.stringify(del_medias))
                })
            }).catch(function (err) {
                if (err)
                    appOptErr(err, 'clients.usruploadeletion.redis.recurseHmGet.recurseHmGet', upload)
            })
        }).catch(function (err) {
		console.log(err)
            if (err)
                appOptErr(err, 'clients.usruploadeletion.redis.recurseHmGet', upload)
        })
    }).catch(function (err) {
        if (err)
            appOptErr(err, 'clients.usruploadeletion.redis.getUsrSet', upload)
    })
}
function recurseHmSet(keys, values){
    if(keys.length==0)
        return
    let key = keys.shift(), value = values.shift()
    redis.storeUsrHash(key, [value.field, JSON.stringify(value.value)]).then(function () {
         recurseHmSet(keys, values)
    }).catch(function (err) {
        if (err) {
            recurseHmSet(keys, values)
            appOptErr(err + '_clients.recurseHmSet.redis.storeUsrHash', key, JSON.stringify(value))
        }
    })
}
function recurseHmGet(keys, gets){
    return new Promise(function (resolve, reject){
        function recurs(){
            if(keys.length==0)
                return resolve(gets)
            let key = keys.shift()
            redis.getUsrFieldsValue(key.key, key.field).then(function (res) {
                gets.push(res)
                recurs()
            }).catch(function (err) {
                if (err) {
                    reject(err)
                    appOptErr(err, 'clients.recurseHmGet.redis.storeUsrHash', 'empty')
                }
            })
        }
        recurs()
    })
}
function recurseHmKeysSet(keys){
    return new Promise(function (resolve, reject){
        let key = keys.shift()
        redis.storeUsrHash(key.key, [key.field, JSON.stringify(key.value)]).then(function () {
            if(keys.length)
                resolve(recurseHmKeysSet(keys))
            else
                resolve('success')
        }).catch(function (err) {
            if (err) {
                reject(err)
                appOptErr(err, 'clients.recurseHmKeysSet.redis.storeUsrHash', 'empty')
            }
        })
    })
}
function recurSettingSet(keys){
    return new Promise(function (resolve, reject) {
        function resolve_continue(){
            keys.splice(0,1)
            if(keys.length)
                resolve(recurSettingSet(keys))
            else
                resolve('success')
        }
        if(keys[0].match)
            redis.getUsrSet(keys[0].sheet).then(function(res){
                let members = res.join(',')
                if(!members.match(keys[0].localkey)){
                    redis.storeUsrSet(keys[0].sheet, keys[0].localkey).then(function(){
                        resolve_continue()
                    }).catch(function(err){
                        if(err){
                            reject(err)
                            appOptErr(err + '_clients.recurSettingSet.redis.getUsrSet.storeUsrSet', JSON.stringify(keys), JSON.stringify(keys[0]))
                        }
                    })
                }
                else
                    resolve_continue()
            }).catch(function(err){
                if(err) {
                    reject(err)
                    appOptErr(err + '_clients.recurSettingSet.redis.getUsrSet', JSON.stringify(keys), JSON.stringify(keys[0]))
                }
            })
        else
            redis.storeUsrSet(keys[0].sheet, keys[0].localkey).then(function(){
                resolve_continue()
            }).catch(function(err){
                if(err){
                    reject(err)
                    appOptErr(err + '_clients.recurSettingSet.redis.storeUsrSet', JSON.stringify(keys), JSON.stringify(keys[0]))
                }
            })
    })
}
function recurseHmGet(keys, gets){
    return new Promise(function (resolve, reject){
        let key = keys.shift()
        redis.getUsrFieldsValue(key.key, key.field).then(function (res) {
            gets.push(res)
            if(keys.length)
                resolve(recurseHmGet(keys, gets))
            else
                resolve(gets)
        }).catch(function (err) {
            if (err) {
                reject(err)
                appOptErr(err, 'clients.recurseHmGet.redis.getUsrFieldsValue', 'empty')
            }
        })
    })
}
function recurseGeoInfo(lng, lat, radius){
    radius = radius ? radius : 0
    radius+=5000
    return new Promise(function (resolve, reject) {
        redis.getGeosByRadius(lng, lat, radius).then(function(res){
            if(res.length >= 20 || radius==10000)
                resolve(res)
            else
                resolve(recurseGeoInfo(lng, lat, radius))
        }).catch(function(err){
            reject(err)
        })
    })
}
function recurseHdel(keys){
    return new Promise(function (resolve, reject){
        let key = keys.shift()
        redis.deleteHmData(key.key, key.field).then(function () {
            if(keys.length)
                resolve(recurseHdel(keys))
            else
                resolve('success')
        }).catch(function (err) {
            if (err)
                reject(err)
        })
    })
}
function appOptErr(reason, opt_val, optnew_val){
    let detail={}
    detail.err_reason=reason
    detail.old_content=opt_val
    detail.new_content=optnew_val
    redis.storeUsrHash('system:errlog', [new Date().getTime(),JSON.stringify(detail)]).then(function (res) {}).catch(function (err) {throw err})
}
module.exports = {
    roomsViewersJoin:roomsViewersJoin,
    takeRoomChair:takeRoomChair,
    removeTakerChair:removeTakerChair,
    chkRoomChairs:chkRoomChairs,
    chkRoomChair:chkRoomChair,
    checkRoomOwner:checkRoomOwner,
    checkRoomMembers:checkRoomMembers,
    roomerLeaveEvent:roomerLeaveEvent,
    talkToRoomer:talkToRoomer,
    getUsrImg:getUsrImg,
    usrsArrMapProp:usrsArrMapProp,
    usrsArrMapProps:usrsArrMapProps,
    usrSharing:usrSharing,
    getUsrWealth:getUsrWealth,
    delUsrRelateds:delUsrRelateds,
    delOldanswerings:delOldanswerings,
    usruploadeletion:usruploadeletion,
    recurseHmKeysSet:recurseHmKeysSet,
    recurSettingSet:recurSettingSet,
    recurseHmGet: recurseHmGet,
    recurseGeoInfo:recurseGeoInfo,
    appOptErr:appOptErr,
    recordsExpired: function(recorder){
        let cur_time = new Date(), current_mseconds = cur_time.getTime(), time_expire = 31104000000
        let that = this
        let r_openid = JSON.parse(recorder)
        redis.getCacheValue(recorder).then(function (val) {
            let cache_objs = eval('('+val+')')
            let cache_dels = []
            for(let ti in cache_objs){
                if(ti == 0)
                    continue
                let obj_time = new Date(cache_objs[ti].time)
                let rec_time = obj_time.getTime()
                if(current_mseconds-rec_time < time_expire)
                    break
                if(current_mseconds-rec_time >= time_expire)
                    cache_dels.push(cache_objs[ti])
            }
            if(cache_dels.length){
                that.asynDelPics(cache_dels, r_openid.openid)
                if(cache_dels.length == cache_objs.length-1) {
                    mysql.deletePeopleRow(recorder).then(function (d_res) {}).catch(function (err) {
                        if(err)
                            that.appOptErr(r_openid.openid, r_openid.localKey, err, 'recordsExpired.*.mysql.deletePeopleRow', 'people', val, 'null')
                    })
                    redis.deleteData(recorder).then(function(){}).catch(function(err){
                        if(err)
                            that.appOptErr(r_openid.openid, r_openid.localKey, err, 'recordsExpired.*.redis.deleteData', 'people', val, JSON.stringify(cache_objs[0]))
                    })
                }
                else{
                    for(let di in cache_dels){
                        let d_index = cache_objs.indexOf(cache_dels[di])
                        cache_objs.splice(d_index, 1)
                    }
                    mysql.update_exec(recorder, JSON.stringify(cache_objs)).then(function(u_res){}).catch(function(err){
                        if(err)
                            that.appOptErr(r_openid.openid, null, err, 'recordsExpired.*.mysql.update_exec', 'people', val, JSON.stringify(cache_objs))
                    })
                    redis.storeCache(recorder, JSON.stringify(cache_objs)).then(function(){}).catch(function(err){
                        if(err)
                            that.appOptErr(r_openid.openid, null, err, 'recordsExpired.*.redis.storeCache_else', 'people', val, JSON.stringify(cache_objs))
                    })
                }
            }
        }).catch(function(err){
            if(err)
                that.appOptErr(r_openid.openid, null, err, 'recordsExpired.redis.getCacheValue', 'people', 'null', 'null')
        })
    },
    chkOnlines: function(whoes){
        let onlines = this.clientsArray, w_onlines = []
        for(let wi in onlines){
            if(whoes.join().match(onlines[wi].key.localKey))
                w_onlines.push(onlines[wi].key.localKey)
        }
        return w_onlines
    },
    recurseHmSet:recurseHmSet,
    recurseHdel:recurseHdel
}
