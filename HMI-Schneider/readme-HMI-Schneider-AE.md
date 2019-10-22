# Schneider HMI機器アラーム＆イベントオブジェクトノード

## HMI-Schneider-AE
Schneider HMI通信機器の持つビットデータを読み出し、Alarm&EventのcontentTypeを持つia-cloudオブジェクトを生成するNode。Node-redのUIによる設定のほか、設定ファイルを指定することも可能である。設定ファイルを指定した場合は、複数のia-cloudオブジェクトの設定が可能である。  
設定Nodeとして、HMI-Schneider-com、HMI-Schneider-AnEを使用する。

## 入力メッセージ
なし  

## 出力メッセージ
オブジェクトのia-cloud CSへストアーするためのメッセージを出力する。ia-cloud-cnct Nodeへの接続を想定している。

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|request|string|"store"|
|object|object|ストアするia-cloudオブジェクト|  

サンプル
```
msg = {
  request: "store",
  object: {
    objectKey: "com.ia-cloud.........",
    objectType: "iaCloudObject",
    objectDescription: "説明",
    ObjectContent: {
      contentType: "Alarm&Event",
      contentData: [{
        commonName: "Alarm&Event",
        dataValue: {
          AnEStatus: "set",
          AnECode: "E309",
          AnEdescription: "XXエラー発生"
        }
      },{
        commonName: "Alarm&Event",
        dataValue: {
          AnEStatus: "reset",
          AnECode: "W590",
          AnEdescription: "xx警報発生"
        }
      }
                .
                .
                .
      ]
    }
  }
}
```
## プロパティー

本nodeは以下のプロパティを持つ

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|Node name|string|HMI-Schneider Nodeの名称|
|Schneider HMI Node|設定Node|Schneider HMI通信の設定Node|

**設定ファイルの場合**  

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|設定ファイル|string|設定ファイルでの設定の場合、設定JSONファイルのフルパスファイル名称。|

**データオブジェクト設定の場合**

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|収集周期|number| 定期収集周期。最小10秒。0秒で周期収集なし。　|
|非同期収集|boolean| データ変化時の非同期収集をする。true固定。　|
|オブジェクト名称|string| ia-cloudオブジェクトの任意の名称。　|
|オブジェクトキー|string| ia-cloudオブジェクトのobjectKeyとして使われる。|
|オブジェクトの説明|string| ia-cloudオブジェクトのobjectdescriptionとして使われる。|
|A&E情報|設定Node| objectContentとして挿入されるアラーム＆イベントデータを設定するための設定Node。|

## 設定ファイルの構造
```
{
    "name": "hmiSchneiderAEConfig.json",
    "comment": "schneider HMI ia-cloud A&E object configration data for test.",
    "AnEObjects":
      [{
        "name": "アラームブロック1",
        "objectKey": "com.atbridge-cnsltg.node-RED.testAE1",
        "objectType": "iaCloudObject",
        "objectDescription": "HMIのアラームデータ",
        "options":{"storeInterval": 300, "storeAsync": true},
        "ObjectContent": {
            "contentType": "Alarm&Event",
            "contentData": [
              {
              "commonName":"Alarm&Event",
              "dataValue": {
                "AnEStatus": "",
                "AnECode": "E201",
                "AnEDescription": "インバータNo.3異常"
              },
              "options": {"deviceType": "Coil", "source": "58", "logic": "pos"}
              },{
              "commonName":"Alarm&Event",
              "dataValue": {
                "AnEStatus": "",
                "AnECode": "E202",
                "AnEDescription": "インバータNo.5異常"
              },
              "options": {"deviceType": "IS", "source": "152", "logic": "neg"}
              },{
              "commonName":"Alarm&Event",
              "dataValue": {
                "AnEStatus": "",
                "AnECode": "E887",
                "AnEDescription": "異常温度上昇"
              },
              "options": {"deviceType": "IS", "source": "552", "logic": "neg"}
              }
            ]
        }
      },{
        "name": "アラームブロック2",
        "objectKey": "com.atbridge-cnsltg.node-RED.testAE1",
        "objectType": "iaCloudObject",
        "objectDescription": "modbusのアラームデータ",
        "ObjectContent": {
            "contentType": "Alarm&Event",
            "contentData": [
              {
              "commonName":"Alarm&Event",
              "dataValue": {
                "AnEStatus": "",
                "AnECode": "W401",
                "AnEDescription": "インバータNo.3警報"
                },
              "options": {"deviceType": "Coil", "source": "158", "logic": "pos"}
              },{
              "commonName":"Alarm&Event",
              "dataValue": {
                "AnEStatus": "",
                "AnECode": "W402",
                "AnEDescription": "インバータNo.5警報"
                },
              "options": {"deviceType": "IS", "source": "252", "logic": "neg"}
              },{
              "commonName":"Alarm&Event",
              "dataValue": {
                "AnEStatus": "",
                "AnECode": "W1087",
                "AnEDescription": "温度上昇警報"
                },
              "options": {"deviceType": "IS", "source": "652", "logic": "neg"}
              }
            ]
        }
    }]
}
```
