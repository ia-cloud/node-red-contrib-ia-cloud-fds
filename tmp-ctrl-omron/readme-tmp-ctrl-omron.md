# オムロン温度調節計データオブジェクトノード

## tmp-ctrl-omron
オムロン温度調節計の運転・設定データを読み出し、ia-cloudオブジェクトを生成するNode。Node-redのUIによる設定のほか、設定ファイルを指定することも可能である。設定ファイルを指定した場合は、複数のia-cloudオブジェクトの設定が可能である。  
設定Nodeとして、Modbus-comを使用する。

## 入力メッセージ
ia-cloudオブジェクトを送出するタイミングを指示するメッセージ

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|payload|boolean/string/number/object|NULL, 0, false 以外の時、その時点でのia-cloudオブジェクトを生成して出力する。| 

## 出力メッセージ
オブジェクトのia-cloud CSへストアーするためのメッセージを出力する。ia-cloud-cnct Nodeへの接続を想定している。

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
    timestamp: "",
    objectDescription: "説明",
    ObjectContent: {
      contentType: "tempCont",
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

| 名称 | 種別 | 説明 | 備考 |
|:----------|:-----:|:-----|:-------|
|Node name|string|PLC-Modbus Nodeの名称|
|Modbus Node|設定Node|Modbus通信の設定Node|
|confSel|string|設定が設定ファイルでされたか、UI画面からされたかを示す文字列。|
|configJson|string|設定情報ObjectをJSON化した文字列。後述のプロパティ方自動生成される。|非表示のプロパティ
|configReady|boolean|必須のプロパティがすべて設定済みかを表すフラグ|非表示のプロパティ


### 設定ファイルの場合

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|設定ファイル|string|設定ファイルでの設定の場合、設定JSONファイルのファイル名称。|
|設定情報|string|設定ファイルから取り出した、設定オブジェクト文字列。これから設定オブジェクトjsonが生成される。|

### UI画面設定の場合

**オブジェクトの設定**

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|収集周期|number| 定期収集周期。最小10秒。0秒で周期収集なし。　|
|非同期収集|boolean| データ変化時の非同期収集をする。true固定。　|
|オブジェクト名称|string| ia-cloudオブジェクトの任意の名称。　|
|オブジェクトキー|string| ia-cloudオブジェクトのobjectKeyとして使われる。|
|オブジェクトの説明|string| ia-cloudオブジェクトのobjectdescriptionとして使われる。|

**データの設定**

|名称　| 種別 | 説明 |
|:----------|:-----:|:--------------------|
|データ項目|string|取得するデータ項目の指定、それぞれがModbusアドレスと紐ついている。<br>"現在値", "設定値", "比例帯", "積分時間", "微分時間"<br>"ランモード", "自動運転", "オートチューニング"  のいずれかを選択できる。|

## 設定ファイルの構造
```
{
    "targetNodeName": "{設定データが対象とするtmp-ctrl-omron nodeの名称}",
    "comment": "{設定データに関する説明}",
    "dataObjects": [{
        "name": "オムロン温調計データ",
        "objectKey": "com.atbridge-cnsltg.node-RED.test2",
        "objectType": "iaCloudObject",
        "objectDescription": "オムロン温調計運転・設定データ",
        "options":{
          "storeInterval": 300,
          "storeAsync": true
        },
        "ObjectContent": {
            "contentType": "tempContData",
            "contentData": [{
                "dataName": "炉内温度",
                "unit": "度",
                "options": {
                    "source": "pv",
                }
              },{
                      .
                      .
                      .
            }]
        }
    }]
}

```
