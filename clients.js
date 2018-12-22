 //clients.js
 const co = require('co')
 const mysql = require('../../../databases/mysqldata.js')
 const redis = require('../../../databases/rediscache.js')
 const shell = require('./shell.js')
 var clientsArray = [], j_conn = []
 function reqGetHeadImage(ukey, cb){
     var mysqlpic = require('../../databases/mysqlpics.js')
     mysqlpic.usrhead_pic(ukey).then(function(pic){
         if(pic.length)
             cb(pic[0].img_name)
         else
             cb('not in db')
     }).catch(function(res_err){
         if(res_err) {
             joiners.appOptErr('null', ukey, `${res_err}`, 'app.reqGetHeadImage', 'pictures', 'null', 'null')
             cb('get pic fail')
         }
     })
 }
 function getUsrImg(usr, url, result, cb){
     var options = {
         method: 'GET',
         url: url,
         encoding: 'binary',
         headers:{
             'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:46.0) Gecko/20100101 Firefox/46.0'
         }
     }, http = require("http-request"), file = require("fs"), imginfo = require('imageinfo')
     http.get(options, `../../uploads/${result}`, function (err, res) {
         if (err)
             cb('wrong url')
         else {
             var f_info = file.readFileSync(`../../uploads/${result}`)
             var img_info = imginfo(f_info)
             var size = file.statSync(`../../uploads/${result}`).size
             var values = {
                 img_time: 'uhimg',
                 img_key: usr,
                 img_size: img_info.width + '?&' + img_info.height + '?&' + size,
                 img_pos: 0,
                 img_local: url,
                 img_name: result
             }, mysqlpics = require('../../databases/mysqlpics.js')
             var ins_fun = function(ins_pic){
                 mysqlpics.insert_pic(ins_pic).then(function () {
                     return cb(result)
                 }).catch(function (err) {
                     if(err)
                         ins_fun(ins_pic)
                 })
             }
             ins_fun(values)
         }
     })
 }
 module.exports = {
     getUsrImg:getUsrImg,
     findByKey: function(localkey){
         if(!localkey)
             return null
         for(var who in clientsArray){
             if(clientsArray[who].key.localKey == localkey)
                 return clientsArray[who]
         }
         return null
     },
     findEvent:function(relation){
         for(var who in clientsArray){
             if(clientsArray[who].line == relation)
                 return clientsArray[who].key
         }
         return null
     },
     updateConn: function(localkey, new_conn){
         var cli = this.findByKey(localkey)
         if(cli) {
             if(cli.line){
                 cli.line.removeAllListeners()
                 cli.line.terminate()
                 cli.line = null
             }
             cli.line = new_conn
         }
     },
     recordsExpired: function(recorder){
         var cur_time = new Date(), current_mseconds = cur_time.getTime(), time_expire = 31104000000
         var that = this
         var r_openid = JSON.parse(recorder)
         redis.getCacheValue(recorder).then(function (val) {
             var cache_objs = eval('('+val+')')
             var cache_dels = []
             for(var ti in cache_objs){
                 if(ti == 0)
                     continue
                 var obj_time = new Date(cache_objs[ti].time)
                 var rec_time = obj_time.getTime()
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
                     for(var di in cache_dels){
                         var d_index = cache_objs.indexOf(cache_dels[di])
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
     msgAutoReply: function(messager, t_send){
         var that = this
         setTimeout(function(){
             mysql.msgsGetting(messager).then(function (res) {
                 var times = JSON.parse(res.time)
                 var t_pos = 0
                 for(var ti in times){
                     if(times[ti] == t_send){
                         t_pos = ti
                         break
                     }
                 }
                 var contents = eval('('+res.contents+')')
                 for(var ci in contents){
                     if(ci == t_pos){
                         var str_reply = '感谢您的批评指导或意见，我们会竭力优化我们对您的服务，希望您常来，再次感谢您'
                         contents[ci].reply = str_reply
                         break
                     }
                 }
                 mysql.msgsSave(messager, contents, t_send, false).then(function(s_res){}).then(function(err){
                     if (err)
                         that.appOptErr(messager, null, `${err}`, 'clients.msgAutoReply.mysql.msgsSave', 'messages', 'null', t_send)
                 })
             }).catch(function (err) {
                 if(err)
                     that.appOptErr(messager, null, `${err}`, 'clients.msgAutoReply.mysql.msgsGetting', 'messages', 'null', t_send)
             })
         },1800000)
     },
     asynDelPics: function(d_array, openid){
         if(!d_array.length)
             return
         var that = this
         var img_time = d_array[0]
         if(typeof(d_array[0])=='object')
             img_time = d_array[0].time
         mysql.select_picsprops(img_time, '').then(function(s_res){
             mysql.deletePictures(img_time).then(function (d_res) {}).catch(function (err) {
                 if (err)
                     joiners.appOptErr(key_id.openid, null, `${err}`, 'clients.*.mysql.deletePictures', 'pictures', img_time, 'null')
             })
             var shell_asyn = function (f_names) {
                 if (!f_names.length) {
                     d_array.splice(0, 1)
                     that.asynDelPics(d_array, openid)
                 }
                 else {
                     var f_name = f_names[0]
                     var sh_order = `rm -rf ${f_name}`
                     shell.shellFunc(sh_order).then(function (result) {
                         f_names.splice(0, 1)
                         shell_asyn(f_names)
                     }).catch(function (err) {
                         if (err)
                             that.appOptErr(openid, null, err, `asynDelPics.shell_asyn(${f_names})`, `${f_name}`, `${f_name}`, 'null')
                     })
                 }
             }
             var filenames = []
             for (var ri in s_res) {
                 var rpic_name = s_res[ri].img_name
                 if (!rpic_name.match('/'))
                     rpic_name = '/data/release/helical/uploads/' + rpic_name
                 filenames.push(rpic_name)
             }
             shell_asyn(filenames)
         }).catch(function(err) {
             if(err)
                 that.appOptErr(openid, null, err, `asynDelPics.mysql.select_picsprops(${img_time}, null)`, 'pictures', `img_time=${img_time}`, 'null')
         })
     },
     delExpiredMsgs: function(oid, c_time){
         mysql.msgsGetting(oid).then(function(m_res){
             if(m_res.length) {
                 var id_msgs = eval('(' + m_res.contents + ')')
                 var times = JSON.parse(m_res.time)
                 var del_arr = []
                 for (var ti in times) {
                     if ((c_time - times[ti]) >= 7776000000)
                         del_arr.push(ti)
                 }
                 if (del_arr.length) {
                     for (var i = del_arr.length - 1; i > -1; i--) {
                         for (var mi = id_msgs.length - 1; mi > -1; mi--) {
                             if (mi == i) {
                                 id_msgs.splice(mi, 1)
                                 times.splice(mi, 1)
                                 break
                             }
                         }
                     }
                     var up_msgs = JSON.stringify(id_msgs), up_times = JSON.stringify(times)
                     mysql.msgsUpdate(oid, up_msgs, up_times).then(function (u_res) {
                     }).catch(function (err) {
                         if (err)
                             that.appOptErr(oid, 'null', err, `delExpiredMsgs.*.mysql.msgsUpdate(${c_time})`, 'messages', 'null', `${up_msgs}/${up_times}`)
                     })
                 }
             }
         }).catch(function(err){
             if(err)
                 that.appOptErr(oid, 'null', err, `delExpiredMsgs.mysql.msgsGetting(${c_time})`, 'messages', `del_time=${c_time}`, 'null')
         })
     },
     chkOnlines: function(whoes){
         var onlines = this.clientsArray, w_onlines = []
         for(var wi in onlines){
             if(whoes.join().match(onlines[wi].key.localKey))
                 w_onlines.push(onlines[wi].key.localKey)
         }
         return w_onlines
     },
     communicationHandup: function(who, handfrom){
         var onlines = this.clientsArray
         for(var wi in onlines){
             if(onlines[wi].key.localKey == who){
                 if(!onlines[wi].handup)
                     onlines[wi].handup = [handfrom]
                 else{
                     var found = false
                     for(var hi in onlines[wi].handup){
                         if(onlines[wi].handup[hi] == handfrom){
                             found = true
                             break
                         }
                     }
                     if(!found)
                         onlines[wi].handup.push(handfrom)
                 }
                 return true
             }
         }
         return null
     },
     communicationGet: function(getter){
         var onlines = this.clientsArray
         for(var wi in onlines){
             if(onlines[wi].handup && onlines[wi].key.localKey==getter) {
                 var chk_handups = onlines[wi].handup
                 for(var hi=chk_handups.length-1; hi>-1; hi--){
                     if(!JSON.stringify(onlines).match(chk_handups[hi]))
                         chk_handups.splice(hi, 1)
                 }
                 return onlines[wi].handup
             }
         }
         return []
     },
     appOptErr: function(w_openid, w_localkey, reason, option, w_table, opt_val, optnew_val){
         var c_openid = ''
         var that = this
         if(!w_openid){
             var cli = that.findByKey(w_localkey)
             if(cli)
                c_openid = cli.key.openid
         }
         else
             c_openid = w_openid
         var err_obj = {
             err_reason: reason,
             err_table: w_table,
             openid: c_openid,
             err_time: (new Date().getTime()),
             old_content: opt_val,
             new_content: optnew_val,
             opt_type: option
         }
         mysql.insertErrLogs(err_obj).then(function (res) {}).catch(function (err) {throw err})
     }
 }