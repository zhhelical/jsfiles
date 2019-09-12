//rediscache.js
"use strict"
const redis = require('redis')
    , mysql = require('./mysqldata.js')
    , co = require('co')
    , clientDb = redis.createClient()
    , geoip = require('redis-geo')(clientDb)
var dbconn = false
    , loop_switch = true
    , aDayInterval = 86400000
function existkey(key) {
    return new Promise(function (resolve, reject){
        clientDb.exists(key, function (err, reply) {
            if (err) reject(err)
            else resolve(reply)
        })
    })
}
function storeUsrsHash(key, values) {
    return new Promise(function (resolve, reject){
        clientDb.hmset(key, values, function (err, reply) {
            if (err) reject(err)
            else resolve(reply)
        })
    })
}
function storeUsrHash(key, value) {
    return new Promise(function (resolve, reject){
        clientDb.hset(key, value, function (err, reply) {
            if (err) reject(err)
            else resolve(reply)
        })    
    })
}
function storeUsrSet(key, members) {
    return new Promise(function (resolve, reject){
        clientDb.sadd(key, members, function (err, reply) {
            if (err) reject(err)
            else resolve(reply)
        })
    })
}
function appendUsrsList(key, usrs) {
    return new Promise(function (resolve, reject){
        clientDb.rpush(key, usrs, function (err, reply) {
            if (err) reject(err)
            else resolve(reply)
        })
    })
}
function getAllHashValue(key){
    return new Promise(function (resolve, reject) {
        clientDb.hgetall(key, function (err, replies) {
            if (err) reject(err)
            else
                resolve(replies)
        })
    })
}
function getUsrField(key, field){
    return new Promise(function (resolve, reject) {
        clientDb.hget(key, field, function (err, replies) {
            if (err) reject(err)
            else resolve(replies)
        })
    })
}
function getUsrFields(key){
    return new Promise(function (resolve, reject) {
        clientDb.hkeys(key, function (err, replies) {
            if (err) reject(err)
            else resolve(replies)
        })
    })
}
function getUsrValues(key){
    return new Promise(function (resolve, reject) {
        clientDb.hvals(key, function (err, replies) {
            if (err) reject(err)
            else resolve(replies)
        })
    })
}
function getUsrFieldsValue(key, fields) {
    return new Promise(function (resolve, reject){
        clientDb.hmget(key, fields, function (err, reply) {
            if (err) reject(err)
            else resolve(reply)
        })
    })
}
function usrFieldsLen(key) {
    return new Promise(function (resolve, reject){
        clientDb.hlen(key, function (err, reply) {
            if (err) reject(err)
            else resolve(reply)
        })
    })
}
function scanUsrHash(key, field, result){
    return new Promise(function (resolve, reject) {
        clientDb.hscan(key, field[0], function (err, replies) {
            if (err) reject(err)
            else {
		result=result.concat(replies)
                field.splice(0,1)
                if(field.length)
                    return resolve(scanUsrHash(key, field, result))
		resolve(result)
            }
        })
    })
}
function getUsrSet(key){
    return new Promise(function (resolve, reject) {
        clientDb.smembers(key, function (err, replies) {
            if (err) reject(err)
            else resolve(replies)
        })
    })
}
function getUsrsSet(keys){
    return new Promise(function (resolve, reject) {
        clientDb.sunion(keys, function (err, replies) {
            if (err) reject(err)
            else resolve(replies)
        })
    })
}
function isUsrsSetMember(key, member) {
    return new Promise(function (resolve, reject){
        clientDb.sismember(key, member, function (err, reply) {
            if (err) reject(err)
            else resolve(reply)
        })
    })
}
function getDestSheets(patterns){
    return new Promise(function (resolve, reject) {
        clientDb.keys(patterns, function (err, replies) {
            if (err) reject(err)
            else resolve(replies)
        })
    })
}
function scanUsrSet(key, member){
    return new Promise(function (resolve, reject) {
        clientDb.sscan(key, member, function (err, replies) {
            if (err) reject(err)
            else resolve(replies)
        })
    })
}
function getListUsrs(range){
    return new Promise(function (resolve, reject) {
        clientDb.lrange('people:lkeys', range.start, range.stop, function (err, replies) {
            if (err) reject(err)
            else resolve(replies)
        })
    })
}
function getSQLDataes(localkey, cb) {
    return new Promise(function (resolve, reject){
        mysql.content_exec(localkey).then(function(res){
            cb(res)
        }).catch(function(err){
            if(err)
                getSQLDataes(localkey)
        })
    })
}
function deleteHmData(key, fields){
    return new Promise(function (resolve, reject) {
        clientDb.hdel(key, fields, function (err, reply) {
            if (err) reject(err)
            else resolve(reply)
        })
    })
}
function removeSetMember(key, members) {
    return new Promise(function (resolve, reject){
        clientDb.srem(key, members, function (err, reply) {
            if (err) reject(err)
            else resolve(reply)
        })
    })
}
function deleteCommKeys(keys) {
    return new Promise(function (resolve, reject){
        clientDb.del(keys, function (err, reply) {
            if (err) reject(err)
            else resolve(reply)
        })
    })
}
function randomfunc(required){
    var rnum = Math.random()
    return Math.floor(rnum * required)
}
function toSQLInterval(dur){
    return parseInt(dur)*3600000
}
function addlocation(usr_geo){
    return new Promise(function (resolve, reject) {
        clientDb.geoadd('people:geo', usr_geo, function (err, reply) {
            if (err) reject(err)
            else resolve(reply)
        })
    })
}
function getlocation(localkeys){
    return new Promise(function (resolve, reject) {
        clientDb.geopos('people:geo', localkeys, function (err, reply) {
            if (err) reject(err)
            else resolve(reply)
        })
    })
}
function getGeosByRadius(lng, lat, radius){
    return new Promise(function (resolve, reject) {
        clientDb.georadius('people:geo', lng, lat, radius, 'm', 'WITHCOORD', function (err, reply) {
            if (err) reject(err)
            else resolve(reply)
        })
    })
}
function startLoopTransform(dur){
    loop_switch = true
    getUserCache('people:usr', 'alls').then(function(res){
        var usr_arr=JSON.parse(res), cp_arr=JSON.parse(res), length=0
        var recurs_match = function(users, length){
            if(!users.length) {
                storeUserCache('people:usr', JSON.stringify(cp_arr)),then(function(){}).catch(function(err){
                    if(err)
                        recurs_match(users, length)
                })
                return
            }
            var usr=users[0]
            if(typeof(usr)!=='string') {
                var values={localkey:usr.localkey,openid:usr.openid, pages:[], questions:[], files:[], rooms:[], wealth:{}}
                getlocation(usr.localkey).then(function(pres){
                    if(pres.length){
                        values.lat=pres[1]
                        values.lng=pres[0]
                        values.adress=usr.adress
                    }
                    mysql.insert_exec(users[0], values).then(function(){
                        cp_arr[length]=usr.localkey
                        length++
                        users.splice(0,1)
                        recurs_match(users)
                    }).catch(function(err){
                        if(err)
                            recurs_match(users)
                    })
                }).catch(function(err){
                    if(err)
                        recurs_match(users)
                })
            }
            else {
                var sheets=['pages','files','questions','rooms','wealth']
                var recurs_gets = function(){
                    if(!sheets.length)
                        return
                    getAllCacheValue(sheets[0]).then(function(sres){
                        var contents=JSON.parse(sres), chk_owner=JSON.stringify(contents.owners)
                        if(chk_owner.match(usr.localkey)){
                            mysql.field_exec(usr.localkey, sheets[0]).then(function (fres) {
                                if (fres==JSON.stringify(contents[sheets[0]])){
                                    sheets.splice(0,1)
                                    return recurs_gets()
                                }
                                mysql.update_exec(usr.localkey, sheets[0], contents[sheets[0]]).then(function(){
                                    sheets.splice(0,1)
                                    recurs_gets()
                                }).catch(function(err){
                                    if(err) recurs_gets()
                                })
                            }).catch(function (err) {
                                if (err) recurs_gets()
                            })
                        }
                        else
                            mysql.update_exec(usr.localkey, sheets[0], contents[sheets[0]]).then(function(){
                                sheets.splice(0,1)
                                recurs_gets()
                            }).catch(function(err){
                                if(err) recurs_gets()
                            })
                    }).catch(function(err){
                        if(err)
                            recurs_gets()
                    })
                }
                getSQLDataes(usr, function (fres) {

                })
            }
        }
        recurs_match(usr_arr, length)

    }).catch(function(err){
        if(err)
            startLoopTransform(dur)
    })
}
module.exports = {
    redis_srv: dbconn,
    existkey:existkey,
    getUsrField:getUsrField,
    getUsrFields:getUsrFields,
    getUsrValues:getUsrValues,
    getUsrFieldsValue:getUsrFieldsValue,
    usrFieldsLen:usrFieldsLen,   
    scanUsrHash:scanUsrHash,
    getUsrSet:getUsrSet,
    getUsrsSet:getUsrsSet,
    scanUsrSet:scanUsrSet,
    isUsrsSetMember:isUsrsSetMember,
    addlocation:addlocation,
    getlocation:getlocation,
    getGeosByRadius:getGeosByRadius,
    startLoopTransform:startLoopTransform,
    storeUsrSet:storeUsrSet,
    storeUsrHash:storeUsrHash,
    storeUsrsHash:storeUsrsHash,
    appendUsrsList:appendUsrsList,
    getDestSheets:getDestSheets,
    getListUsrs:getListUsrs,
    deleteHmData:deleteHmData,
    removeSetMember:removeSetMember,
    deleteCommKeys:deleteCommKeys,
    construct: function() {//将来加入出错信息反馈
        var chk_fault=null
        dbconn = true
        clientDb.on('error', function (err) {
            return chk_fault = err
        })
    },
    searchScope:function(localkey, lng, lat, radius){
        return new Promise(function (resolve, reject) {
            clientDb.georadius(localkey, lng, lat, radius, m, withcoord, withdist, function (err, reply) {
                if (err) reject(err)
                else resolve(reply)
            })
        })
    },
    dataesLoopStoreSQL:function(){
        interval = setInterval(function(){
            startLoopFetch(duration)
        }, aDayLoop)
    }
}
