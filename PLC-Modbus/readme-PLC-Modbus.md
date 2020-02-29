# Modbus機器データオブジェクトノード

## PLC-Modbus
Modbus通信機器の持つビットデータ・ワードデータを読み出し、ia-cloudオブジェクトを生成するNode。Node-redのUIによる設定のほか、設定ファイルを指定することも可能である。設定ファイルを指定した場合は、複数のia-cloudオブジェクトの設定が可能である。  
設定Nodeとして、Modbus-comを使用する。

## 入力メッセージ
ia-cloudオブジェクトを送出するタイミングを指示するメッセージ

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|payload|string|NULL, 0, false 以外の時、その時点でのia-cloudオブジェクトを生成して出力する。| 

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

***ビット[列]***

|名称　　　| 種別 | 説明 |
|:----------|:-----:|:--------------------|
|データ種別|string |"bit"固定|
|データ名称|string|オブジェクトのデータitemの名称。 ia-cloudデータモデルのdataNameとして使用される。|
|デバイス種別|string |データを取得するModbusデバイスの種別。Coil/IS(Input Status)のいずれか。|
|先頭アドレス|number|データを取得するビット列の先頭Modbusアドレス。|
|ビット数|number|連続するビットデータの数。 >= 1|
|論理|boolean|正論理(1:true,0:false) or 負論理(1:false,0:true)|

***数値***

|名称　| 種別 | 説明 |
|:----------|:-----:|:--------------------|
|データ種別|string |"number"固定|
|データ名称|string|オブジェクトのデータitemの名称。 ia-cloudデータモデルのdataNameとして使用される。|
|デバイス種別|string |データを取得するModbusデバイスの種別。HR(Holding Register)/IR(Input Register)のいずれか。|
|先頭アドレス|number|データを取得するデータのModbusアドレス。|
|データタイプ|string|1w(1ワードデータ)、2w-b(2ワードビッグエンディアン)、2w-l(2ワードリトルエンディアン)のいずれか。|
|単位　|string|データアイテムの値の単位。 ia-cloudデータモデルのunitとして使用される。|
|形式　|string|数値データの形式。unsigned(符合なし)、signed(符号付2の補数)、BCD(2進化10進数)のいずれか。|
|倍率　|number|Modbus機器から読み出したデータから、データアイテムのデータ値に換算計算する際の倍率。読み出しデータ * 倍率 + オフセットとして使われる|
|オフセット|number|odbus機器から読み出したデータから、データアイテムのデータ値に換算計算する際のオフセット。読み出しデータ * 倍率 + オフセットとして使われる|

***文字列***

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|データ種別|string |"string"固定|
|データ名称|string|オブジェクトのデータitemの名称。 ia-cloudデータモデルのdataNameとして使用される。|
|デバイス種別|string |データを取得するModbusデバイスの種別。HR(Holding Register)/IR(Input Register)のいずれか。|
|先頭アドレス|number|データを取得するデータのModbusアドレス。|
|文字エンコード|string|文字列データのエンコード。 utf-8、sJIS, EUCのいずれか。|
|ワード数|number|連続する文字データのデータ長(ワード数)。 >= 1。エンコードによって、文字数と一致しないので注意。|

***数値列***

|名称　　| 種別 | 説明 |
|:----------|:-----:|:--------------------|
|データ種別|string |"numList"固定|
|データ名称|string|オブジェクトのデータitemの名称。 ia-cloudデータモデルのdataNameとして使用される。|
|デバイス種別|string |データを取得するModbusデバイスの種別。HR(Holding Register)/IR(Input Register)のいずれか。|
|先頭アドレス|number|データを取得するデータのModbusアドレス。|
|データタイプ　|string|1w(1ワードデータ)、2w-b(2ワードビッグエンディアン)、2w-l(2ワードリトルエンディアン)のいずれか。|
|形式　|string|数値データの形式。unsigned(符合なし)、signed(符号付2の補数)、BCD(2進化10進数)のいずれか。|
|ワード数|number|連続する数値データ列のデータ長(データの数、ワード数では無い)。|

## 設定ファイルの構造
```
{
    "targetNodeName": "{設定データが対象とするPLC-Modbus nodeの名称}",
    "comment": "{設定データに関する説明}",
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
