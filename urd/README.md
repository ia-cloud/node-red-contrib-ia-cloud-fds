# URDセンサー通信Node

## 機能概要

このNodeは、URD社製のEnOcean通信をサポートしたセンサーデバイスから、受信用USBモジュールを介してEnOcean通信データを受信し、ia-cloud Center Server（CCS）へ格納するオブジェクトを生成して出力メッセージとして送出する。

## プロパティ

### urd-obj

以下のプロパティを持つ。

| 名称 | 種別 | 説明 |
|:----------|:-----:|:-----|
|名前|string|urd-obj Nodeの表示名。|
|センサー種別|select|接続するセンサーを選択する。対応するセンサーは以下。<ul><li>1ch電流センサー : WTK-WLSX2シリーズ</li><li>3ch電流センサー : CWD-3-1</li></ul>|
|オブジェクトキー|string|ia-cloudオブジェクトのobjectKeyとして使われる。|
|オブジェクトの説明|string|ia-cloudオブジェクトのobjectDescriptionとして使われる。|
|センサーオブジェクト|設定Node|使用するセンサーの項目設定を行う。対応する設定Nodeはセンサー種別に依存する。<ul><li>1ch電流センサー : urd-ac-1ch-node</li><li>3ch電流センサー : urd-ac-3ch-node</li></ul>|
|URDセンサー通信オブジェクト|設定Node|urd-com Node。センサーとの通信に用いる受信用USBモジュールの設定を行う。|

### urd-com

URDセンサー通信オブジェクトの設定ノード。以下のプロパティを持つ。

| 名称 | 種別 | 説明 |
|:----------|:-----:|:-----|
|名前|string|設定Nodeの表示名。|
|シリアルポート|設定Node|使用するシリアルポートを設定する。|

### urd-ac-1ch-node

1ch電流センサー[WTK-WLSX2シリーズ]用のセンサーオブジェクトの設定ノード。

| 名称 | 種別 | 説明 |
|:----------|:-----:|:-----|
|名前|string|設定Nodeの表示名。|
|センサーID|select|接続するセンサーIDを入力する。|
|データ名称|string|オブジェクトのデータitemの名称。ia-cloudデータモデルのdataNameとして使用される。|
|単位|string|データアイテムの値の単位。ia-cloudデータモデルのunitとして使用される。|

### urd-ac-3ch-node

3ch電流センサー[CWD-3-1]用のセンサーオブジェクトの設定ノード。  
センサー測定部(クランプ)が接続されていない部位(チャンネル)の出力は、0Aとなる。

| 名称 | 種別 | 説明 |
|:----------|:-----:|:-----|
|名前|string|設定Nodeの表示名。|
|センサーID|select|接続するセンサーIDを入力する。|
|データ名称(1~3)|string|センサーを取り付けた部位の名称。dataObjectを格納する際のdataNameとして使われる。|
|単位(1~3)|string|データアイテムの値の単位。ia-cloudデータモデルのunitとして使用される。|
|レンジ(1~3)|設定Node|クランプの測定倍率。クランプのサイズによって倍率が異なり、<br>φ10,φ16,φ24のクランプの倍率は400、φ36のクランプの倍率は700となる。任意の倍率の設定も可能。|

## 入力メッセージ

なし

## 出力メッセージ

- ``msg.request``: ia-cloud CCSへのリクエスト。"store"固定。
- ``msg.dataObject``: ia-cloud CCSへのstoreリクエストで送出するia-cloudオブジェクト。

    サンプル
```
msg = {
  "request": "store",
  "dataObject": {
    "objectKey": "string",
    "timeStamp": "YYYY-MM-DDThh:mm:ss+09:00",
    "objectType": "iaCloudObject",
    "objectDescription": "string",
    "objectContent": {
      "contentType": "iaCloudData",
      "contentData": [
        {
          "dataValue": value,
          "unit": "string",
          "dataName": "string"
        },
        ...
      ]
    }
  }
}
```

