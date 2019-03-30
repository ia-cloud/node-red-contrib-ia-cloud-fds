module.exports = function(RED) {
    function GetCt(config) {
        RED.nodes.createNode(this,config);
        this.name = config.neme;
        this.user = config.user;
        var node = this;

        node.on('input', function(msg) {

            const Raspi = require('raspi');
            const I2C = require('raspi-i2c').I2C;
            const ADS1x15 = require('raspi-kit-ads1x15');

            var dateformat = require('dateformat');
            var timestamp = dateformat(msg.payload, 'isoDateTime');

            // Init Raspi
            Raspi.init(() => {
                
                // Init Raspi-I2c
                const i2c = new I2C();
                
                // Init the ADC
                const adc = new ADS1x15({
                    i2c,                                    // i2c interface
                    chip: ADS1x15.chips.IC_ADS1115,         // chip model
                    address: ADS1x15.address.ADDRESS_0x48,  // i2c address on the bus
                    
                    // Defaults for future readings
                    pga: ADS1x15.pga.PGA_0_256V,            // power-gain-amplifier range
                    sps: ADS1x15.spsADS1115.SPS_250         // data rate (samples per second)
                });

                // Get a single-ended reading from channel-0 and display the results
                adc.readChannel(ADS1x15.channel.CHANNEL_0, (err, value, volts) => {
                    if (err) {
                        console.error('Failed to fetch value from ADC', err);
                        //process.exit(1);
                    } else {
                        //console.log('Channel 0');
                        //console.log(' * Value:', value);    // will be a 11 or 15 bit integer depending on chip
                        //console.log(' * Volts:', volts);    // voltage reading factoring in the PGA

                        msg = {
                            "request": "store",
                            "dataObject": {
                                "objectType" : "iaCloudObject",
                                "objectKey" : "rmc-iot-santama." + this.user + ".nrct-sensors" ,
                                "objectDescription" : "センサーの値",
                                "timeStamp" :  timestamp,
                                "ObjectContent" : {
                                    "contentType": "com.ia-cloud.contenttype.hackathon2017.temp01",
                                    "contentData":[{
                                        "commonName": "Column1",
                                        "dataName": "CTセンサー",
                                        "dataValue": volts,
                                        "unit": "V"
                                    },{
                                        "commonName": "Column2",
                                        "dataName": "ダミー",
                                        "dataValue": 0,
                                        "unit": "value"
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
                        //process.exit(0);
                    }
                });
                
            });

        });
    }
    RED.nodes.registerType('get-ct',GetCt);
}

