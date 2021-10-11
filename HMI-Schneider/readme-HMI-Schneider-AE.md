# Schneider表示器A&Eノード

## 概要

Schneider表示器上のアラームの発生・復旧情報を受信し、アラーム＆イベント情報を持つia-cloudオブジェクトを生成するNodeです。  
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
|dataObject.objectContent.contentType|string|"Alarm&Event"|
|dataObject.objectContent.contentData|array of object|ストアするデータの配列|
|dataObject.objectContent.contentData\[n\].AnEStatus|string|アラーム&イベントの状態|
|dataObject.objectContent.contentData\[n\].AnECode|string|プロパティ「A&Eコード」で設定した文字列<br>プロパティで設定していない場合、Schneider表示器上の変数名が入ります。|
|dataObject.objectContent.contentData\[n\].AnEDescription|string|プロパティ「A&E説明」で設定した文字列<br>プロパティで設定していない場合、Schneider表示器から取得したメッセージが入ります。|

### Quality

当Nodeはqualityオプションに対応しています。

`dataObject.quality`はNodeとSchneider表示機間の通信状態をQualityとして反映させています。
|値|説明|
|:-|:-|
|good|Schneider表示機と接続中です|
|com. error|Schneider表示機と接続できていません|

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
      "contentType": "Alarm&Event",
      "contentData": [
        {
          "AnEStatus": "set",
          "AnECode": "A&Eコード",
          "AnEDescription": "A&E説明"
        }
      ]
    }
  }
}
```

## プロパティー

本nodeは以下のプロパティを持ちます。
|タブ|名称|種別|説明|
|:-:|:--|:-:|:--|
|-|通信ノード|設定Node|Schneider表示器との通信の設定Nodeです。|
|オブジェクトの設定|定期収集周期|number|定期収集周期を秒単位で指定してください。Schneider表示器上の変数の変化の有無に関わらず、指定周期でデータを出力します。定期収集を行わない場合は0を指定してください。|
|オブジェクトの設定|非同期収集有り|bool|定期収集とは別に、登録した値のいずれかが変化した場合にデータを出力します。|
|オブジェクトの設定|オブジェクトキー|string|ia-cloudオブジェクトのobjectKeyとして使われます。|
|オブジェクトの設定|オブジェクトの説明|string|ia-cloudオブジェクトのobjectDescriptionとして使われます。|
|データの設定|変数名|string|Schneider表示器上の変数名です。このNodeはこの変数名をキーにしてSchneider表示器からデータを取得します。|
|データの設定|A&Eコード|string|contentDataオブジェクトのAnECodeとして使われます。入力を省略した場合、変数名がA&Eコードとして使用されます。|
|データの設定|A&E説明|string|contentDataオブジェクトのAnEDescriptionとして使われます。入力を省略した場合、Schneider表示器から取得したメッセージがA&E説明として使用されます。|
|-|ノード名称|string|HMI-Schneider-AE Nodeの名称です。|
