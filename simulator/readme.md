# ia-cloud fds nosimulation ノード

## 機能概要
入力メッセージに入力されたデータを、ia-cloudオブジェクトとして出力するノード。センサ機器や計測制御機器が接続されていない環境で、ia-cloudアプリケーションフローの確認やテストに使用するシミュレーターとして使用する。

## 入力メッセージ
ia-cloudオブジェクトのcontentDataとなるデータを含むメッセージ

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|payload|boolean/string/number/object|入力データ| 
|topic|string|入力データの名称。デフォルトでia-cloud contentDataのデータ名称（dataName）に設定される| 

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
    objectContent: {
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
|Node name|string|simulatorノードにつけるの名称|

**オブジェクトの設定**

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|収集周期|number| 定期収集周期。最小10秒。0秒で周期収集なし。　|
|非同期収集|boolean| データ変化時の非同期収集をする。　|
|オブジェクト名称|string| ia-cloudオブジェクトの任意の名称。　|
|オブジェクトキー|string| ia-cloudオブジェクトのobjectKeyとして使われる。|
|オブジェクトの説明|string| ia-cloudオブジェクトのobjectdescriptionとして使われる。|

**データの設定**

|名称　| 種別 | 説明 |
|:----------|:-----:|:--------------------|
|データ項目|string|ia-cloudのcontentDataに含めるデータの入力名称（msg.topic）|
|データ名称|string|ia-cloud contentDataのデータ名称（dataName）。デフォルトで入力メッセージ入力名称に設定される|

```
