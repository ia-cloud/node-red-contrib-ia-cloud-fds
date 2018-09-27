# EnOcean機器オブジェクトノード

## ia-cloud-EnOceanObj

## 機能概要

このノードは、FlowコンテキストオブジェクトであるEnOceanリンクオブジェクトを参照し、一定周期あるいは非同期に、ia-cloudオブジェクトを生成し、ia-cloud CCSへストアーするため、ia-cloud接続nodeに対しEnOceanデータオブジェクトを出力メッセージとして送出する。　
起動時（デプロイ時？）には、自身のプロパティにで指定された、EnOcean通信を実行するNodeとのデータリンクを実現するためのFlowコンテキストオブジェクトであるデータリンクオブジェクトに対し、プロッパティで指定されたデータItem情報に従い、必要なエントリーを追加する。起動時（デプロイ時？）に、プロパティにで指定された、Flowコンテキストオブジェクトであるデータリンクオブジェクトが存在しない場合は、例外を発生する。

***複数のセンサモジュールのデータを一度に格納するEnOcean Object Array nodeを作る必要があるかもしれない。***

## 入力メッセージ

* ``payload``: EnOceanのdataLinkObjの格納値に変化があったEnOceanセンサIDの配列  

このメッセージを受けて、データの変化のあったオブジェクトのストアーを行う。

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|sensorID|[string]|["sensorID 1", "sensorID 2", "sensorID 3", .... "sensorID n"]  

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|"sensorID n"|string|"EnOcean sensor ID"|

	サンプル
```
 msg.payload = {[
	 "40001162",
	 "0028E83C",
	 "0400D857"
	 ]}
```

## プロパティー

本nodeは以下のプロパティを持つ

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
| linkObjName|string|受信するEnOceanセンサIDと、変化時通知のフラグを格納するFlowコンテキストオブジェクトの名称。デフォルトは、EnOceanLinkObj。|
|ストア周期|number|Flowコンテキストオブジェクトよりデータを取得し、ia-cloudオブジェクトを生成しia-cloud CCS ヘストアする周期, S（秒）で指定できる。|
|収集データオブジェクト|object| nodeが生成する ia-cloudオブジェクトの情報|

**収集データオブジェクト**

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|オブジェクトキー|string| ia-cloudオブジェクトのobjectKeyとして使われる。|
| センサID | string | データを取得するEnOcean通信のセンサID |
| notify | string | データを取得するEnOcean通信のセンサID |
|オブジェクトの説明|string| ia-cloudオブジェクトのobjectDiscriptionとして使われる。|
|データitem情報| object| objectContentとして挿入されるオブジェクトを生成するための情報。|

**データitem情報**
以下のオブジェクトの配列(複数のデーitemを組み合わせることができる。)

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|データ名称|string|オブジェクトのデータitemの名称。 ia-cloudデータモデルのdataNameとして使用される。|
|センサCH番号| string |データを取得するlinkObjのEnOceanセンサIDのCH番号。|
|データ種別| string |データドレスが示す内容のデータ形式。URD1CH、Watty4CHのいずれか。|


## 出力メッセージ

ia-cloudに送出されるia-cloudリクエストとなるオブジェクト。
ia-cloud-cnct nodeの入力メッセージとなり、 ia-cloudサーバへリクエストとして送出される。

1CH電流センサの例(URD1CH)
```
{
{
	"objectType": "iaCloudObject",
	"objectKey": "「オブジェクトキー」",
	"objectDiscription": "『オブジェクトの説明』"
	"timeStamp": "2018-07-26T23:59:09+09:00",
	"objectContent": {
			"contentType": "iaCloudData",
			"contentData": [{
				"dataName": "「データ名称」",
				"dataValue": 2.74,
				"unit": "A"
			}]
		}
	}
}
```
4CH温度センサの例(Watty4CH)
```
{
	"objectType": "iaCloudObject",
	"objectKey": "「オブジェクトキー」",
	"objectDiscription": "『オブジェクトの説明』"
	"timeStamp": "2018-07-26T23:59:09+09:00",
	"objectContent": {
		"contentType": "iaCloudData",
		"contentData": [{
			"dataName": "「データ名称」",
			"dataValue": 22.4』,
			"unit": "°C"
		},{
			"dataName": "「データ名称」",
			"dataValue": 35.2
			"unit": "°C"
		},{
			"dataName": "「データ名称」",
			"dataValue": 45.7
			"unit": "°C"
		},{
			"dataName": "「データ名称」",
			"dataValue": 28.8
			"unit": "°C"
		}]
	}
}

```

## リンクデータオブジェクト（Flowコンテキストオブジェクト）　　
本nodeは起動時（デプロイ時？）に、EnOcean機器との通信で取得すべきデータのセンサIDと変化通知対象フラグが格納された、Flowコンテキストのオブジェクト**.enOceanLinkObj**を生成する。（EnOcean通信nodeは、その設定に基づきデータを取得して、取得したデータをそのオブジェクトに格納する。）  
本nodeは、必要なタイミングで、このオブジェクトからデータを読み出し、 ia-cloudオブジェクトのJSON文字列を生成し、 ia-cloudプロトコールで ia-cloudサーバへ送出する。

本オブジェクトの基本仕様は、 ia-cloud-FDS-node.dataLinkObj_doc.mdを参照のこと。

EnOcean依存の要素は以下の通り  

| 要素 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
| address | string | EnOceanのセンサIDア。16進数文字列表現。|
|notify| boolean |データの変化時に出力メッセージにアドレスを出力するかのフラグ|
|value| string |EnOceanDeviceからの通信により取得したデータ。バイナリー電文の16進文字列（0x）表現。センサのプロファイルにより可変長。|

enOceanLinkObjの例
```
flow.enOceanDatObj = {[
	{
		"address": "04009AAB",
		"notify": true,
		"value": "0x4e18cc6a"
	},{
		"address": "04009630",
		"notify": true,
		"value": "0x4e18cc6a"
	},{
		"address": "0400A88D",
		"notify": false,
		"value":  "0x0020ef71"
	}
]}
```
