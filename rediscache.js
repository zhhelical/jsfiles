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
function storeUserCache(key, values) {
    return new Promise(function (resolve, reject){
        clientDb.hmset(key, values, function (err, reply) {
            if (err) reject(err)
            else resolve(reply)
        })
    })
}
function storeKeyCache(key, value) {
    return new Promise(function (resolve, reject){
        clientDb.set(key, value, function (err, reply) {
            if (err) reject(err)
            else resolve(reply)
        })
    })
}
function getAllCacheValue(key){
    return new Promise(function (resolve, reject) {
        clientDb.hgetall(key, function (err, replies) {
            if (err) reject(err)
            else
                resolve(replies)
        })
    })
}
function getAllFromCache(keys, values, cb) {
    getAllCacheValue(keys[0]).then(function(res){
        if(!keys.length)
            return cb(values)
        val=JSON.parse(res)
        values.push({key:keys[0],value:val})
        keys.splice(0,1)
        getAllFromCache(keys, values, cb)
    }).catch(function(err){
        if(err)
            getAllFromCache(keys, values, cb)
    })
}
function getCacheValue(key){
    return new Promise(function (resolve, reject) {
        clientDb.get(key, function (err, replies) {
            if (err) reject(err)
            else {
                var reply=replies
                if(key=='localDir' && !reply){
                    var dir_random = require('./service/shell.js'), sh_order = 'head -n 80 /dev/urandom | tr -dc A-Za-z0-9 | head -c 16'
                    dir_random.shellFunc(sh_order).then(function (result) {
                        storeKeyCache(key, result).then(function(){
                            resolve(result)
                        }).catch(function(err){//??
                            if(err)
                                reject(err)
                        })
                    }).catch(function(err){
                        if(err)
                            dir_random.shellFunc(sh_order).then(function (result) {
                                resolve(result)
                            }).catch(function(err){if(err) reject(err)})
                    })
                }
                else
                    resolve(reply)
            }
        })
    })
}
function getUserCache(key, field) {
    return new Promise(function (resolve, reject){
        clientDb.hmget(key, field, function (err, reply) {
            if (err) reject(err)
            else resolve(reply)
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
function randomfunc(required){
    var rnum = Math.random()
    return Math.floor(rnum * required)
}
var testfunc = function(){
    //console.log(JSON.parse('page')) wrong for parse string
    /*getUserCache('people:pages', ['iFE8WQJsBOw6e8afZJ9B9aORbcBkvnin_1545016345328']).then(function(res){
        console.log(JSON.parse(res))
    }).catch(function(err){
        if(err)
            console.log(err)
    })*/
    storeUserCache('people:usr', {'iFE8WQJsBOw6e8afZJ9B9aORbcBkvnin':JSON.stringify({openid:'openid',adress:'adress'})}).then(function(res){
        console.log(res)
    }).catch(function(err){
        console.log(err)
    })
}
function toSQLInterval(dur){
    return parseInt(dur)*3600000
}
function getlocation(localkey){
    return new Promise(function (resolve, reject) {
        clientDb.geopos(localkey, function (err, reply) {
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
    getUserCache: getUserCache,
    getCacheValue:getCacheValue,
    getAllCacheValue:getAllCacheValue,
    getlocation:getlocation,
    startLoopTransform:startLoopTransform,
    storeUserCache:storeUserCache,
    construct: function() {//将来加入出错信息反馈
        var chk_fault=null
        dbconn = true
        clientDb.on('error', function (err) {
            return chk_fault = err
        })
    },
    newComerTest:function(strs){
        var that=this
        return new Promise(function (resolve, reject) {
            that.getCacheValue(strs).then(function(res){
                resolve(res)
            }).catch(function (err) {
                if (err)
                    reject(err)
            })
        })
    },
    getCacheKey:function(key){
        return new Promise(function (resolve, reject) {
            clientDb.keys(key, function (err, replies) {
                if (err) reject(err)
                else {
                    if(replies.length)
                        resolve(replies[0])
                    else
                        resolve('')
                }
            })
        })
    },
    deleteData:function(key){
        var that = this
        return new Promise(function (resolve, reject) {
            that.getCacheKey(key).then(function (res) {
                clientDb.del(key, function (err, reply) {
                    if (err) reject(err)
                    else resolve(reply)
                })
            }).catch(function (err) {
                if (err)
                    reject(err)
            })
        })
    },
    addlocation:function(localkey,lng,lat,loc_desc){
        return new Promise(function (resolve, reject) {
            clientDb.geoadd(localkey, lng, lat, loc_desc, function (err, reply) {
                if (err) reject(err)
                else resolve(reply)
            })
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
//testfunc()