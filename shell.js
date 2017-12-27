//shell.js

var proc = require('child_process')
    , co = require('co')

module.exports = {
    shellFunc: function(command) {
                    return new Promise(function (resolve, reject){
                        proc.exec(command, function(error, data){
                            if (error) reject(error);
                            else resolve(data);
                        })
                    })
                }
}

