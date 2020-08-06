# HMI-Schneiderノード

## 概要

HMI上の変数の状態変化を受信し、ia-cloudオブジェクトを生成するNodeです。  
設定Nodeとして、HMI-Schneider-comを使用します。

## 入力メッセージ

なし  

## 出力メッセージ

オブジェクトのia-cloud CSへストアーするためのメッセージを出力します。ia-cloud-cnct Nodeへの接続を想定しています。

|名称|種別|説明|
|:--|:-:|:--|
|request|string|"store"|
|dataObject|object|ストアするia-cloudオブジェクト|
|objectKey|string|プロパティ「objectキー」で設定した文字列|
|timestamp|string|メッセージ作成時点のタイムスタンプ|
|objectType|string|"iaCloudObject"|
|objectDescription|string|プロパティ「objectの説明」で設定した文字列|
|ObjectContent|object| |
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
    "ObjectContent": {
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

|名称|種別|説明|
|:--|:-:|:--|
|名前|string|HMI-Schneider Nodeの名称です。|
|通信ノード|設定Node|HMIとの通信の設定Nodeです。|
|通知周期(秒)|number|通知周期です。最小1秒。|
|object名称|string|ia-cloudオブジェクトの任意の名称です。　|
|objectキー|string|ia-cloudオブジェクトのobjectKeyとして使われます。|
|objectの説明|string|ia-cloudオブジェクトのobjectDescriptionとして使われます。|
|データ構造型|string|コンテントのcontentTypeとして使われます。|
|データ名称|string|contentDataオブジェクトのdataNameとして使われます。|
|単位|string|contentDataオブジェクトのunitとして使われます。|
|変数名|string|HMIの変数名です。このNodeはこの変数名をキーにしてHMIと通信を行います。|
