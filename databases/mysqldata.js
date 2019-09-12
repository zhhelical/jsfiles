//mysqldata.js
"use strict"
var mysql = require('mysql')
    , co = require('co')
    , mydb = mysql.createPool({
            host: 'localhost',
            user: 'root',
            password: '96875635401',
            database: 'helicaldb',
            connectionLimit: 10000
        })

module.exports = {
    getallData:function(owner){
        return new Promise(function (resolve, reject) {
            mydb.getConnection(function (cnn_err, conn) {
                if (cnn_err)
                    reject(cnn_err)
                else {
                    conn.query("SELECT * FROM people WHERE user LIKE '%" + owner + "%'", function (err, results) {
                        conn.release()
                        if (err) reject(err)
                        else if (results.length) resolve(results[0])
                        else resolve([])
                    })
                }
            })
        })
    },
    comerConformDb:function(strs){
        return new Promise(function (resolve, reject) {
            mydb.getConnection(function (cnn_err, conn) {
                if (cnn_err)
                    reject(cnn_err)
                else {
                    conn.query("SELECT localKey FROM people WHERE openid=" + strs, function (err, results) {
                        conn.release()
                        if (err) reject(err)
                        else if (results.length) resolve(results[0].localKey)
                        else resolve([])
                    })
                }
            })
        })
    },
    content_exec: function(localkey) {
        return new Promise(function (resolve, reject){
            mydb.getConnection(function(cnn_err,conn){
                if(cnn_err)
                    reject(cnn_err)
                else{
                    conn.query("SELECT * FROM people WHERE localkey="+localkey, function(err, results, feilds) {
                        conn.release()
                        if (err) reject(err)
                        else if(results.length) resolve(results[0])
                        else resolve(null)
                    })
                }
            })
        })
    },
    field_exec: function(localkey, field) {
        return new Promise(function (resolve, reject){
            mydb.getConnection(function(cnn_err,conn){
                if(cnn_err)
                    reject(cnn_err)
                else{
                    conn.query(`SELECT ${field} FROM people WHERE localkey=`+localkey, function(err, results, feilds) {
                        conn.release()
                        if (err) reject(err)
                        else if(results.length) resolve(results[0])
                        else resolve(null)
                    })
                }
            })
        })
    },
    insert_exec: function(which, values) {
        var ins=`INSERT INTO ${which}`
        if(which=='people')
            ins += ` (localkey, openid, pages, quesions, files, rooms, wealth, lat, lng, adress) VALUES(${values.localkey}, ${values.openid}, ${values.pages}, ${values.quesions}, ${values.files}, ${values.rooms}, ${values.wealth}, ${values.lat}, ${values.lng}, ${values.adress})`
        else if(which=='pictures')
            ins += ` (localkey) VALUES(${values.localkey})`
        else if(which=='voices')
            ins += ` (localkey) VALUES(${values.localkey})`
        else if(which=='videoes')
            ins += ` (localkey) VALUES(${values.localkey})`
        else if(which=='pdfs')
            ins += ` (localkey) VALUES(${values.localkey})`
        return new Promise(function (resolve, reject) {
            mydb.getConnection(function(cnn_err,conn){
                if(cnn_err)
                    reject(cnn_err)
                else{
                    conn.query(ins, function (err, results) {
                        conn.release()
                        if (err) reject(err)
                        else resolve(results)
                    })
                }
            })
        })
    },
    insert_pays: function(ins_obj) {
        return new Promise(function (resolve, reject) {
            mydb.getConnection(function(cnn_err,conn){
                if(cnn_err)
                    reject(cnn_err)
                else{
                    conn.query("INSERT INTO payment (openid, transaction_id, out_trade_no, time_end, total_fee, sign, nonce_str, bank_type) VALUES(" + "'" + ins_obj.openid + "'" + ", " + "'" + ins_obj.transaction_id + "'" + ", " + "'" + ins_obj.out_trade_no + "'" + ", " + "'" + ins_obj.time_end + "'" + ", " + "'" + ins_obj.total_fee + "'" + ", " + "'" + ins_obj.sign + "'" + ", " + "'" + ins_obj.nonce_str + "'" + ", " + "'" + ins_obj.bank_type + "'" + ")", function (err, results) {
                        conn.release()
                        if (err) reject(err)
                        else resolve(results)
                    })
                }
            })
        })
    },
    update_exec: function(key, field, value) {
        return new Promise(function (resolve, reject) {
            mydb.getConnection(function(cnn_err,conn){
                if(cnn_err)
                    reject(cnn_err)
                else{
                    conn.query(`UPDATE people SET ${field}='${value}' WHERE localkey='${key}'`, function (err, results) {
                        conn.release()
                        if (err) reject(err)
                        else resolve(results)
                    })
                }
            })
        })
    },
    valueByAddr:function(addr){
        return new Promise(function (resolve, reject){
            mydb.getConnection(function(cnn_err,conn){
                if(cnn_err)
                    reject(cnn_err)
                else{
                    var city = addr.city, gate = addr.gate
                    conn.query("SELECT * FROM people WHERE value LIKE '%"+city+"%' AND value LIKE '%"+gate+"%'", function(err, results, feilds) {
                        conn.release()
                        if (err) reject(err)
                        else if(results.length) resolve(results)
                        else resolve([])
                    })
                }
            })
        })
    },
    grouperSet:function(grp){
        return new Promise(function (resolve, reject){
            mydb.getConnection(function(cnn_err,conn){
                if(cnn_err)
                    reject(cnn_err)
                else{
                    var q_str = ''
                    if(grp.cancel)
                        q_str = "DELETE FROM grpsmasters WHERE master LIKE '%"+grp.master+"%'"
                    else {
                        var m_cons = JSON.stringify(grp.master), j_cons = JSON.stringify([])
                        q_str = "INSERT INTO grpsmasters (master, joiners, viewers) VALUES(" + "'" + m_cons + "'" + ", " + "'" + j_cons + "'"  + ", " + "'" + j_cons + "'" + ")"
                    }
                    conn.query(q_str, function(err, results) {
                        conn.release()
                        if (err) reject(err)
                        else resolve(results)
                    })
                }
            })
        })
    },
    grouperUpdate:function(updates){
        var that = this
        return new Promise(function (resolve, reject){
            mydb.getConnection(function(cnn_err,conn){
                if(cnn_err)
                    reject(cnn_err)
                else{
                    conn.query("SELECT * FROM grpsmasters WHERE master LIKE '%"+updates.mopenid+"%'", function (err, results, feilds) {
                        if (err) {//here need promote for err codes
                            var err_obj = {
                                err_reason: err,
                                err_table: 'grpsmasters',
                                openid: updates.uopenid,
                                err_time: (new Date().getTime()),
                                old_content: 'null',
                                new_content: 'null',
                                opt_type: 'mydb.grouperUpdate.getConnection.conn.query'
                            }
                            that.insertErrLogs(err_obj).then(function (res) {}).catch(function (err) {throw err})
                            reject(err)
                        }
                        else {
                            var ins_grp = [], str_query = ''
                            if(updates.insert) {
                                if(updates.insert == 'msgs') {
                                    var ins_new = {grptime: updates.grptime}, set_pos = ''
                                    if (updates.master == 'user') {
                                        ins_grp = eval('(' + results[0].master + ')')
                                        ins_new.sendto = updates.uopenid
                                        set_pos = 'master'
                                    }
                                    else {
                                        if (updates.master == 'joiner sendto master') {
                                            ins_grp = eval('(' + results[0].joiners + ')')
                                            ins_new.joiner = updates.uopenid
                                            set_pos = 'joiners'
                                        }
                                        else {
                                            ins_grp = eval('(' + results[0].viewers + ')')
                                            ins_new.usr = updates.uopenid
                                            set_pos = 'viewers'
                                        }
                                        ins_new.nick = updates.nick
                                        ins_new.gender = updates.gender
                                    }
                                    ins_new.msgs = updates.msgs
                                    ins_grp.push(ins_new)
                                    str_query = "UPDATE grpsmasters SET " + set_pos + "='" + JSON.stringify(ins_grp) + "' WHERE master LIKE '%" + updates.mopenid + "%'"
                                }
                                else if(updates.insert == 'joinning'){
                                    ins_grp = eval('(' + results[0].viewers + ')')
                                    var trans_info = []
                                    for(var ii=ins_grp.length-1; ii>-1; ii--){
                                        if(ins_grp[ii].usr==updates.uopenid && ins_grp[ii].grptime==updates.grptime)
                                            trans_info.unshift(ins_grp.splice(ii, 1)[0])
                                    }
                                    for(var ti=trans_info.length-1; ti>-1; ti--){
                                        if(JSON.stringify(trans_info[ti].msgs).match('viewer access one time') || JSON.stringify(trans_info[ti].msgs).match('viewer apply join')) {
                                            if(trans_info.length == 1){
                                                delete trans_info[ti].usr
                                                trans_info[ti].joiner = updates.uopenid
                                                trans_info[ti].himg = updates.himg//?
                                                trans_info[ti].msgs = []
                                                break
                                            }
                                            trans_info.splice(ti, 1)
                                            continue
                                        }
                                        delete trans_info[ti].usr
                                        trans_info[ti].joiner = updates.uopenid
                                        trans_info[ti].himg = updates.himg//?
                                    }
                                    var ins_jgrp = eval('(' + results[0].joiners + ')')
                                    ins_jgrp = ins_jgrp.concat(trans_info)
                                    str_query = "UPDATE grpsmasters SET joiners='" + JSON.stringify(ins_jgrp) + "', viewers='" + JSON.stringify(ins_grp) + "' WHERE master LIKE '%" + updates.mopenid + "%'"
                                    if(updates.accept){
                                        var a_master = eval('(' + results[0].master + ')')
                                        for(var ii=a_master.length-1; ii>-1; ii--){
                                            if(a_master[ii].sendto==updates.uopenid && a_master[ii].msgs[0].msg=='master invited you' && a_master[ii].grptime==updates.grptime)
                                                a_master.splice(ii, 1)
                                        }
                                        str_query = "UPDATE grpsmasters SET master='" + JSON.stringify(a_master) + "', joiners='" + JSON.stringify(ins_jgrp) + "', viewers='" + JSON.stringify(ins_grp) + "' WHERE master LIKE '%" + updates.mopenid + "%'"
                                    }
                                }
                                else if(updates.insert == 'joiner quit'){
                                    ins_grp = eval('(' + results[0].joiners + ')')
                                    for(var ii=ins_grp.length-1; ii>-1; ii--){
                                        if(ins_grp[ii].joiner==updates.uopenid && ins_grp[ii].grptime==updates.grptime)
                                            ins_grp.splice(ii, 1)
                                    }
                                    var ins_mgrp = eval('(' + results[0].master + ')')
                                    for(var ii=ins_mgrp.length-1; ii>-1; ii--){
                                        if(ins_mgrp[ii].sendto==updates.uopenid && ins_mgrp[ii].grptime==updates.grptime)
                                            ins_mgrp.splice(ii, 1)
                                    }
                                    str_query = "UPDATE grpsmasters SET master='" + JSON.stringify(ins_mgrp) + "', joiners='" + JSON.stringify(ins_grp) + "' WHERE master LIKE '%" + updates.mopenid + "%'"
                                }
                            }
                            else if(updates.batch){
                                var /*batch_func = function(str_querys, cb){
                                    if(!b_objs.length)
                                        return cb('finished one batch')
                                    conn.query(str_querys[0], function (err) {
                                        conn.release()
                                        if (err)
                                            return reject(err)
                                        else{
                                            str_querys.splice(0, 1)
                                            batch_func(str_querys, cb)
                                        }
                                    })
                                }, */aj_all = [], ac_all = []
                                if(!updates.sendto.match('applyers')) {
                                    ins_grp = eval('(' + results[0].master + ')')
                                    if (updates.sendto == 'send to all joiners')
                                        aj_all = eval('(' + results[0].joiners + ')')
                                    else if (updates.sendto == 'send to all viewers')
                                        aj_all = eval('(' + results[0].viewers + ')')
                                    for(var ii=aj_all.length-1; ii>-1; ii--){
                                        var cuter = aj_all.splice(ii, 1)[0], who = updates.sendto=='send to all viewers' ? cuter.usr : cuter.joiner
                                        if(!JSON.stringify(aj_all).match(who)) {
                                            var ins_new = {grptime: updates.grptime, sendto:who, msgs:updates.msgs}
                                            ac_all.unshift(ins_new)
                                        }
                                    }
                                    ins_grp = ins_grp.concat(ac_all)
                                    str_query = "UPDATE grpsmasters SET master='" + JSON.stringify(ins_grp) + "' WHERE master LIKE '%" + updates.mopenid + "%'"
                                }
                                else if(updates.sendto == 'send to all applyers') {
                                    aj_all = eval('(' + results[0].viewers + ')')
                                    if(updates.msgs[0].msg == 'master authorize viewers') {
                                        for (var ii in aj_all) {
                                            if (JSON.stringify(aj_all[ii].msgs).match('viewer apply join') && !ac_all.join().match(aj_all[ii].usr))
                                                ac_all.push(aj_all[ii].usr)
                                        }
                                        var avj = []
                                        for (var ii = aj_all.length - 1; ii > -1; ii--) {
                                            if (ac_all.join().match(aj_all[ii].usr)) {
                                                var cuter = aj_all.splice(ii, 1)[0], who = cuter.usr
                                                if (JSON.stringify(cuter.msgs).match('viewer access one time') || JSON.stringify(cuter.msgs).match('viewer apply join')) {
                                                    if (!JSON.stringify(avj).match(who) && !JSON.stringify(aj_all).match(who)) {
                                                        cuter.joiner = cuter.usr
                                                        delete cuter.usr
                                                        cuter.msgs = []
                                                        avj.unshift(cuter)
                                                    }
                                                    continue
                                                }
                                                cuter.joiner = cuter.usr
                                                delete cuter.usr
                                                avj.unshift(cuter)
                                            }
                                        }
                                        ins_grp = eval('(' + results[0].joiners + ')')
                                        ins_grp = ins_grp.concat(avj)
                                        str_query = "UPDATE grpsmasters SET joiners='" + JSON.stringify(ins_grp) + "', viewers='" + JSON.stringify(aj_all) + "' WHERE master LIKE '%" + updates.mopenid + "%'"
                                    }
                                    else{
                                        ins_grp = eval('(' + results[0].master + ')')
                                        for (var ii in aj_all) {
                                            if (aj_all[ii].grptime == updates.grptime && !ac_all.join().match(aj_all[ii].usr) && !JSON.stringify(aj_all[ii].msgs).match('viewer apply join')) {
                                                var m_invitting = {grptime:updates.grptime, sendto:aj_all[ii].usr, msgs:[{msg:updates.msgs[0].msg, time:updates.msgs[0].time}]}
                                                ins_grp.push(m_invitting)
                                                ac_all.push(aj_all[ii].usr)
                                            }
                                        }
                                        str_query = "UPDATE grpsmasters SET master='" + JSON.stringify(ins_grp) + "' WHERE master LIKE '%" + updates.mopenid + "%'"
                                    }
                                }
                            }
                            else if(updates.del){
                                var who = updates.del
                                if(who.match('master')) {
                                    who = 'master'
                                    ins_grp = eval('(' + results[0].master + ')')
                                    for(var ii=ins_grp.length-1; ii>0; ii--){
                                        if(updates.uopenid==ins_grp[ii].sendto && updates.grptime==ins_grp[ii].grptime){
                                            var e_msgs = ins_grp[ii].msgs, found = false
                                            for(var ei=e_msgs.length-1; ei>-1; ei--){
                                                if(e_msgs[ei].msg && e_msgs[ei].msg==updates.msg){
                                                    found = true
                                                    ins_grp.splice(ii, 1)
                                                    break
                                                }
                                            }
                                            if(found)
                                                break
                                        }
                                    }
                                    str_query = `UPDATE grpsmasters SET ${who}='` + JSON.stringify(ins_grp) + "' WHERE master LIKE '%" + updates.mopenid + "%'"
                                }
                                else if(who == 'joiner') {
                                    who = 'joiners'
                                    ins_grp = eval('(' + results[0].joiners + ')')
                                    for(var ii=ins_grp.length-1; ii>0; ii--){
                                        if(updates.uopenid==ins_grp[ii].joiner && updates.grptime==ins_grp[ii].grptime)
                                            ins_grp.splice(ii, 1)
                                    }
                                    var ds_master = eval('(' + results[0].master + ')')
                                    for(var ii=ds_master.length-1; ii>0; ii--){
                                        if(updates.uopenid==ds_master[ii].sendto && updates.grptime==ds_master[ii].grptime)
                                            ds_master.splice(ii, 1)
                                    }
                                    "UPDATE grpsmasters SET joiners='" + JSON.stringify(ins_grp) + "', master='" + JSON.stringify(ds_master) + "' WHERE master LIKE '%" + updates.mopenid + "%'"
                                }
                            }
                            conn.query(str_query, function (err) {
                                conn.release()
                                if (err) {
                                    var err_obj = {
                                        err_reason: err,
                                        err_table: 'grpsmasters',
                                        openid: updates.uopenid,
                                        err_time: (new Date().getTime()),
                                        old_content: 'null',
                                        new_content: 'null',
                                        opt_type: 'mydb.grouperUpdate.query_update'
                                    }
                                    that.insertErrLogs(err_obj).then(function (res) {}).catch(function (err) {throw err})
                                    reject(err)
                                }
                                else
                                    resolve('finished updategrp')
                            })
                        }
                    })
                }
            })
        })
    },
    reqChkGroup:function(grp){
        return new Promise(function (resolve, reject){
            mydb.getConnection(function(cnn_err,conn){
                if(cnn_err)
                    reject(cnn_err)
                else{
                    conn.query("SELECT master FROM grpsmasters WHERE master LIKE '%"+grp.openid+"%'", function(err, results) {
                        conn.release()
                        if (err) reject(err)
                        else if(results.length) resolve(results[0])
                        else resolve([])
                    })
                }
            })
        })
    },
    reqChkViewers:function(viewer){
        var that = this
        return new Promise(function (resolve, reject){
            mydb.getConnection(function(cnn_err,conn){
                if(cnn_err)
                    reject(cnn_err)
                else{
                    conn.query("SELECT * FROM grpsmasters WHERE viewers LIKE '%"+viewer.openid+"%'", function(err, results) {
                        conn.release()
                        if (err) reject(err)
                        else if(results.length){
                            var all_masters = []
                            var recur_get = function(t_objs, em_arr, cb){
                                if(!t_objs.times.length) {
                                    em_arr.unshift({master:t_objs.mlocalKey})
                                    return cb('finished one master')
                                }
                                var v_chk = {}
                                v_chk.master = t_objs.master
                                v_chk.viewer = 'yes'
                                v_chk.openid = t_objs.openid
                                v_chk.mlocalKey = t_objs.mlocalKey
                                v_chk.localKey = t_objs.localKey
                                v_chk.time = t_objs.times[0].time
                                that.reqChkGrp(v_chk).then(function(d_coms){
                                    d_coms.unshift({grpdata:t_objs.times[0]})
                                    em_arr.push(d_coms)
                                    t_objs.times.splice(0, 1)
                                    recur_func(grps, em_arr, cb)
                                }).catch(function(err){
                                    if (err) {
                                        t_objs.times.splice(0, 1)
                                        recur_get(t_objs, em_arr, cb)
                                    }
                                })
                            }
                            var recur_func = function(grps, end_arr){
                                if(!grps.length)
                                    return resolve(end_arr)
                                that.getallData(grps[0].master).then(function(d_grp){
                                    var s_data = eval('('+d_grp.value+')'), s_usr = JSON.parse(d_grp.user)
                                    s_data.splice(0, 1)
                                    for(var si=s_data.length-1; si>-1; si--){
                                        if(!grps[0].times.join().match(s_data[si].time))
                                            s_data.splice(si, 1)
                                    }
                                    var grp_chk = {master:s_usr.openid, openid:viewer.openid, mlocalKey:s_usr.localKey, localKey:viewer.localKey, times:s_data}, arrs = []
                                    recur_get(grp_chk, arrs, function(){
                                        end_arr.push(arrs)
                                        grps.splice(0, 1)
                                        recur_func(grps, end_arr)
                                    })
                                }).catch(function(err){
                                    if (err) {return reject('grp dchk failed')}
                                })
                            }
                            for(var ri in results){
                                var all_master = eval('(' + results[ri].master + ')'), all_grps = []
                                var all_viewer = eval('(' + results[ri].viewers + ')')
                                for(var vi in all_viewer){
                                    if(all_viewer[vi].usr==viewer.openid && !all_grps.join().match(all_viewer[vi].grptime))
                                        all_grps.push(all_viewer[vi].grptime)
                                }
                                all_masters.push({master:all_master[0].master, times:all_grps})
                            }
                            var res_arr = []
                            recur_func(all_masters, res_arr)
                        }
                        else resolve([])
                    })
                }
            })
        })
    },
    reqChkJoiners:function(joiner){
        var that = this
        return new Promise(function (resolve, reject){
            mydb.getConnection(function(cnn_err,conn){
                if(cnn_err)
                    reject(cnn_err)
                else{
                    conn.query("SELECT * FROM grpsmasters WHERE joiners LIKE '%"+joiner.openid+"%'", function(err, results) {
                        conn.release()
                        if (err) reject(err)
                        else if(results.length){
                            var all_masters = []
                            var recur_get = function(t_objs, em_arr, cb){
                                if(!t_objs.times.length) {
                                    em_arr.unshift({master:t_objs.mlocalKey})
                                    return cb('finished one master')
                                }
                                var j_chk = {}
                                j_chk.master = t_objs.master
                                j_chk.joiner = 'yes'
                                j_chk.openid = t_objs.openid
                                j_chk.mlocalKey = t_objs.mlocalKey
                                j_chk.localKey = t_objs.localKey
                                j_chk.time = t_objs.times[0].time
                                that.reqChkGrp(j_chk).then(function(d_coms){
                                    d_coms.unshift({grpdata:t_objs.times[0]})
                                    em_arr.push(d_coms)
                                    t_objs.times.splice(0, 1)
                                    recur_get(grps, em_arr, cb)
                                }).catch(function(err){
                                    if (err) {
                                        t_objs.times.splice(0, 1)
                                        recur_get(t_objs, em_arr, cb)
                                    }
                                })
                            }
                            var recur_func = function(grps, end_arr){
                                if(!grps.length)
                                    return resolve(end_arr)
                                that.getallData(grps[0].master).then(function(d_grp){
                                    var s_data = eval('('+d_grp.value+')'), s_usr = JSON.parse(d_grp.user)
                                    s_data.splice(0, 1)
                                    for(var si=s_data.length-1; si>-1; si--){
                                        if(!grps[0].times.join().match(s_data[si].time))
                                            s_data.splice(si, 1)
                                    }
                                    var grp_chk = {master:s_usr.openid, openid:joiner.openid, mlocalKey:s_usr.localKey, localKey:joiner.localKey, times:s_data}, arrs = []
                                    recur_get(grp_chk, arrs, function(){
                                        end_arr.push(arrs)
                                        grps.splice(0, 1)
                                        recur_func(grps, end_arr)
                                    })
                                }).catch(function(err){
                                    if (err) {return reject('grp dchk failed')}
                                })
                            }
                            for(var ri in results){
                                var all_master = eval('(' + results[ri].master + ')'), all_grps = []
                                var all_joiner = eval('(' + results[ri].joiners + ')')
                                for(var ji in all_joiner){
                                    if(all_joiner[ji].joiner==joiner.openid && !all_grps.join().match(all_joiner[ji].grptime))
                                        all_grps.push(all_joiner[ji].grptime)
                                }
                                all_masters.push({master:all_master[0].master, times:all_grps})
                            }
                            var res_arr = []
                            recur_func(all_masters, res_arr)
                        }
                        else resolve([])
                    })
                }
            })
        })
    },
    reqChkGrp:function(checker){
        var that = this
        return new Promise(function (resolve, reject){
            mydb.getConnection(function(cnn_err,conn){
                if(cnn_err)
                    reject(cnn_err)
                else{
                    conn.query("SELECT * FROM grpsmasters WHERE master LIKE '%"+checker.master+"%'", function(err, results) {
                        conn.release()
                        if (err) reject(err)
                        else if(results.length){
                            var all_master = eval('(' + results[0].master + ')'),
                                all_coms = [],
                                all_others = [],
                                com_datas = [], jv_others = [], others = [], sqlpics = require('./mysqlpics.js')
                            var sure_file = function (s_list) {
                                if (!s_list.length) {
                                    all_master[0].master = checker.mlocalKey
                                    all_master[0].grptime = checker.time
                                    com_datas.unshift(all_master[0])
                                    com_datas.push(jv_others)
                                    com_datas.push(others)
                                    return resolve(com_datas)
                                }
                                var su_key = s_list[0].key
                                if(su_key == checker.localKey)
                                    s_list[0].key = 'usr'
                                else
                                    s_list[0].key = 'master'
                                if (s_list[0].rec || s_list[0].img) {
                                    var f_keys = {key: su_key, time: s_list[0].time}
                                    sqlpics.find_riname(f_keys, s_list[0].rec ? 1 : 0).then(function (names) {
                                        if (s_list[0].rec) {
                                            s_list[0].voifile = names.voi_name
                                            s_list[0].size = names.voi_size
                                        }
                                        else {
                                            s_list[0].img = names.img_name
                                            var img_info = names.img_size.split('?&')
                                            s_list[0].size = img_info[img_info.length - 1]
                                        }
                                        com_datas.push(s_list.splice(0, 1)[0])
                                        sure_file(s_list)
                                    }).catch(function (err) {
                                        if (err) {
                                            if (s_list[0].rec)
                                                s_list[0].voifile = 'fail down'
                                            else
                                                s_list[0].img = 'fail down'
                                            com_datas.push(s_list.splice(0, 1)[0])
                                            sure_file(s_list)
                                        }
                                    })
                                }
                                else {
                                    com_datas.push(s_list.splice(0, 1)[0])
                                    sure_file(s_list)
                                }
                            }
                            if(checker.joiner) {
                                all_coms = eval('(' + results[0].joiners + ')')
                                all_others = eval('(' + results[0].viewers + ')')
                            }
                            else {
                                all_coms = eval('(' + results[0].viewers + ')')
                                all_others = eval('(' + results[0].joiners + ')')
                            }
                            for (var ai in all_master) {
                                if (all_master[ai].grptime && all_master[ai].grptime==checker.time && all_master[ai].sendto==checker.openid) {
                                    for (var mi in all_master[ai].msgs) {
                                        all_master[ai].msgs[mi].key = checker.mlocalKey
                                        all_master[ai].msgs[mi].sendto = checker.localKey
                                    }
                                    com_datas = com_datas.concat(all_master[ai].msgs)
                                }
                            }
                            for(var ai=all_coms.length-1; ai>-1; ai--){
                                if (all_coms[ai].grptime==checker.time) {
                                    var cutted = all_coms.splice(ai, 1), u_key = cutted[0].usr ? cutted[0].usr : cutted[0].joiner
                                    if(u_key==checker.openid) {
                                        for (var mi in cutted[0].msgs)
                                            cutted[0].msgs[mi].key = checker.localKey
                                        com_datas = com_datas.concat(cutted[0].msgs)
                                        if(JSON.stringify(all_coms).match(u_key))
                                            continue
                                        if(cutted[0].usr) {
                                            all_master[0].usr = 'usr'
                                            cutted[0].usr = checker.localKey
                                        }
                                        else {
                                            all_master[0].joiner = 'joiner'
                                            cutted[0].joiner = checker.localKey
                                        }
                                        delete cutted[0].grptime
                                        delete cutted[0].msgs
                                    }
                                    else{
                                        if(JSON.stringify(all_coms).match(u_key))
                                            continue
                                        delete cutted[0].grptime
                                        delete cutted[0].msgs
                                        if(cutted[0].usr)
                                            cutted[0].usr = 'viewer'
                                        else
                                            cutted[0].joiner = 'joiner'
                                    }
                                    jv_others.unshift(cutted[0])
                                }
                            }
                            for(var ai=all_others.length-1; ai>-1; ai--){
                                if (all_others[ai].grptime==checker.time) {
                                    var cutted = all_others.splice(ai, 1), u_key = cutted[0].usr ? cutted[0].usr : cutted[0].joiner
                                    if(u_key==checker.openid) {
                                        for (var mi in cutted[0].msgs)
                                            cutted[0].msgs[mi].key = checker.localKey
                                        com_datas = com_datas.concat(cutted[0].msgs)
                                        if(JSON.stringify(all_others).match(u_key))
                                            continue
                                        if(cutted[0].usr) {
                                            all_master[0].usr = 'usr'
                                            cutted[0].usr = checker.localKey
                                        }
                                        else {
                                            all_master[0].joiner = 'joiner'
                                            cutted[0].joiner = checker.localKey
                                        }
                                        delete cutted[0].grptime
                                        delete cutted[0].msgs
                                    }
                                    else{
                                        if(JSON.stringify(all_others).match(u_key))
                                            continue
                                        delete cutted[0].grptime
                                        delete cutted[0].msgs
                                        if(cutted[0].usr)
                                            cutted[0].usr = 'viewer'
                                        else
                                            cutted[0].joiner = 'joiner'
                                    }
                                    others.unshift(cutted[0])
                                }
                            }
                            var reclist = com_datas.splice(0, com_datas.length)
                            sure_file(reclist)
                        }
                        else resolve([])
                    })
                }
            })
        })
    },
    grouperGet:function(grp){
        var that = this
        return new Promise(function (resolve, reject){
            mydb.getConnection(function(cnn_err,conn){
                if(cnn_err)
                    reject(cnn_err)
                else{
                    var s_str = `SELECT * FROM grpsmasters WHERE master LIKE '%${grp.openid}%'`
                    conn.query(s_str, function (err, results) {
                        conn.release()
                        if (err) {//here need promote for err codes
                            var err_obj = {
                                err_reason: err,
                                err_table: 'grpsmasters',
                                openid: grp.master,
                                err_time: (new Date().getTime()),
                                old_content: 'null',
                                new_content: 'null',
                                opt_type: 'mydb.grouperGet.getConnection.conn.query'
                            }
                            that.insertErrLogs(err_obj).then(function (res) {}).catch(function (err) {throw err})
                            reject(err)
                        }
                        else {
                            if(results.length) {
                                var all_master = eval('(' + results[0].master + ')'),
                                    all_joiners = eval('(' + results[0].joiners + ')'),
                                    all_viewers = eval('(' + results[0].viewers + ')'),
                                    com_datas = [], jmsgs = [], vmsgs = [], openids = []
                                var recur_func = function(grps, chgrps, cb) {
                                    if (!grps.length)
                                        return cb('recur finished')
                                    var who = grps[0]
                                    that.loggerFound({key:'localkey', value:who}).then(function (local) {
                                        chgrps.push({openid:grps.splice(0, 1)[0], local:local.localKey})
                                        recur_func(grps, chgrps, cb)
                                    }).catch(function (err) {
                                        if (err) {
                                            grps.splice(0, 1)
                                            recur_func(grps, chgrps, cb)
                                        }
                                    })
                                }
                                var sqlpics = require('./mysqlpics.js')
                                var sure_file = function (s_list) {
                                    if (!s_list.length) {
                                        all_master[0].master = grp.localKey
                                        all_master[0].grptime = grp.time
                                        com_datas.unshift(all_master[0])
                                        return resolve(com_datas)
                                    }
                                    if (s_list[0].rec || s_list[0].img) {
                                        var f_keys = {key: (s_list[0].key ? s_list[0].key : s_list[0].joiner), time: s_list[0].time}
                                        sqlpics.find_riname(f_keys, s_list[0].rec ? 1 : 0).then(function (names) {
                                            if (s_list[0].rec) {
                                                s_list[0].voifile = names.voi_name
                                                s_list[0].size = names.voi_size
                                            }
                                            else {
                                                s_list[0].img = names.img_name
                                                var img_info = names.img_size.split('?&')
                                                s_list[0].size = img_info[img_info.length - 1]
                                            }
                                            com_datas.push(s_list.splice(0, 1)[0])
                                            sure_file(s_list)
                                        }).catch(function (err) {
                                            if (err) {
                                                if (s_list[0].rec)
                                                    s_list[0].voifile = 'fail down'
                                                else
                                                    s_list[0].img = 'fail down'
                                                com_datas.push(s_list.splice(0, 1)[0])
                                                sure_file(s_list)
                                            }
                                        })
                                    }
                                    else {
                                        com_datas.push(s_list.splice(0, 1)[0])
                                        sure_file(s_list)
                                    }
                                }
                                for (var ai in all_master) {
                                    if (all_master[ai].grptime && all_master[ai].grptime==grp.time) {
                                        for (var mi in all_master[ai].msgs) {
                                            if(all_master[ai].msgs[mi].rec || all_master[ai].msgs[mi].img)
                                                all_master[ai].msgs[mi].key = grp.localKey
                                            all_master[ai].msgs[mi].sendto = all_master[ai].sendto
                                        }
                                        com_datas = com_datas.concat(all_master[ai].msgs)
                                    }
                                }
                                for (var ji in all_joiners) {
                                    if (all_joiners[ji].grptime == grp.time) {
                                        var chk_openids = openids.join()
                                        if(!chk_openids.match(all_joiners[ji].joiner))
                                            openids.push(all_joiners[ji].joiner)
                                        for (var mi in all_joiners[ji].msgs) {
                                            all_joiners[ji].msgs[mi].joiner = all_joiners[ji].joiner
                                            all_joiners[ji].msgs[mi].img = all_joiners[ji].img
                                            all_joiners[ji].msgs[mi].nick = all_joiners[ji].nick
                                            all_joiners[ji].msgs[mi].gender = all_joiners[ji].gender
                                        }
                                        jmsgs = jmsgs.concat(all_joiners[ji].msgs)
                                    }
                                }
                                var trans_openids = openids.slice(0)
                                openids.length = 0
                                recur_func(trans_openids, openids, function(){
                                    for (var oi in openids) {
                                        for(var ji in jmsgs) {
                                            if (jmsgs[ji].joiner == openids[oi].openid)
                                                jmsgs[ji].joiner = openids[oi].local
                                        }
                                    }
                                    com_datas = com_datas.concat(jmsgs)
                                    openids.length = 0
                                    for (var vi in all_viewers) {
                                        if (all_viewers[vi].grptime == grp.time) {
                                            var chk_openids = openids.join()
                                            if(!chk_openids.match(all_viewers[vi].usr))
                                                openids.push(all_viewers[vi].usr)
                                            for (var mi in all_viewers[vi].msgs) {
                                                all_viewers[vi].msgs[mi].key = all_viewers[vi].usr
                                                all_viewers[vi].msgs[mi].nick = all_viewers[vi].nick
                                                all_viewers[vi].msgs[mi].gender = all_viewers[vi].gender
                                            }
                                            vmsgs = vmsgs.concat(all_viewers[vi].msgs)
                                        }
                                    }
                                    trans_openids = openids.splice(0, openids.length)
                                    recur_func(trans_openids, openids, function(){
                                        for (var oi in openids) {
                                            for(var ji in vmsgs) {
                                                if (vmsgs[ji].key == openids[oi].openid)
                                                    vmsgs[ji].key = openids[oi].local
                                            }
                                        }
                                        com_datas = com_datas.concat(vmsgs)
                                        com_datas.sort(function (at, bt) {
                                            var a_time = new Date(at.time)
                                            var b_time = new Date(bt.time)
                                            if (a_time < b_time)
                                                return -1
                                            else if (a_time > b_time)
                                                return 1
                                            else if (a_time == b_time)
                                                return 0
                                        })
                                        var sure_list = com_datas.splice(0, com_datas.length)
                                        sure_file(sure_list)
                                    })
                                })
                            }
                            else
                                resolve([])
                        }
                    })
                }
            })
        })
    },
    comResponse:function(asker, answer){
        var that = this
        return new Promise(function (resolve, reject){
            mydb.getConnection(function(cnn_err,conn){
                if(cnn_err)
                    reject(cnn_err)
                else{
                    var master = asker.master, c_answer = answer.identity=='master' ? 'master' : 'joiners'
                    var s_str = `SELECT ${c_answer} FROM grpsmasters WHERE master LIKE '%${master}%'`
                    conn.query(s_str, function (err, results) {
                        conn.release()
                        if (err) {//here need promote for err codes
                            var err_obj = {
                                err_reason: err,
                                err_table: 'grpsmasters',
                                openid: grp.master,
                                err_time: (new Date().getTime()),
                                old_content: 'null',
                                new_content: 'null',
                                opt_type: 'mydb.comResponse.getConnection.conn.query'
                            }
                            that.insertErrLogs(err_obj).then(function (res) {}).catch(function (err) {throw err})
                            reject(err)
                        }
                        else {
                            if(results.length) {
                                var who_responses
                                if(c_answer == 'master')
                                    who_responses = results[0].master
                                else
                                    who_responses = results[0].joiners
                                var all_response = eval('(' + who_responses + ')'), grptime = asker.grptime, comdata = []
                                for(var ii=all_response.length-1; ii>-1; ii--){
                                    var each = c_answer=='master' ? all_response[ii].sendto : all_response[ii].joiner
                                    if(each==asker.openid && all_response[ii].grptime==grptime){
                                        var e_start = new Date(all_response[ii].msgs[0].time).getTime()
                                        var t_asker = new Date(asker.endtime).getTime()
                                        if(e_start > t_asker)
                                            comdata = all_response[ii].msgs.concat(comdata)
                                        else
                                            break
                                    }
                                }
                                resolve(comdata)
                            }
                            else
                                resolve([])
                        }
                    })
                }
            })
        })
    },
    webSrcChk:function(link){
        return new Promise(function (resolve, reject){
            mydb.getConnection(function(cnn_err,conn){
                if(cnn_err)
                    reject(cnn_err)
                else{
                    conn.query("SELECT * FROM people WHERE value LIKE '%"+link+"%'", function(err, results, feilds) {
                        conn.release()
                        if (err) reject(err)
                        else if(results.length) resolve('matched')
                        else resolve('not matched')
                    })
                }
            })
        })
    },
    select_picsprops: function(time, key_value) {
        return new Promise(function (resolve, reject){
            mydb.getConnection(function(cnn_err,conn){
                if(cnn_err)
                    reject(cnn_err)
                else{
                    if(key_value != '') {
                        conn.query("SELECT * FROM pictures WHERE img_time='" + time + "' AND img_key='" + key_value + "'", function (err, results, feilds) {
                            conn.release()
                            if (err) reject(err)
                            else if (results.length) resolve(results)
                            else resolve([])
                        })
                    }
                    else{
                        conn.query("SELECT * FROM pictures WHERE img_time='" + time + "'", function (err, results, feilds) {
                            conn.release()
                            if (err) reject(err)
                            else if (results.length) resolve(results)
                            else resolve([])
                        })
                    }
                }
            })
        })
    },
    deletePeopleRow:function(user){
        return new Promise(function (resolve, reject){
            mydb.getConnection(function(cnn_err,conn){
                if(cnn_err)
                    reject(cnn_err)
                else{
                    var city = addr.city, gate = addr.gate
                    conn.query("DELETE FROM people WHERE user='"+user+"'", function(err, results, feilds) {
                        conn.release()
                        if (err) reject(err)
                        else if(results.length) resolve(results)
                        else resolve([])
                    })
                }
            })
        })
    },
    deletePictures:function(time){
        return new Promise(function (resolve, reject){
            mydb.getConnection(function(cnn_err,conn){
                if(cnn_err)
                    reject(cnn_err)
                else{
                    conn.query("DELETE FROM pictures WHERE img_time='"+time+"'", function(err, results, feilds) {
                        conn.release()
                        if (err) reject(err)
                        else if(results.length) resolve(results)
                        else resolve([])
                    })
                }
            })
        })
    },
    msgsSave: function(openid, contents, t_send, new_old){
        return new Promise(function (resolve, reject){
            mydb.getConnection(function(cnn_err,conn){
                if(cnn_err)
                    reject(cnn_err)
                else{
                    conn.query("SELECT * FROM messages WHERE openid='" + openid + "'", function (err, results) {
                        if (err) reject(err+'?mydb.msgsSave.conn.query_select')
                        else if(results.length) {
                            var old_contents = eval('('+results[0].contents+')')
                            var arr_time = JSON.parse(results[0].time)
                            if(new_old) {
                                arr_time.push(t_send)
                                old_contents.push(contents)
                            }
                            else
                                old_contents = contents
                            var s_contents = JSON.stringify(old_contents)
                            var rep_contents = s_contents.replace(/\\n/g, "\\\\n")
                                .replace(/\'/g, "\\'")
                                .replace(/\`/g, "\\`")
                                .replace(/\\r/g, "\\\\r")
                            conn.query("UPDATE messages SET contents='" + rep_contents + "',time='" + JSON.stringify(arr_time) + "' WHERE openid='" + openid + "'", function (err) {
                                if (err) reject(err+'?mydb.msgsSave.conn.query_update')
                                resolve('success save msgs')
                                conn.release()
                            })
                        }
                        else {
                            var time = [t_send]
                            var s_contents = JSON.stringify([contents])
                            var ins_contents = s_contents.replace(/\\n/g, "\\\\n")
                                .replace(/\'/g, "\\'")
                                .replace(/\`/g, "\\`")
                                .replace(/\\r/g, "\\\\r")
                            var q_str = "INSERT INTO messages (openid, contents, time) VALUES(" + "'" + openid + "'" + ", " + "'" + ins_contents + "'" + ", " + "'" + JSON.stringify(time) + "')"
                            conn.query(q_str, function (err) {
                                if (err) reject(err+'?mydb.msgsSave.conn.query_insert')
                                resolve('success save msgs')
                                conn.release()
                            })
                        }
                    })
                }
            })
        })
    },
    msgsGetting: function(openid){
        return new Promise(function (resolve, reject){
            mydb.getConnection(function(cnn_err,conn){
                if(cnn_err)
                    reject(cnn_err)
                else{
                    conn.query("SELECT * FROM messages WHERE openid='" + openid + "'", function (err, results) {
                        if (err) reject(err+'?mydb.msgsGetting.conn.query_select')
                        else if(results.length)  resolve(results[0])
                        else resolve([])
                        conn.release()
                    })
                }
            })
        })
    },
    msgsUpdate: function(openid, updates, times){
        return new Promise(function (resolve, reject){
            mydb.getConnection(function(cnn_err,conn){
                if(cnn_err)
                    reject(cnn_err)
                else{
                    conn.query("UPDATE messages SET contents='" + updates + "',time='" + times + "' WHERE openid='" + openid + "'", function (err) {
                        conn.release()
                        if (err) reject(err)
                        else resolve('success save msgs')
                    })
                }
            })
        })
    },
    loggersSave: function(logger){
        var that = this
        mydb.getConnection(function(cnn_err,conn){
            if(cnn_err) {
                var err_obj = {
                    err_reason: cnn_err,
                    err_table: 'loggers',
                    openid: logger.openid,
                    err_time: (new Date().getTime()),
                    old_content: 'null',
                    new_content: 'null',
                    opt_type: 'mydb.getConnection'
                }
                that.insertErrLogs(err_obj).then(function (res) {}).catch(function (err) {throw err})
            }
            else{
                var cur_time = new Date()
                var year = cur_time.getFullYear()
                var month = cur_time.getMonth() + 1
                var day = cur_time.getDate()
                var push_time = year.toString()+month.toString()+day.toString()
                conn.query("SELECT * FROM loggers WHERE openid='" + logger.openid + "'", function (err, results, feilds) {
                    if (err) {//here need promote for err codes
                        var err_obj = {
                            err_reason: err,
                            err_table: 'loggers',
                            openid: logger.openid,
                            err_time: (new Date().getTime()),
                            old_content: 'null',
                            new_content: 'null',
                            opt_type: 'mydb.getConnection.conn.query'
                        }
                        that.insertErrLogs(err_obj).then(function (res) {}).catch(function (err) {throw err})
                    }
                    else if (results.length) {
                        var times = results[0].times + 1
                        var arr_time = JSON.parse(results[0].time)
                        var tail_time = arr_time[arr_time.length-1]
                        if(tail_time != push_time)
                            arr_time.push(push_time)
                        var query_str = "UPDATE loggers SET times='" + times + "',time='" + JSON.stringify(arr_time) + "' WHERE openid='" + logger.openid + "'"
                        if(logger.session_key && logger.session_key!='undefined')
                            query_str = "UPDATE loggers SET times='" + times + "',time='" + JSON.stringify(arr_time) + "',localKey='" + logger.localKey + "',session_key='" + logger.session_key + "',expires_in='" + logger.expires_in + "' WHERE openid='" + logger.openid + "'"
                        conn.query(query_str, function (err) {
                            if (err) {
                                var err_obj = {
                                    err_reason: err,
                                    err_table: 'loggers',
                                    openid: logger.openid,
                                    err_time: (new Date().getTime()),
                                    old_content: 'null',
                                    new_content: 'null',
                                    opt_type: 'mydb.getConnection.conn.query_update'
                                }
                                that.insertErrLogs(err_obj).then(function (res) {
                                }).catch(function (err) {
                                    throw err
                                })
                            }
                            conn.release()
                        })
                    }
                    else {
                        var time = [push_time]
                        var times = 1
                        var q_str = "INSERT INTO loggers (openid, times, time, localKey, session_key, expires_in) VALUES(" + "'" + logger.openid + "'" + ", " + "'" + times + "'" + ", " + "'" + JSON.stringify(time) + "'" + ", " + "'" + logger.localKey + "'" + ", " + "'" + logger.session_key + "'" + ", " + "'" + logger.expires_in + "')"
                        conn.query(q_str, function (err) {
                            if (err) {
                                var err_obj = {
                                    err_reason: err,
                                    err_table: 'loggers',
                                    openid: logger.openid,
                                    err_time: (new Date().getTime()),
                                    old_content: 'null',
                                    new_content: 'null',
                                    opt_type: 'mydb.getConnection.conn.query_insert'
                                }
                                that.insertErrLogs(err_obj).then(function (res) {}).catch(function (err) {throw err})
                            }
                            conn.release()
                        })
                    }
                })
            }
        })
    },
    loggerFound: function(obj_require) {
        return new Promise(function (resolve, reject){
            mydb.getConnection(function(cnn_err,conn){
                if(cnn_err)
                    reject(cnn_err)
                else{
                    var s_str = ''
                    if(obj_require.key == 'openid')
                        s_str = 'SELECT * FROM loggers Where localKey=' + "'" + `${obj_require.value}` + "'"
                    else
                        s_str = 'SELECT * FROM loggers Where openid=' + "'" + `${obj_require.value}` + "'"
                    conn.query(s_str, function(err, results) {
                        conn.release()
                        if (err) reject(err)
                        else if(results.length) resolve(results[0])
                        else resolve('null')
                    })
                }
            })
        })
    },
    masterGetting: function(table) {
        return new Promise(function (resolve, reject){
            mydb.getConnection(function(cnn_err,conn){
                if(cnn_err)
                    reject(cnn_err)
                else{
                    var s_str = `SELECT * FROM ${table}`
                    conn.query(s_str, function(err, results) {
                        conn.release()
                        if (err) reject(err)
                        else if(results.length) resolve(results)
                        else resolve([])
                    })
                }
            })
        })
    },
    masterDelete: function(time, local, addr) {
        var that = this
        return new Promise(function (resolve, reject){
            mydb.getConnection(function(cnn_err,conn){
                if(cnn_err)
                    reject(cnn_err)
                else{
                    var s_str = `SELECT * FROM people WHERE value LIKE '%${time}%' AND value LIKE '%${local}%' AND value LIKE '%${addr}%'`
                    conn.query(s_str, function(err, results) {
                        conn.release()
                        if (err) reject(err)
                        else if(results.length) {
                            var d_vals = eval('('+results[0].value+')')
                            for(var dvi in d_vals){
                                if(d_vals[dvi].time==time && JSON.stringify(d_vals[dvi].location)==local && d_vals[dvi].address==addr){
                                    d_vals.splice(dvi, 1)
                                    break
                                }
                            }
                            var new_dvals = JSON.stringify(d_vals)
                            that.update_exec(results[0].user, new_dvals).then(function(){
                                var res_arr = []
                                res_arr.push(results[0].user)
                                res_arr.push(new_dvals)
                                resolve(res_arr)
                            }).catch(function(err){
                                if(err)
                                    reject('err for masterDelete.that.update_exec')
                            })
                        }
                        else resolve([])
                    })
                }
            })
        })
    },
    deleteTblRow: function(table, row) {
        return new Promise(function (resolve, reject){
            mydb.getConnection(function(cnn_err,conn){
                if(cnn_err)
                    reject(cnn_err)
                else{
                    var s_str = `DELETE FROM ${table} WHERE id=${row}`
                    conn.query(s_str, function(err, results) {
                        conn.release()
                        if (err) reject(err)
                        else resolve('delete success')
                    })
                }
            })
        })
    },
    insertErrLogs: function(err_obj){
	console.log(err_obj)
        return new Promise(function (resolve, reject){
            mydb.getConnection(function(cnn_err,conn){
                if(cnn_err)
                    reject(cnn_err)
                else{
                    conn.query("INSERT INTO errlog (err_reason, err_table, openid, err_time, old_content, new_content, opt_type) VALUES(" + "'" + err_obj.err_reason + "'" + ", " + "'" + err_obj.err_table + "'" + ", " + "'" + err_obj.openid + "'" + ", " + "'" + err_obj.err_time + "'" + ", " + "'" + err_obj.old_content + "'" + ", " + "'" + err_obj.new_content + "'" + ", " + "'" + err_obj.opt_type + "'" + ")", function (err){
                        conn.release()
                        if (err) reject(err)
                    })
                }
            })
        })
    }
}
