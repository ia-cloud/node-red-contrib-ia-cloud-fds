module.exports = function(RED) {
    function GetUsonic(config) {
        RED.nodes.createNode(this,config);
        this.name = config.neme;
        this.user = config.user;
        var node = this;

        node.on('input', function(msg) {

            var rpio = require('rpio');
            var repeat = 1;
            var sleepMsec = 100; 
            var count = 0;

            var dateformat = require('dateformat');
            var now = new Date();
            //var timestamp = msg.payload;
            var DTime = dateformat(now, 'isoDateTime');
            var dist;

            for(count = 0; count < repeat; count++){
                //msg.payload = msg.payload + ",'" + this.user + "'," + GetUsonicDist() + '[cm]';
                dist = GetUsonicDist();
                msg = {
                    "request": "store",
                    "dataObject": {
                        "objectType" : "iaCloudObject",
                        "objectKey" : "rmc-iot-santama." + this.user + ".nr-sensors" ,
                        "objectDescription" : "センサーの値",
                        "timeStamp" :  DTime,
                        "ObjectContent" : {
                            "contentType": "com.ia-cloud.contenttype.hackathon2017.temp01",
                            "contentData":[{
                                "commonName": "Column1",
                                "dataName": "ダミー",
                                "dataValue": 0,
                                "unit": "value"
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
                rpio.msleep(sleepMsec);
            }
        });
    }
    RED.nodes.registerType('get-usonic',GetUsonic);

    function GetUsonicDist(){

        var rpio = require('rpio');

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

