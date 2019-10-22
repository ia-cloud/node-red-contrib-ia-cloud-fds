# EnOcean通信ノード

## ia-cloud-EnOceanCom

## 機能概要

このノードは、各種のEnOcean通信をサポートしたセンサデバイスから、EnOcean通信を受診し、各センサIDごとのESP（EnOcean Serial Protcol）電文をlowコンテキストオブジェクトであるenOceanLinkObjに格納する。

本ノードの起動時（デプロイ時？）には、FlowコンテキストオブジェクトであるenOceanLinkObjの生成を行う。このenOceanLinkObjには、enOcean-Objectノードがそれぞれのノードインスタンスで使用するenOceanセンサIDを登録し、本ノードはそれを参照して、必要なenOcean通信を受診データの更新を行う。

## 入力メッセージ

なし

## プロパティー

本nodeは以下のプロパティを持つ

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
| linkObjName| string| 取得したEnOceanデータを格納するオブジェクト名称。デフォルト値は、「enOceanLinkObj」|
| port|string|使用する通信ポート。例: COM1|

## 出力メッセージ

* ``payload``: EnOceanの格納値に変化があったセンサIDの配列  

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

## リンクデータオブジェクト（Flowコンテキストオブジェクト）　　
本nodeは、EnOcean機器のセンサID、変化通知対象フラグの格納されたFlowコンテキストのオブジェクトを参照し、その設定に基づきデータを取得して、取得したデータをそのオブジェクトに格納する。  
本オブジェクトの基本仕様は、 ia-cloud-FDS-node.dataLinkObj_doc.mdを参照のこと。
このFlowコンテキストのオブジェクトは、ia-cloud-enOcean nodeのデプロイ時（起動時？）にそのnodeのプロパティ設定に応じて生成される。DataObjNameプロパティで設定されたFlowコンテキストオブジェクトが存在しない場合は、本nodeはエラーメッセージを出力し動作を停止する。  

EnOcean依存の要素は以下の通り  

| 要素 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
| address | string | EnOceanのセンサIDア。16進数文字列表現。|
|notify| boolean |データの変化時に出力メッセージにアドレスを出力するかのフラグ|
|value| string |EnOceanDeviceからの通信により取得したデータ。センサのプロファイルにより可変長。|

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
