//payunits.js
const request = require('request')
const shell = require('./shell.js')
const crypto = require('crypto')
const appid = 'wxf9a75ea1c3517fbe'
const mch_id = '1434433402'
const secure_key = '513AA201C70F1EDE03AD9F4A802745C6'
const h_ip = '123.206.74.66'
const desc_company = '支付'//new
const companypay_url = 'https://api.mch.weixin.qq.com/mmpaymkttransfers/promotion/transfers'
const fee_multi = 100 //add here for stable version
/*商户账号appid mch_appid 是 wx8888888888888888 String 微信分配的账号ID（企业号corpid即为此appId） amount appid check_name desc mchid nonce_str openid partner_trade_no spbill_create_ip
商户号 mchid 是 1900000109 String(32) 微信支付分配的商户号

随机字符串 nonce_str 是 5K8264ILTKCH16CQ2502SI8ZNMTM67VS String(32) 随机字符串，不长于32位
签名 sign 是 C380BEC2BFD727A4B6845133519F3AD6 String(32) 签名，详见签名算法 //for second
商户订单号 partner_trade_no 是 10000098201411111234567890 String 商户订单号，需保持唯一性
(只能是字母或者数字，不能包含有符号)
用户openid openid 是 oxTWIuGaIt6gTKsQRLau2M0yL16E String 商户appid下，某用户的openid
校验用户姓名选项 check_name 是 FORCE_CHECK String NO_CHECK：不校验真实姓名 FORCE_CHECK：强校验真实姓名

金额 amount 是 10099 int 企业付款金额，单位为分
企业付款描述信息 desc 是 理赔 String 企业付款操作说明信息。必填。
Ip地址 spbill_create_ip 是 192.168.0.1 String(32) 调用接口的机器Ip地址*/

var sign_random = function(cb){
    var linux_random = 'head /dev/urandom | tr -dc A-Za-z0-9 | head -c 32'
    shell.shellFunc(linux_random).then(function (result){
        cb(result)
    }).catch(function(err){
        if(err)
            cb('err for sign random')
    })
}
var number_random = function(cb){
    var linux_random = 'head /dev/urandom | tr -dc 0-9 | head -c 20'
    shell.shellFunc(linux_random).then(function (result){
        cb(result)
    }).catch(function(err){
        if(err)
            cb('err for sign random')
    })
}
var firstCompanyPaySign = function(s_id, cny, cb){
    sign_random(function(res){
        if(res != 'err for sign random'){
            number_random(function(nres){
                if(nres != 'err for sign random'){
                    var stringA = `amount=${cny*fee_multi}&appid=${appid}&check_name=NO_CHECK&desc=${desc_company}&mchid=${mch_id}&nonce_str=${res}&openid=${s_id}&partner_trade_no=${nres}&spbill_create_ip=${h_ip}`
                    var sign = crypto.createHash('md5').update(`${stringA}&key=${secure_key}`, 'utf-8').digest('hex').toUpperCase()
                    cb({random:res, nrandom:nres, sign:sign})
                }
                else
                    cb({random:'number_random err for sign', sign:''})
            })
        }
        else
            cb({random:'err for sign', sign:''})
    })
}
var companyPayPerson = function(pay_id, cny, cb){
    firstCompanyPaySign(pay_id, cny, function(res){
        var xmlbody = `<xml>
                       <mch_appid>${appid}</mch_appid>
                       <mchid>${mch_id}</mchid>
                       <nonce_str>${res.random}</nonce_str> 
                       <partner_trade_no>${res.nrandom}</partner_trade_no> 
                       <openid>${pay_id}</openid>
                       <check_name>NO_CHECK</check_name>
                       <amount>${cny*fee_multi}</amount>
                       <desc>${desc_company}</desc>
                       <spbill_create_ip>${p_id}</spbill_create_ip>
                       <sign>${res.sign}</sign>
                   </xml>`
        cb(xmlbody)
    })
}

module.exports = {
    helicalPayPerson:function(openid, cny, cb){
        companyPayPerson(openid, cny, function(res){
            var options = {url: companypay_url, method: 'POST', body: res, headers:{"Connection":"Keep-Alive", "Content-Type":'application/xml;charset=utf-8', "Content-length":res.length}}
            request(options, function(error, response, body){
                if (!error && response.statusCode == 200)
                    cb('success')
                else
                    cb('failed')
            })
        })
    }
}