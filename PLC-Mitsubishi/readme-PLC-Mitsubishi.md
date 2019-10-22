# Mitsubishi機器データオブジェクトノード

## PLC-Mitsubishi
Mitsubishi通信機器の持つビットデータ・ワードデータを読み出し、ia-cloudオブジェクトを生成するNode。Node-redのUIによる設定のほか、設定ファイルを指定することも可能である。設定ファイルを指定した場合は、複数のia-cloudオブジェクトの設定が可能である。  
設定Nodeとして、Mitsubishi-com、Mitsubishi-dataItemsを使用する。

## 入力メッセージ
なし  

## 出力メッセージ
オブジェクトのia-cloud CSへストアーするためのメッセージを出力する。ia-cloud-cnct Nodeへの接続を想定している。

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|request|string|"store"|
|dataObject|object|ストアするia-cloudオブジェクトの配列|  

サンプル
```
msg = {
  request: "store",
  dataObject: {
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
|Node name|string|PLC-Mitsubishi Nodeの名称|
|Mitsubishi Node|設定Node|Mitsubishi通信の設定Node|

**設定ファイルの場合**  

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|設定ファイル|string|設定ファイルでの設定の場合、設定JSONファイルのフルパスファイル名称。|

**データオブジェクト設定の場合**

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|収集周期|number| 定期収集周期。最小10秒。0秒で周期収集なし。　|
|非同期収集|boolean| データ変化時の非同期収集をする場合、true。　|
|オブジェクト名称|string| ia-cloudオブジェクトの任意の名称。　|
|オブジェクトキー|string| ia-cloudオブジェクトのobjectKeyとして使われる。|
|オブジェクトの説明|string| ia-cloudオブジェクトのobjectdescriptionとして使われる。|
|データitem情報|設定Node| objectContentとして挿入されるオブジェクトを設定するための設定Node。|

## 設定ファイルの構造
```
{
    "configName": "MitsubishiConfig.json",
    "comment": "Mitsubishi ia-cloud object configration data for test.",
    "dataObjects":
        [{
        "objectName": "bit系データ",
        "objectKey": "com.atbridge-cnsltg.node-RED.test1",
        "objectType": "iaCloudObject",
        "objectDescription": "Mitsubishiのビット系データ",
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
        "objectDescription": "Mitsubishiのワード系データ",
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
        "objectDescription": "Mitsubishiの文字列データ",
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
        "objectDescription": "Mitsubishiのいろいろ混合データ",
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
