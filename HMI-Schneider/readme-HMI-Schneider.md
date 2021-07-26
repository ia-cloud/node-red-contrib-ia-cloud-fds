# Schneider表示器ノード

## 概要

HMI上の変数の状態変化を受信し、ia-cloudオブジェクトを生成するNodeです。  
設定Nodeとして、HMI-Schneider-comを使用します。

## 入力メッセージ

ia-cloudオブジェクトを送出するタイミングを指示するメッセージ。Nodeが保持している現在値を出力します。

## 出力メッセージ

オブジェクトのia-cloud CSへストアーするためのメッセージを出力します。ia-cloud-cnct Nodeへの接続を想定しています。

|名称|種別|説明|
|:--|:-:|:--|
|request|string|"store"|
|dataObject|object|ストアするia-cloudオブジェクト|
|objectKey|string|プロパティ「オブジェクトキー」で設定した文字列|
|timestamp|string|メッセージ作成時点のタイムスタンプ|
|objectType|string|"iaCloudObject"|
|objectDescription|string|プロパティ「objectの説明」で設定した文字列|
|objectContent|object| |
|contentType|string|プロパティ「データ構造型」で設定した文字列|
|contentData|array of object|ストアするデータの配列|
|dataName|string|プロパティ「データ名称」で設定した文字列|
|dataValue|-|指定したHMIの変数の値。データはHMIの変数のデータタイプに依存します。<br>下表「データタイプ」を参照してください。|
|unit|string|プロパティ「単位」で設定した文字列|

### データタイプ

最新の情報についてはBLUEユーザーマニュアルを参照してください。
|HMI変数のデータタイプ|データ種別|データ範囲|
|:--|:--|:--|
|BOOL|boolean|true/false|
|BYTE,SINT,USINT,<br>WORD,INT,UINT,<br>DWORD,DINT,UDINT,<br>LWORD,LINT,ULINT,<br>REAL,LREAL,TIME|number|64 ビット浮動小数点値の範囲です。<br>LWORD、LINT、ULINTの場合、精度は 52 ビットです。<br>REALまたはLREALの値がNaNまたはINFINITYの場合は、nullになります。|
|STRING,WSTRING|string|UTF-8|
|DATE,TIME_OF_DATE_DATE_AND_TIME|string|ISO 8601フォーマット|

### サンプル

```json
{
  "request": "store",
  "dataObject": {
    "objectKey": "object key",
    "objectType": "iaCloudObject",
    "objectDescription": "object description",
    "objectContent": {
      "contentType": "iaCloudData",
      "contentData": [
        {
          "dataName": "データ名称",
          "dataValue": "データ値",
          "unit": "単位"
        }
      ]
    }
  }
}
```

## プロパティ

本nodeは以下のプロパティを持ちます

|タブ|名称|種別|説明|
|:-:|:--|:-:|:--|
|-|通信ノード|設定Node|HMIとの通信の設定Nodeです。|
|オブジェクトの設定|定期収集周期|number|定期収集周期を秒単位で指定してください。HMI変数の変化の有無に関わらず、指定周期でデータを出力します。定期収集を行わない場合は0を指定してください。|
|オブジェクトの設定|非同期収集有り|bool|定期収集とは別に、登録した値のいずれかが変化した場合にデータを出力します。|
|オブジェクトの設定|オブジェクトキー|string|ia-cloudオブジェクトのobjectKeyとして使われます。|
|オブジェクトの設定|オブジェクトの説明|string|ia-cloudオブジェクトのobjectDescriptionとして使われます。|
|データの設定|データ構造型|string|コンテントのcontentTypeとして使われます。|
|データの設定|データ名称|string|contentDataオブジェクトのdataNameとして使われます。|
|データの設定|単位|string|contentDataオブジェクトのunitとして使われます。|
|データの設定|変数名|string|HMIの変数名です。このNodeはこの変数名をキーにしてHMIと通信を行います。|
|-|ノード名称|string|HMI-Schneider Nodeの名称です。|
