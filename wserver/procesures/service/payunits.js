//payunits.js

const shell = require('./shell.js')
const crypto = require('crypto')
const appid = 'wxf9a75ea1c3517fbe'
const mch_id = '1434433402'
const secure_key = '513AA201C70F1EDE03AD9F4A802745C6'
const h_ip = '140.143.45.232'
const notify_url = 'https://helicalzh.la/wxnotify'
const web_url = 'https://api.mch.weixin.qq.com/pay/unifiedorder'
const fee_multi = 100 //add here for stable version

var sign_random = function(cb){
    var linux_random = 'head /dev/urandom | tr -dc A-Za-z0-9 | head -c 32'
    shell.shellFunc(linux_random).then(function (result){
        cb(result)
    }).catch(function(err){
        if(err)
            cb('err for sign random')
    })
}
var firstSignFunc = function(s_id, order, h_goods, cny, cb){
    sign_random(function(res){
        if(res != 'err for sign random'){
            var stringA = `appid=${appid}&body=h_goods&mch_id=${mch_id}&nonce_str=${res}&notify_url=${notify_url}&openid=${s_id}&out_trade_no=${order}&spbill_create_ip=${h_ip}&total_fee=${cny*fee_multi}&trade_type=JSAPI`
            var sign = crypto.createHash('md5').update(`${stringA}&key=${secure_key}`, 'utf-8').digest('hex').toUpperCase()
            cb({random:res, csStrs:stringA, sign:sign})
        }
        else
            cb({random:'err for sign', sign:''})
    })

}
var secondSignFunc = function(pay_id, seconds, cb){
    sign_random(function(res){
        if(res != 'err for sign random'){
            var stringB = `appId=${appid}&nonceStr=${res}&package=${pay_id}&signType=MD5&timeStamp=${seconds}`
            var sign = crypto.createHash('md5').update(`${stringB}&key=${secure_key}`, 'utf-8').digest('hex').toUpperCase()
            cb({random:res, sign:sign})
        }
        else
            cb({random:'err for sign', sign:''})
    })

}
function payCustomerSign(openid, seconds, price, cb){
    sign_random(function(res){
        if(res != 'err for sign random'){
            var stringA = `amount=${price*fee_multi}&check_name=NO_CHECK&desc=paycustomer&mch_appid=${appid}&mchid=${mch_id}&nonceStr=${res}&openid=${openid}&partner_trade_no=helical${seconds}&spbill_create_ip=${h_ip}`
            var sign = crypto.createHash('md5').update(`${stringA}&key=${secure_key}`, 'utf-8').digest('hex').toUpperCase()
            cb({random:res, sign:sign})
        }
        else
            cb({random:'err for sign', sign:''})
    })
}
function payCustomer(openid, seconds, price, cb){
    payCustomerSign(openid, seconds, price, function(res){
        if(res.random != 'err for sign') {
            var xmlbody = `<xml>
                                <amount>${price*fee_multi}</amount>
                                <check_name>NO_CHECK</check_name>
                                <desc>paycustomer</desc>
                                <mch_appid>${appid}</mch_appid>
                                <mchid>${mch_id}</mchid>                             
                                <nonce_str>${res.random}</nonce_str>
                                <openid>${openid}</openid> 
                                <partner_trade_no>helical${seconds}</partner_trade_no> 
                                <spbill_create_ip>${h_ip}</spbill_create_ip>
				<sign>${res.sign}</sign>
                            </xml>`
            cb({url: 'https://api.mch.weixin.qq.com/mmpaymkttransfers/promotion/transfers', method: 'POST', body: xmlbody, headers:{"Connection":"Keep-Alive", "Content-Type":'application/xml;charset=utf-8', "Content-length":xmlbody.length}})
        }
        else
            cb(null)
    })
}
module.exports = {
    payCustomer:payCustomer,
    options: function(p_id, order, h_goods, cny, cb){
        var that = this
        firstSignFunc(p_id, order, h_goods, cny, function(r_sign){
            if(r_sign.random != 'err for sign') {
                var xmlbody = `<xml>
                                <appid>${appid}</appid>
                                <body>h_goods</body>
                                <mch_id>${mch_id}</mch_id>
                                <nonce_str>${r_sign.random}</nonce_str> 
                                <notify_url>${notify_url}</notify_url> 
                                <out_trade_no>${order}</out_trade_no>
                                <spbill_create_ip>${h_ip}</spbill_create_ip>
                                <total_fee>${cny*fee_multi}</total_fee>
                                <trade_type>JSAPI</trade_type>
                                <openid>${p_id}</openid>
                                <sign>${r_sign.sign}</sign>
                                </xml>`
                var options = {url: web_url, method: 'POST', body: xmlbody, headers:{"Connection":"Keep-Alive", "Content-Type":'application/xml;charset=utf-8', "Content-length":xmlbody.length}}
                cb({value: options})
            }
            else
                cb(null)
        })
    },
    helicalOrder: function(g_id, o_time){
        var h_order = `${g_id}${o_time}`
        return h_order
    },
    helicalGoods: function(type, price){//cut it after spring festival
        var gen_goods = `<![CDATA[{"goods_detail":[{
                    "goods_id":type,
                    "good_name":'helical',
                    "quantity":1,
                    "price":price}]
        }]]>`
        return gen_goods
    },
    genSecondsSign:function(p_id, seconds, cb){
        var rep_id = 'prepay_id='+p_id
        var sec_str = `${seconds}`
        secondSignFunc(rep_id, sec_str, function(s_res){
            if(s_res.random != 'err for sign')
                cb(s_res)
            else
                cb(null)
        })
    }
}
