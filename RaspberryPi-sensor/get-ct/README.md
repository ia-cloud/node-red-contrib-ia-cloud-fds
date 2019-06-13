# RaspberryPi-HC-SR04_取得ノード

## get-ct

## 機能概要

このノードは、RaspberryPIに接続された電流センサー(CTセンサー：SR-3702)を使い、コンセントに流れている電流のデータを取得する。センサーへの通信を行い、センサーが得た電流の値を単位で取り出し、msgに追加して出力をする。

取得エラーの定義と取り扱いについて検討中。

#### 動作方法について：

- 本ノード単独で自動実行(プロパティて繰り返し設定をすることにより実行)
- injectionノードからのtimestamp信号をトリガーとしての実行

## 入力メッセージ

* timestamp:  ノードの動作のトリガーとなる。



## プロパティー

本Nodeは以下のプロパティを持つ

| 名称     |  種別   | 説明                                                         |
| -------- | :-----: | ------------------------------------------------------------ |
| name     | string  | Nodeの名称                                                   |
| user     | string  | 利用者                                                       |
| repeat   | boolean | 繰り返し取得するかの設定<br />(設定をOnにすることにより、本ノード単独で取得動作が実行される) |
| interval | number  | 繰り返しの際の周期(ミリ秒)                                   |



## 出力メッセージ

* ``msg``:  **object**
  * 取得した値を配列に格納する。

| 名称      | 種別   | 説明                                                         |
| --------- | ------ | ------------------------------------------------------------ |
| timestamp | string | タイムスタンプ(isodatetime)<br />※入力メッセージのtimestampではなく、本ノード内で新たに取得したtimestamp。 |
| user      | string | 利用者                                                       |
| volts     | string | 電流センサーで計測した電圧(V)                                |


```
msg = {
    "request": "store",
    "dataObject": {
        "objectType" : "iaCloudObject",
        "objectKey" : "rmc-iot-santama." + {user} + ".nrct-sensors" ,
        "objectDescription" : "センサーの値",
        "timeStamp" :  {timestamp},
        "ObjectContent" : {
            "contentType": "com.ia-cloud.contenttype.hackathon2017.temp01",
            "contentData":[{
                "commonName": "Column1",
                "dataName": "CTセンサー",
                "dataValue": {volts},
                "unit": "V"
            },{
                "commonName": "Column2",
                "dataName": "ダミー",
                "dataValue": 0,
                "unit": "value"
            },{
                "commonName": "Column3",
                "dataName": "ダミー",
                "dataValue": 0,
                "unit": "value"
            },{
                "commonName": "Column4",
                "dataName": "ダミー",
                "dataValue": 0,
                "unit": "value"
            },{
                "commonName": "Column5",
                "dataName": "ダミー",
                "dataValue": 0,
                "unit": "value"
            },{
                "commonName": "Column6",
                "dataName": "ダミー",
                "dataValue": 0,
                "unit": "value"
            }]
        }
    }
}


```

