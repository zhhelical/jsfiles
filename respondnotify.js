//respondnotify.js
const crypto = require('crypto')
const xml2js = require('xml2js')
const mysql = require('../../databases/mysqldata.js')
const secure_key = '513AA201C70F1EDE03AD9F4A802745C6'
var testfunc = function(sign_obj){
    var stringA = ''
    for(var si in sign_obj)
        stringA += `&${si}=${sign_obj[si]}`
    stringA = stringA.substr(1)
    var sign = crypto.createHash('md5').update(`${stringA}&key=${secure_key}`, 'utf-8').digest('hex').toUpperCase()
    return {sign:sign, string:stringA}
}
function notifySignFunc(sign_obj){
    var stringA = ''
    for(var si in sign_obj)
        stringA += `&${si}=${sign_obj[si]}`
    stringA = stringA.substr(1)
    var sign = crypto.createHash('md5').update(`${stringA}&key=${secure_key}`, 'utf-8').digest('hex').toUpperCase()
    return {sign:sign, string:stringA}
}
function forNotifySuccess(){
    var xml_success = `<xml>
                         <return_code><![CDATA[SUCCESS]]></return_code>
                         <return_msg><![CDATA[OK]]></return_msg>
                       </xml>`
    return xml_success
}
function forNotifyFail(){
    var xml_fail = `<xml>
                       <return_code><![CDATA[FAIL]]></return_code>
                       <return_msg><![CDATA[签名失败]]></return_msg>
                    </xml>`
    return xml_fail
}
module.exports = {
    dealXmlBody: function(info, cb){
        var xmlparser = new xml2js.Parser({explicitArray : false, ignoreAttrs : true})
        xmlparser.parseString(info, function (err, result) {
            if(err)
                cb(forNotifyFail())
            else{
                var xml_obj = result.xml
                var old_sign = ''
                for(var xi in xml_obj){
                    if(xi == 'sign'){
                        old_sign = xml_obj[xi]
                        break
                    }
                }
                delete xml_obj.sign
                var notify_sign = notifySignFunc(xml_obj)
                if(notify_sign.sign != old_sign){
                    cb(forNotifyFail())
                    return
                }
                xml_obj.sign = old_sign
                mysql.insert_pays(xml_obj).then(function (result) {
                    cb(forNotifySuccess())
                }).then(function (result) {
                    cb(forNotifyFail())
                })
            }
        })

    }
}
