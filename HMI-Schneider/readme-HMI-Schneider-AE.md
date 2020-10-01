# HMI-Schneider-AEノード

## 概要

HMI上のアラームの発生・復旧情報を受信し、アラーム＆イベント情報を持つia-cloudオブジェクトを生成するNodeです。  
設定Nodeとして、HMI-Schneider-comを使用します。

## 入力メッセージ

ia-cloudオブジェクトを送出するタイミングを指示するメッセージ。Nodeが保持している現在値を出力します。

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
|contentType|string|"Alarm&Event"|
|contentData|array of object|ストアするデータの配列|
|AnEStatus|string|アラーム&イベントの状態|
|AnECode|string|プロパティ「A&Eコード」で設定した文字列<br>プロパティで設定していない場合、HMI変数名が入ります。|
|AnEDescription|string|プロパティ「A&E説明」で設定した文字列<br>プロパティで設定していない場合、HMIから取得したメッセージが入ります。| 

### サンプル

```json
{
  "request": "store",
  "dataObject": {
    "objectKey": "object key",
    "objectType": "iaCloudObject",
    "objectDescription": "object description",
    "ObjectContent": {
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

本nodeは以下のプロパティを持つ
|タブ|名称|種別|説明|
|:-:|:--|:-:|:--|
|-|通信ノード|設定Node|HMIとの通信の設定Nodeです。|
|オブジェクトの設定|定期収集周期|number|定期収集周期を秒単位で指定してください。HMI変数の変化の有無に関わらず、指定周期でデータを出力します。定期収集を行わない場合は0を指定してください。|
|オブジェクトの設定|非同期収集有り|bool|定期収集とは別に、登録した値のいずれかが変化した場合にデータを出力します。|
|オブジェクトの設定|objectキー|string|ia-cloudオブジェクトのobjectKeyとして使われます。|
|オブジェクトの設定|objectの説明|string|ia-cloudオブジェクトのobjectDescriptionとして使われます。|
|データの設定|変数名|string|HMIの変数名です。このNodeはこの変数名をキーにしてHMIと通信を行います。|
|データの設定|A&Eコード|string|contentDataオブジェクトのAnECodeとして使われます。入力を省略した場合、変数名がA&Eコードとして使用されます。|
|データの設定|A&E説明|string|contentDataオブジェクトのAnEDescriptionとして使われます。入力を省略した場合、HMIから取得したメッセージがA&E説明として使用されます。|
|-|ノード名称|string|HMI-Schneider-AE Nodeの名称です。|
