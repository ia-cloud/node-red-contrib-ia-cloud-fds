# GrovePI Node とia-cloud-cnct Node をつなぐNode

## gp2iac

## 機能概要

このノードは、RaspberryPIに接続されたGrove Piの各種センサーの値を取得する「node-red-contrib-grovepi」の値を、「ia-cloud-cnct」で処理できる形に変換するノードです。

#### 動作方法について：

- 本ノードに接続している「node-red-contrib-grovepi」で取得するセンサーの種類をプロパティの「Sensor Type」で指定する。
- 入力された値は「ia-cloud-cnct」様式のjasonに変換して出力される。

## 入力メッセージ

* DHT11(温湿度センサー)：
* Ultrasonic Range(超音波測距センサー)：
* Button(Buttonセンサー)：



## プロパティー

本Nodeは以下のプロパティを持つ

| 名称         |  種別  | 説明                                                         |
| ------------ | :----: | ------------------------------------------------------------ |
| name         | string | Nodeの名称                                                   |
| objectKey    | string | 利用者                                                       |
| SensorType   | string | センサータイプを選択                                         |
| dataName1～3 | string | センサーで計測する対象の種類<br /><br />※以下は選択時の自動入力(任意で変更可能)<br />DHT11(温湿度センサー)：<br />        dataName[0] = "温度";<br/>        dataName[1] = "湿度";<br/>        dataName[2] = "ヒートインデックス";<br />    Ultrasonic Range(超音波測距センサー)：<br />        dataName[0] = "距離";<br />        dataName[1] = "dummy";<br/>        dataName[2] = "dummy";<br />    Button(Buttonセンサー)：button<br />        dataName[0] = "ボタンセンサー";<br />        dataName[1] = "dummy";<br/>        dataName[2] = "dummy"; |
| unit1～3     | string | 計測結果の単位<br /><br />※以下は選択時の自動入力(任意で変更可能)<br />DHT11(温湿度センサー)：<br />        unit[0] = "℃";<br/>        unit[1] = "%";<br/>        unit[2] = "HI";<br />    Ultrasonic Range(超音波測距センサー)：<br />        unit[0] = "cm";<br />        unit[1] = "dummy";<br/>        unit[2] = "dummy";<br />    Button(Buttonセンサー)：button<br />        unit[0] = "is_pressed";<br />        unit[1] = "dummy";<br/>        unit[2] = "dummy"; |



## 出力メッセージ

* ``msg``:  **object**
  * 取得した値を配列に格納する。

| 名称       | 種別   | 説明                                                         |
| ---------- | ------ | ------------------------------------------------------------ |
| timestamp  | string | タイムスタンプ(isodatetime)<br />※入力メッセージのtimestampではなく、本ノード内で新たに取得したtimestamp。 |
| objectkey  | string | 利用者                                                       |
| sensortype | string | 選択されたセンサーのタイプ<br />    DHT11(温湿度センサー)：dht11<br />    Ultrasonic Range(超音波測距センサー)：ultrasonic<br />    Button(Buttonセンサー)：button |
| dataName   | string | センサータイプに応じた取得データ名称                         |
| datavalue  | string | センサーが取得した値                                         |
| unit       | string | センサーが取得した値に応じた単位                             |


```
msg = {
    "request": "store",
    "dataObject": {
        "objectType" : "iaCloudObject",
        "objectKey" : {objectkey} ,
        "objectDescription" : "センサーの値",
        "timeStamp" :  {timestamp},
        "ObjectContent" : {
            "contentType": "iaCloudData",
            "contentData":[{
                "dataName": "{dataName[0]}",
                "dataValue": {datavalue[0]},
                "unit": "{unit[0]}"
            },{
                "dataName": "{dataName[1]}",
                "dataValue": {datavalue[1]},
                "unit": "{unit[1]}"
            },{
                "dataName": "{dataName[2]}",
                "dataValue": {datavalue[2]},
                "unit": "{unit[2]}"
            }]
        }
    }
}


```

