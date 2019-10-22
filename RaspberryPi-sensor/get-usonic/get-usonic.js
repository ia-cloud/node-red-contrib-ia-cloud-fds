module.exports = function(RED) {
    "use strict";
    var rpio = require('rpio');

    function GetUsonic(config) {
        RED.nodes.createNode(this,config);
        this.name = config.neme;
        this.user = config.user;
        var user = this.user;
        var node = this;
        var RepeatFlag = config.repeat;
        var dmsg = { _msgid: '', topic: '', payload: '' };  //dummy msg

        // 稼働状況を保持するオブジェクト
        var RepInfo = {
            status: '',
            RoopInterval: config.interval,      //roop interval
            init: false                         //繰り返し初回は全体準備のため取得をパスする
        };

        var i = 0;

        //interval validation check
        if(RepInfo.RoopInterval.search(/^[0-9]+$/) != 0){
            RepInfo.RoopInterval = 60000;
        }

        if(RepeatFlag == true){
            RepInfo.status = 'on';
            node.status({fill:"green",shape:"ring",text:"繰返し取得開始処理中"});
        } else {
            RepInfo.status = 'off';
            node.status({fill:"red",shape:"dot",text:"繰返し取得:Off"});
        }

        //繰り返し取得実行ファンクション
        (function roopGetUsonic() {
            if(RepInfo.init == false){      //全体の初期化待ち
                RepInfo.init = true;
                setTimeout(roopGetUsonic, 5000);
            } else if(RepInfo.status == 'on'){
                //console.log(RepInfo.RoopInterval);
                node.status({fill:"blue",shape:"dot",text:"取得中"});
                GetUsonicData(dmsg);
                node.status({fill:"green",shape:"dot",text:"繰返し取得:On"});
                setTimeout(roopGetUsonic, RepInfo.RoopInterval);
            }
        }());

        //イベント：msg入力が取得トリガー
        node.on('input', function(msg) {
            node.status({fill:"blue",shape:"dot",text:"取得中"});
            GetUsonicData(msg);
            if(RepInfo.status == 'on'){
                node.status({fill:"green",shape:"dot",text:"繰返し取得:On"});
            } else {
                node.status({fill:"red",shape:"dot",text:"繰返し取得:Off"});

            }
        });

        //終了処理
        node.on("close",function() {
            RepInfo.status = "off";
            node.status({fill:"red",shape:"dot",text:"繰返し取得:Off"});
        });

        //センサーデータ取得ファンクション
        function GetUsonicData(msg){


            var dateformat = require('dateformat');
            var date = new Date();
            var timestamp = dateformat(date, 'isoDateTime');


            var dist;
            dist = GetUsonicDist();　//超音波距離測定センサーから距離データ取得

            msg = {
                "request": "store",
                "dataObject": {
                    "objectType" : "iaCloudObject",
                    "objectKey" : "rmc-iot-santama." + user + ".sensors" ,
                    "objectDescription" : "センサーの値",
                    "timeStamp" :  timestamp,
                    "ObjectContent" : {
                        "contentType": "com.ia-cloud.contenttype.hackathon2017.temp01",
                        "contentData":[{
                            "commonName": "Column1",
                            "dataName": "CTセンサーダミー",
                            "dataValue": 0,
                            "unit": "V"
                        },{
                            "commonName": "Column2",
                            "dataName": "超音波センサー",
                            "dataValue": dist,
                            "unit": "cm"
                        },{
                            "commonName": "Column3",
                            "dataName": "ダミー",
                            "dataValue": 0,
                            "unit": "value"
                        },{
                            "commonName": "Column4",
                            "dataName": "ダミー",
                            "dataValue": 0,
                            "unit": "value"
                        },{
                            "commonName": "Column5",
                            "dataName": "ダミー",
                            "dataValue": 0,
                            "unit": "value"
                        },{
                            "commonName": "Column6",
                            "dataName": "ダミー",
                            "dataValue": 0,
                            "unit": "value"
                        }]
                    }
                }
                
            }
            node.send(msg);

            //超音波距離測定センサーデータ取得ファンクション
            function GetUsonicDist(){

                var TRIG_PIN = 12; // GPIO18
                var ECHO_PIN = 16; // GPIO23
                
                var startTime;
                var diff;
                var nsDiff;
                var distance;
        
                rpio.open(TRIG_PIN, rpio.OUTPUT, rpio.LOW);
                rpio.open(ECHO_PIN, rpio.INPUT, rpio.LOW);
        
                rpio.msleep(300)
        
                rpio.write(TRIG_PIN,rpio.HIGH);
                rpio.usleep(0.011)
                rpio.write(TRIG_PIN,rpio.LOW);
        
        
        
                while(rpio.read(ECHO_PIN)==rpio.LOW){
                    startTime = process.hrtime();
                }
                while(rpio.read(ECHO_PIN)==rpio.HIGH){
                    diff = process.hrtime(startTime);
                }
        
                //音速=340[m/s] = 34000[cm/s] = 0.034[cm/μs] =0.000034[cm/ns]
                nsDiff = diff[0] * 1e9 + diff[1];
                distance = nsDiff * 0.000017;
        
                rpio.close(TRIG_PIN);
                rpio.close(ECHO_PIN);
        
                return distance;
        
            }
        

        }
    }
    RED.nodes.registerType('get-usonic',GetUsonic);
}

