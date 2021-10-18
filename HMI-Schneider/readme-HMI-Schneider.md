# Schneider表示器ノード

## 概要

Schneider表示器上の変数の状態変化を受信し、ia-cloudオブジェクトを生成するNodeです。  
設定Nodeとして、HMI-Schneider-comを使用します。

## 入力メッセージ

ia-cloudオブジェクトを送出するタイミングを指示するメッセージ。Nodeが保持している現在値を出力します。

## 出力メッセージ

オブジェクトのia-cloud CSへストアーするためのメッセージを出力します。ia-cloud-cnct Nodeへの接続を想定しています。

|パス|種別|説明|
|:--|:-:|:--|
|request|string|"store"|
|dataObject|object|ストアするia-cloudオブジェクト|
|dataObject.objectKey|string|プロパティ「オブジェクトキー」で設定した文字列|
|dataObject.timestamp|string|メッセージ作成時点のタイムスタンプ|
|dataObject.objectType|string|"iaCloudObject"|
|dataObject.objectDescription|string|プロパティ「objectの説明」で設定した文字列|
|dataObject.quality|string|dataObjectのQuality。Schneider表示器との通信状態を示します。値については後述しています。|
|dataObject.objectContent|object| |
|dataObject.objectContent.contentType|string|プロパティ「データ構造型」で設定した文字列|
|dataObject.objectContent.contentData|array of object|ストアするデータの配列|
|dataObject.objectContent.contentData\[n\].dataName|string|プロパティ「データ名称」で設定した文字列|
|dataObject.objectContent.contentData\[n\].dataValue|-|指定したSchneider表示器上の変数の値。データはSchneider表示器で定義したの変数のデータタイプに依存します。<br>下表「データタイプ」を参照してください。|
|dataObject.objectContent.contentData\[n\].unit|string|プロパティ「単位」で設定した文字列|
|dataObject.objectContent.contentData\[n\].quality|string|各contentDataのQuality。値については後述しています。|

### データタイプ

最新の情報についてはBLUEユーザーマニュアルを参照してください。
|Schneider表示器上の変数のデータタイプ|データ種別|データ範囲|
|:--|:--|:--|
|BOOL|boolean|true/false|
|BYTE,SINT,USINT,<br>WORD,INT,UINT,<br>DWORD,DINT,UDINT,<br>LWORD,LINT,ULINT,<br>REAL,LREAL,TIME|number|64 ビット浮動小数点値の範囲です。<br>LWORD、LINT、ULINTの場合、精度は 52 ビットです。<br>REALまたはLREALの値がNaNまたはINFINITYの場合は、nullになります。|
|STRING,WSTRING|string|UTF-8|
|DATE,TIME_OF_DATE_DATE_AND_TIME|string|ISO 8601フォーマット|

### Quality

当Nodeはqualityオプションに対応しています。

`dataObject.quality`はNodeとSchneider表示器間の通信状態をQualityとして反映させています。
|値|説明|
|:-|:-|
|good|Schneider表示器と接続中です|
|com. error|Schneider表示器と接続できていません|

`dataObject.objectContent.contentData[n].quality`はSchneider表示器上での変数の状態をQualityとして反映させています。
|値|説明|
|:-|:-|
|good|Schneider表示器上の変数の状態は異常ありません。|
|com. error|NodeとSchneider表示器が接続できていない または Schneider表示器上の変数はエラーとなっています。<br>`dataObject.quality`が`good`の場合、Schneider表示器と外部接続機器間でエラーが発生している可能性があります。|
|not updated|Schneider表示器から変数情報が送られていません。<br>変数情報の受信待または変数名に間違いがある可能性があります。|

### サンプル

```json
{
  "request": "store",
  "dataObject": {
    "objectKey": "object key",
    "objectType": "iaCloudObject",
    "objectDescription": "object description",
    "quality": "good",
    "objectContent": {
      "contentType": "iaCloudData",
      "contentData": [
        {
          "dataName": "データ名称",
          "dataValue": "データ値",
          "unit": "単位",
          "quality": "good"
        }
      ]
    }
  }
}
```

## プロパティ

本nodeは以下のプロパティを持ちます。

|タブ|名称|種別|説明|
|:-:|:--|:-:|:--|
|-|通信ノード|設定Node|Schneider表示器との通信の設定Nodeです。|
|オブジェクトの設定|定期収集周期|number|定期収集周期を秒単位で指定してください。Schneider表示器上の変数の変化の有無に関わらず、指定周期でデータを出力します。定期収集を行わない場合は0を指定してください。|
|オブジェクトの設定|非同期収集有り|bool|定期収集とは別に、登録した値のいずれかが変化した場合にデータを出力します。|
|オブジェクトの設定|オブジェクトキー|string|ia-cloudオブジェクトのobjectKeyとして使われます。|
|オブジェクトの設定|オブジェクトの説明|string|ia-cloudオブジェクトのobjectDescriptionとして使われます。|
|データの設定|データ構造型|string|コンテントのcontentTypeとして使われます。|
|データの設定|データ名称|string|contentDataオブジェクトのdataNameとして使われます。|
|データの設定|単位|string|contentDataオブジェクトのunitとして使われます。|
|データの設定|変数名|string|Schneider表示器上の変数名です。このNodeはこの変数名をキーにしてSchneider表示器と通信を行います。|
|-|ノード名称|string|HMI-Schneider Nodeの名称です。|
