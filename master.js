 //master.js
 const co = require('co')
 const file = require("fs")
 const mysql = require('../../../databases/mysqldata.js')
 const joiners = require('./clients.js')
 const shell = require("./shell.js")
 const fetchWebSrc = require("./fetchweb.js")
 const generatorlinks = require("./readdledfs.js")
 const generatorobjs = require("./readfs.js")
 const generatorimgs = require("./downloadimgs.js")
 const txgeo = require('./txgeo.js')
 const m_openid = 'oSej50L7Zswj9TVllkJ0O68FJv2s'
 var getAllSubmits = function(cb){
     mysql.masterGetting('people').then(function (result) {
         if (result && result.length)
             cb({bool:true, value:result})
         else {
             joiners.appOptErr(m_openid, null, 'empty', 'master.getAllSubmits.mysql.masterGetting', 'messages', 'null', 'null')
             cb({bool:false, value:'empty'})
         }
     }).then(function(err){
         if (err) {
             joiners.appOptErr(m_openid, null, `${err}`, 'master.getAllSubmits.mysql.masterGetting', 'people', 'null', 'null')
             cb({bool:false, value:'system wrong'})
         }
         throw(err)
     })
 }
 var getAllMsgs = function(cb){
     mysql.masterGetting('messages').then(function (result) {
         if (result && result.length)
             cb({bool:true, value:result})
         else{
             joiners.appOptErr(m_openid, null, 'empty', 'master.getAllMsgs.mysql.masterGetting', 'messages', 'null', 'null')
             cb({bool:false, value:'empty'})
         }
     }).then(function(err){
         if (err) {
             joiners.appOptErr(m_openid, null, `${err}`, 'master.getAllMsgs.mysql.masterGetting', 'messages', 'null', 'null')
             cb({bool: false, value: 'system wrong'})
         }
         throw(err)
     })
 }

 module.exports = {
     id_master: m_openid,
     getSuitableSubmits: function(from){
         return new Promise(function (resolve, reject){
             getAllSubmits(function(s_res){
                 if (s_res.bool){
                     var l_res = s_res.value.length-from
                     var sql_arr = s_res.value
                     var re_arr = []
                     if(l_res > 60)
                         re_arr = sql_arr.slice(from, from + 60)
                     else
                         re_arr = sql_arr.slice(from)
                     var res_arr = []
                     for(var mi in re_arr) {
                         var arr_vals = eval('('+re_arr[mi].value+')')
                         arr_vals.splice(0, 1)
                         var res_obj = {localKey:JSON.parse(re_arr[mi].user).localKey, value:arr_vals}
                         res_arr.push(res_obj)
                     }
                     resolve(res_arr)
                 }
                 else
                     reject('no recs')
             })
         })
     },
     getSuitableMsgs: function(from){
         return new Promise(function (resolve, reject){
             getAllMsgs(function(m_res){
                 if (m_res.bool){
                     var l_res = m_res.value.length-from
                     var sql_arr = m_res.value
                     var re_arr = []
                     if(l_res > 60)
                         re_arr = m_res.value.slice(from, from + 60)
                     else
                         re_arr = m_res.value.slice(from)
                     var res_arr = []
                     for(var mi in re_arr){
                         var ev_obj = {}
                         ev_obj.contents = eval('('+re_arr[mi].contents+')')
                         ev_obj.time = JSON.parse(re_arr[mi].time)
                         res_arr.push(ev_obj)
                     }
                     resolve(res_arr)
                 }
                 else
                     reject(null)
             })
         })
     },
     startWebIndexesFetch: function(){
         fetchWebSrc.webIndexesFetch()
     },
     startGenWebLinks: function(){
         generatorlinks.genWebLinks()
     },
     startGenWebObjs: function(){
         generatorobjs.webPagesFetch()
     },
     startGenWebImgs: function(){
         generatorimgs.genWebImgs()
     },
     stopWebFetch: function(){
         fetchWebSrc.stopWebAction()
         generatorobjs.stopWebAction()
         generatorimgs.stopWebAction()
     }
 }
 /*fetchWebSrc.digWebSrc({longitude:125.27561, latitude:43.83052}, 'tapGates', 10000, function(res){
     console.log(`finished for client search ${res}`)
 })*/
