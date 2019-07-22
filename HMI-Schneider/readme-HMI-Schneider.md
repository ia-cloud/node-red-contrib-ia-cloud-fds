# HMI-Schneider機器データオブジェクトノード

## HMI-Schneider
HMIの持つ変数データを受信し、ia-cloudオブジェクトを生成するNode。Node-redのUIによる設定のほか、設定ファイルを指定することも可能である。設定ファイルを指定した場合は、複数のia-cloudオブジェクトの設定が可能である。  
設定Nodeとして、HMI-Schneider-com、HMI-Schneider-dataItemsを使用する。

## 入力メッセージ
なし  

## 出力メッセージ
オブジェクトのia-cloud CSへストアーするためのメッセージを出力する。ia-cloud-cnct Nodeへの接続を想定している。

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|request|string|"store"|
|object|object|ストアするia-cloudオブジェクトの配列|  

サンプル
```
msg = {
  request: "store",
  object: {
    objectKey: "com.ia-cloud.........",
    objectType: "iaCloudObject",
    objectDescription: "説明",
    ObjectContent: {
      contentType: "iaCloudData",
      contentData": [{
        "dataName"
                .
                .
                .
      }]
    }
  }
}
```
## プロパティー

本nodeは以下のプロパティを持つ

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|名称|string|HMI-Schneider Nodeの名称|
|Schneider HMI通信ノード|設定Node|HMIとの通信の設定Node|

**設定ファイルの場合**  

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|設定ファイル|string|設定ファイルでの設定の場合、設定JSONファイルのフルパスファイル名称。|

**データオブジェクト設定の場合**

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|通知周期|number| 通知周期。最小10秒。|
|オブジェクト名称|string| ia-cloudオブジェクトの任意の名称。　|
|オブジェクトキー|string| ia-cloudオブジェクトのobjectKeyとして使われる。|
|オブジェクトの説明|string| ia-cloudオブジェクトのobjectdescriptionとして使われる。|
|データitem情報|設定Node| objectContentとして挿入されるオブジェクトを設定するための設定Node。|

## 設定ファイルの構造
```
{
    "configName": "modbusConfig.json",
    "comment": "modbus ia-cloud object configration data for test.",
    "dataObjects":
        [{
        "objectName": "bit系データ",
        "objectKey": "com.atbridge-cnsltg.node-RED.test1",
        "objectType": "iaCloudObject",
        "objectDescription": "modbusのビット系データ",
        "options":{"storeInterval": 60, "storeAsync": true},
        "ObjectContent": {
            "contentType": "PLC-bit",
            "contentData": [{
                "dataName": "装置I稼働",
                "options": {
                    "itemType": "bit",
                    "deviceType": "Coil",
                    "source":123,
                    "number": 1,
                    "logic": "pos"
                  },
                      .
                      .
                      .
                }]
        }
    },{
        "name": "数値系データ",
        "objectKey": "com.atbridge-cnsltg.node-RED.test2",
        "objectType": "iaCloudObject",
        "objectDescription": "modbusのワード系データ",
        "options":{
          "storeInterval": 300,
          "storeAsync": true
        },
        "ObjectContent": {
            "contentType": "iaCloudData",
            "contentData": [{
                "dataName": "装置消費電流",
                "unit": "A",
                "options": {
                    "itemType": "number",
                    "deviceType": "IR",
                    "source":213,
                    "type": "1w",
                    "encode": "unsigned",
                    "offset": 0,
                    "gain": 1
                }
              },
                      .
                      .
                      .
            }]
        }
    },{
        "name": "文字列データ",
        "objectKey": "com.atbridge-cnsltg.node-RED.test3",
        "objectType": "iaCloudObject",
        "objectDescription": "modbusの文字列データ",
        "options":{
          "storeInterval": 100,
          "storeAsync": false
        },
        "ObjectContent": {
            "contentType": "iaCloudData",
            "contentData": [{
                "dataName": "実行中作業名",
                "options": {
                  "itemType": "string",
                  "deviceType": "IR",
                  "source":56,
                  "number": 32,
                  "encode": "utf-8"
              }
            }]
        }
    },{
        "name": "混合データ",
        "objectKey": "com.atbridge-cnsltg.node-RED.test4",
        "objectType": "iaCloudObject",
        "objectDescription": "modbusのいろいろ混合データ",
        "options":{
          "storeInterval": 30,
          "storeAsync": false
        },
        "ObjectContent": {
            "contentType": "iaCloudData",
            "contentData": [{
              "dataName": "装置消費電流",
              "unit": "A",
              "options": {
                  "itemType": "number",
                  "deviceType": "IR",
                  "source":213,
                  "type": "1w",
                  "encode": "unsigned",
                  "offset": 0,
                  "gain": 1
              }
            },{
              "dataName": "装置II稼働",
              "options": {
                  "itemType": "bit",
                  "deviceType": "Coil",
                  "source":124,
                  "number": 1,
                  "logic": "neg"
              }
            },{
              "dataName": "温度トレンド",
              "unit": "",
              "options": {
                  "itemType": "numList",
                  "deviceType": "HR",
                  "source":488,
                  "number": 256,
                  "type": "2w",
                  "encode": "signed"
              }
            },{
              "dataName": "実行中作業名",
              "options": {
                  "itemType": "string",
                  "deviceType": "IR",
                  "source":56,
                  "number": 32,
                  "encode": "utf-8"
            }
          }]
        }
    }]
}

```
