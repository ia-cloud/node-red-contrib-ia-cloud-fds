# Modbus機器アラーム＆イベントオブジェクトノード

## PLC-Modbus-AE
Modbus通信機器の持つビットデータを読み出し、Alarm&EventのcontentTypeを持つia-cloudオブジェクトを生成するNode。Node-redのUIによる設定のほか、設定ファイルを指定することも可能である。設定ファイルを指定した場合は、複数のia-cloudオブジェクトの設定が可能である。  
設定Nodeとして、Modbus-comを使用する。

## 入力メッセージ
ia-cloudオブジェクトを送出するタイミングを指示するメッセージ

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|payload|string|NULL, 0, false 以外の時、その時点でのia-cloudオブジェクトを生成して出力する。|

## 出力メッセージ
オブジェクトをia-cloud CSへストアーするためのメッセージを出力する。ia-cloud-cnct Nodeへの接続を想定している。

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|request|string|"store"|
|dataObject|object|ストアするia-cloudオブジェクト|  

サンプル
```
msg = {
  request: "store",
  dataObject: {
    objectKey: "com.ia-cloud.........",
    objectType: "iaCloudObject",
    objectDescription: "説明",
    ObjectContent: {
      contentType: "Alarm&Event",
      contentData: [
        {
          commonName: "Alarm&Event",
          dataValue: {
            AnEStatus: "set",
            AnECode: "E309",
            AnEdescription: "XXエラー発生"}
        },{
          commonName: "Alarm&Event",
          dataValue: {
            AnEStatus: "reset",
            AnECode: "W590",
            AnEdescription: "xx警報発生"}
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

| 名称 | 種別 | 説明 | 備考 |
|:----------|:-----:|:-----|:-------|
|Node name|string|PLC-Modbus Nodeの名称|
|Modbus Node|設定Node|Modbus通信の設定Node|
|confSel|string|設定が設定ファイルでされたか、UI画面からされたかを示す文字列。|
|configJson|string|設定情報ObjectをJSON化した文字列。後述のプロパティ方自動生成される。|非表示のプロパティ
|configReady|boolean|必須のプロパティがすべて設定済みかを表すフラグ|非表示のプロパティ


**設定ファイルの場合**  

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|設定ファイル|string|設定ファイルでの設定の場合、設定JSONファイルのファイル名称。|
|設定情報|string|設定ファイルから取り出した、設定オブジェクト文字列。これから設定オブジェクトjsonが生成される。|

**UI画面設定の場合**

***オブジェクトの設定***

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|収集周期|number| 定期収集周期。最小10秒。0秒で周期収集なし。　|
|非同期収集|boolean| データ変化時の非同期収集をする。true固定。　|
|オブジェクト名称|string| ia-cloudオブジェクトの任意の名称。　|
|オブジェクトキー|string| ia-cloudオブジェクトのobjectKeyとして使われる。|
|オブジェクトの説明|string| ia-cloudオブジェクトのobjectdescriptionとして使われる。|

***データの設定***

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|データの構造型|string| ia-cloudオブジェクトのデータアイテムとしての型。"Alarm&Event"固定。|
|デバイス種別|string |アラーム＆イベント情報を取得するModbusデバイスの種別。Coil/IS(Input Status)のいずれか。|
|先頭アドレス　　　|number|データを取得するデータのModbusアドレス。|
|論理　　　|string|対象データの論理　正論理・負論理|
|A&Eコード　|string|アラーム＆イベントのコード。通常アラーム番号や警報番号など。|
|A&Eの説明|string|該当するアラーム＆イベントの説明文字列。|


## 設定ファイルの構造
設定ファイルの内容記述例
```
{
    "targetNodeName": "{設定データが対象とするPLC-Modbus-AE nodeの名称}",
    "comment": "{設定データに関する説明}",
    "dataObjects":
      [{
        "name": "アラームブロック1",
        "objectKey": "com.atbridge-cnsltg.node-RED.testAE1",
        "objectType": "iaCloudObject",
        "objectDescription": "modbusのアラームデータ",
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
