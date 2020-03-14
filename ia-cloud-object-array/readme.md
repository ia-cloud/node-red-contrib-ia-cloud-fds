# ia-cloud ObjectArrayノード

## object-array

## 機能概要

本nodeは、入力メッセージに入力されたia-cloudのsoterリクエストとそのdataObjectを、設定された数ないしは周期ごとにia-cloud objectArrayにまとめ、出力メッセージに出力する。  
ia-cloud CCSエンドポイントへの接続回数を削減したり、storeリクエストの間隔を大きく取る目的で使用される。

## 入力メッセージ

- ``msg.request``: ia-cloud CCSへのリクエスト。"store"　のみが有効。
- ``msg.dataObject``: ia-cloud CCSへのstoreリクエストで送出するストアすべきia-cloudオブジェク

例
 ```
{
  "request": "store",
  "dataObject": {
      "objectType" : "iaCloudObject",
      "objectKey" : { string } ,
      "objectDescription" : { string },
      "timestamp" : { string },
      "objectContent" : { iaCloudObjectContent }
  }
}
 ```

## プロパティー

本nodeは以下のプロパティを持つ

| 名称 | 種別 | 説明 | 備考 |
|:----------|:-----:|:-----|:-------|
|Node name|string|objectArray Nodeの名称|
|まとめるオブジェクト数|number| objectArrayにまとめobjectの数。入力メッセージがこの数に達した時点でobjectArrayを出力する。<br>最小1　〜　最大100。 |
|まとめ周期|number| 周期毎にその間に入力された入力メッセージをobjectArrayとしてまとめ、出力メッセージへ出力する。<br>最小10秒。0秒で周期まとめなし。　|　
|オブジェクトキー|string| iaCloudObjectArrayをそのままDB格納する際ののユニークKeyとして使われる。|
|オブジェクトの説明|string| ia-cloudオブジェクトのobjectDescriptionとして使われる。|

** オブジェクトキー、オブジェクトの説明とも、objectArrayをそのままオブジェクトとして取扱う際に必要となる。オブジェクトアレイを個別のオブジェクトに分解し、DB格納する実装では使用されrルコとはないが、必須パラメータである。 **

## 出力メッセージ

- ``msg.payload``:  "sent objectArray" の固定文字列
- ``msg.request``: ia-cloud CCSへのリクエスト。"store"　固定。
- ``msg.dataObject``: ia-cloud CCSへのstoreリクエストで送出するストアすべきia-cloudオブジェクアレイ

例
 ```
{
  "payload":  "sent objectArray",
  "request": "store",
  "dataObject": {
      "objectType" : "iaCloudObjectArray",
      "objectKey" : { string } ,
      "objectDescription" : { string },
      "timestamp" : { string },
      ”length": { number },
      "objectArray" : [{ iaCloudObject }, ......]
  }
}
 ```