//config.js
var path = require('path');

var OPTIONS = {
    targetDir: function (app) {
        return path.join(app.get('rootDir'), 'img');
    },
    read: {
        name: '<<图片服务器(读取)>>',
        port: 3000,
        'default': 'default.jpg',
        sizeReg: /(\w+)-(\d+)-(\d+)\.(\w+)$/
    },
    save: {
        name: '<<图片服务器(保存)>>',
        port: 9990
    },
    mode: 'read',
    contentType: {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'png': 'image/png'
    }
};

module.exports = function (rootDir, app) {
    app.set('rootDir', rootDir);

    var $ = require('underscore');
    $.each(OPTIONS, function (v, k) {
        app.set(k, typeof v === 'function' ? v(app) : v);
    });

    app.use(require('body-parser')())
};