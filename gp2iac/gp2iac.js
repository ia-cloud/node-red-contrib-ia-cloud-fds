module.exports = function(RED) {
    "use strict";

    function Gp2iac(config) {
        RED.nodes.createNode(this,config);
        this.name = config.neme;
        this.user = config.user;
        this.sensortype = config.sensortype;
        var user = this.user;
        var sensortype = this.sensortype;
        var node = this;
        var dataname = new Array(3);
        var datavalue = new Array(3);
        var unit = new Array(3);

        //イベント：msg入力が取得トリガー
        node.on('input', function(msg) {
            if(sensortype == "dht11"){
                dataname[0] = "temperature";
                dataname[1] = "humidity";
                dataname[2] = "heatIndex";
                datavalue[0] = msg.payload.temperature;
                datavalue[1] = msg.payload.humidity;
                datavalue[2] = msg.payload.heatIndex;
                unit[0] = "℃";
                unit[1] = "%";
                unit[2] = "HI";
            }else if(sensortype == "button"){
                dataname[0] = "button";
                datavalue[0] = msg.payload;
                unit[0] = "is_pressed";
                dataname[1] = "dummy";
                datavalue[1] = 0;
                unit[1] = "value";
                dataname[2] = "dummy";
                datavalue[2] = 0;
                unit[2] = "value";
            }else{
                dataname[0] = "ultrasonic";
                datavalue[0] = msg.payload;
                unit[0] = "cm";
                dataname[1] = "dummy";
                datavalue[1] = 0;
                unit[1] = "value";
                dataname[2] = "dummy";
                datavalue[2] = 0;
                unit[2] = "value";
            }
            Gp2iacMsg(msg);
        });

        //変換ファンクション
        function Gp2iacMsg(msg){

            var dateformat = require('dateformat');
            var date = new Date();
            var timestamp = dateformat(date, 'isoDateTime');

            msg = {
                "request": "store",
                "dataObject": {
                    "objectType" : "iaCloudObject",
                    "objectKey" : "ia-cloud-Node-Red-HandsOn." + user + "." + sensortype ,
                    "objectDescription" : "センサーの値",
                    "timeStamp" :  timestamp,
                    "ObjectContent" : {
                        "contentType": "iaCloudData",
                        "contentData":[{
                            "dataName": dataname[0],
                            "dataValue": datavalue[0],
                            "unit": unit[0]
                        },{
                            "dataName": dataname[1],
                            "dataValue": datavalue[1],
                            "unit": unit[1]
                        },{
                            "dataName": dataname[2],
                            "dataValue": datavalue[2],
                            "unit": unit[2]
                        }]
                    }
                }
                
            }
            node.send(msg);
        }
    }
    RED.nodes.registerType('gp2iac',Gp2iac);
}

