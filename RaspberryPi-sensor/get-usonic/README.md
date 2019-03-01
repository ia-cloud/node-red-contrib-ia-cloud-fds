# RaspberryPi-HC-SR04_取得ノード

## get-usonic

## 機能概要

このノードは、RaspberryPIに接続された超音波距離測定センサー(HC-SR04)を使い、距離データを取得する。

本ノードにmsgが届くと、センサーへの通信を行い、センサーが得た距離情報をcm単位で取り出し、msgに追加して出力をする。

取得エラーの定義と取り扱いについて検討中。

## 入力メッセージ

* timestamp:  ノードの動作のトリガーとなる。



## プロパティー

本Nodeは以下のプロパティを持つ

| 名称              |  種別  | 説明                                           |
| ----------------- | :----: | ---------------------------------------------- |
| nodeName          | string | Nodeの名称                                     |
| user              | string | 利用者                                         |
| センサー種類      | string | 読み取るセンサーの種類<br />ex. "ct", "usonic" |
| GPIOの端子1の指定 | number | RaspberryPIのGPIOの端子番号1                   |
| GPIOの端子1の種別 | string | 端子番号1につける種別                          |
| GPIOの端子2の指定 | number | RaspberryPIのGPIOの端子番号2                   |
| GPIOの端子2の種別 | string | 端子番号2につける種別                          |



## 出力メッセージ

* ``payload``:  **object**
  * 取得した値を配列に格納する。

| 名称      | 種別   | 説明                                   |
| --------- | ------ | -------------------------------------- |
| user      | string | 利用者                                 |
| timestamp | string | タイムスタンプ                         |
| distance  | string | 距離測定センサーで計測した距離(cm単位) |


```
msg.payload = {
	"user" : { string } ,
	"timestamp" : { string } ,
	"distance" : { string }
}
```

