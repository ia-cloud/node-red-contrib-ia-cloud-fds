# HMI-Schneider-AEノード

## 概要

HMI上のアラームの発生・復旧情報を受信し、アラーム＆イベント情報を持つia-cloudオブジェクトを生成するNodeです。  
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
|名称|種別|説明|
|:--|:-:|:--|
|名前|string|HMI-Schneider-AE Nodeの名称です。|
|通信ノード|設定Node|HMIとの通信の設定Nodeです。|
|通知周期(秒)|number|通知周期です。最小1秒。|
|object名称|string|ia-cloudオブジェクトの任意の名称です。　|
|objectキー|string|ia-cloudオブジェクトのobjectKeyとして使われます。|
|objectの説明|string|ia-cloudオブジェクトのobjectDescriptionとして使われます。|
|変数名|string|HMIの変数名です。このNodeはこの変数名をキーにしてHMIと通信を行います。|
|A&Eコード|string|contentDataオブジェクトのAnECodeとして使われます。入力を省略した場合、変数名がA&Eコードとして使用されます。|
|A&E説明|string|contentDataオブジェクトのAnEDescriptionとして使われます。入力を省略した場合、HMIから取得したメッセージがA&E説明として使用されます。|
