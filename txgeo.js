//txgeo.js
var http = require("http"),
    Url = require("url"),
    querystring = require('querystring'),
    require_limit = 5,
    limit_timer = 0,
    initSetting = function(lta, s_info){
        var settings = {
            beforeSend: function(req){req.end()},
            complete: function(req){req.end()},
            timeout: 10,
            type: 'get',
            url: 'http://apis.map.qq.com/ws/geocoder/v1',
            dataType: 'json',
            data: {
                key: "7RBBZ-VBF2W-T4ARX-OEVXO-VJTQ5-P7FO2",
                location: '',
                coord_type: "1",
                output: "json"
            },
            success: function (data) {
                if (data.status == 0) {
                    var res_data
                    if(lta)
                        res_data = data.result.address
                    else
                        res_data = data.result.location
                    return res_data
                } else {
                    return '系统错误，请联系管理员！'
                }
            },
            error: function () {
                return '系统错误，请联系管理员！'
            }
        }
        if(!lta){
            settings.url = 'http://apis.map.qq.com/ws/geocoder/v1/?address='
            settings.data = {key: "7RBBZ-VBF2W-T4ARX-OEVXO-VJTQ5-P7FO2", address:s_info}
        }
        else
            settings.data.location = `${s_info.latitude},${s_info.longitude}`
        return settings
    },
    localToAddr = function(location, cb){
        var settings = initSetting(true, location)
        var params = Url.parse(settings.url, true)
        var options = {
            host: params.hostname,
            port: params.port || 80,
            path: params.path+`/?location=${settings.data.location}&key=${settings.data.key}&get_poi=1`,
            method: settings.type
        }
        var req = http.request(options, function(res) {
            var data = ''
            res.on('data', function(chunk){
                data += chunk
            }).on('end', function(){
                if(	settings.dataType === "json" ){
                    try{
                        data = JSON.parse(data);
                    }catch(e){
                        data = null
                    }
                }
                cb(settings.success(data))
                settings.complete(req)
            })
        }).on('error', function(e) {
            if(e) {
                cb('error')
                req.abort()
            }
        })
        if( typeof settings.beforeSend === "function" ){
            if ( !settings.beforeSend(req) ){
                settings.complete(req)
                req.end()
                return false
            }
        }
        if( settings.type === "POST" ){
            req.write(querystring.stringify(settings.data))
        }
        req.setTimeout(settings.timeout)
        req.end()
    },
    addrToLocal = function(addr, cb){
        limit_timer++
        if(limit_timer > 5){
            return cb('系统错误，请联系管理员！')
        }
        var settings = initSetting(false, addr)
        var params = Url.parse(settings.url, true)
        var options = {
            host: params.hostname,
            port: params.port || 80,
            path: encodeURI(params.path+`${settings.data.address}&key=${settings.data.key}`),
            method: settings.type
        }
        var req = http.request(options, function(res) {
            var data = ''
            res.on('data', function(chunk){
                data += chunk
            }).on('end', function(){
                if(	settings.dataType === "json" ){
                    try{
                        data = JSON.parse(data);
                    }catch(e){
                        data = null
                    }
                }
                cb(settings.success(data))
                settings.complete(req)
            })
        }).on('error', function(e) {
            if(e) {
                cb('error')
                req.abort()
            }
        })
        if( typeof settings.beforeSend === "function" ){
            if ( !settings.beforeSend(req) ){
                settings.complete(req)
                req.end()
                return false
            }
        }
        if( settings.type === "POST" ){
            req.write(querystring.stringify(settings.data))
        }
        req.setTimeout(settings.timeout)
        req.end()
    }

module.exports = {
    findLocalAddr: localToAddr,
    findAddrLocal: addrToLocal
}