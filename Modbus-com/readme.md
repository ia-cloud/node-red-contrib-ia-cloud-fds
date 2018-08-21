# Modbus通信ノード

## ia-cloud-ModbusCom

## 機能概要

このノードは、各種のModbus通信をサポートした工業用計測制御機器から、指定された周期あるいは非同期に、設定されたアドレスのデータを取得しNode-RED FlowコンテキストオブジェクトであるmodbusLinkObjの更新を行う。

本ノードの起動時（デプロイ時？）には、FlowコンテキストオブジェクトであるmodbusLinkObjの生成を行う。このmodbusLinkObjには、Modbus-Objectノードがそれぞれのノードインスタンスで使用するModbusアドレスを登録し、本ノードはそれを参照して、必要なModbus通信を行いデータの更新を行う。

## 入力メッセージ

* ``payload``: 非同期のデータ取得更新トリガー。標準のinjectノードの接続を想定している。payloadの内容がtrueである場合、非同期でのデータ収集をトリガーする。

## プロパティー

本nodeは以下のプロパティを持つ

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
| linkObjName| string| 取得したModbusデータを格納するオブジェクト名称。デフォルト値は、「ModbusLinkObj」|
|更新周期|number|ModbusDeviceとの通信により、データを取得し、FlowオブジェクトModbusDataObjを更新する周期。mS（ミリ秒）,S（秒）で指定できる。|
|Modbus通信|object|Modbus TCP, Modbus RTU, Modbus ASCII のいずれか。|

Modbus通信が Modbus TCPの場合

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|"port"|string|使用する通信ポート。例: eth0|
|"address"|string|IPアドレスか解決可能なHOST名|

Modbus通信が Modbus RTU or Modbus ASCII の場合

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|port|string|使用する通信ポート。例: COM1|
|ボーレート|string|シリアル通信のボーレート。|
|パリティ|string|シリアル通信のパリティビット。無効・偶数・奇数のいずれか。|

## 出力メッセージ

* ``payload``: Modbusアドレス格納値に変化があったModbusアドレスの配列  

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|"addresses"|[string]|["address 1", "address 2", "adrdess 3", .... "address n"]  

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|"address n"|string|"ユニットアドレス:データアドレス"|

	サンプル
```
 msg.payload = {[
	 "2:4123",
	 "1:4678",
	 "1:1748"
	 ]}
```

## リンクデータオブジェクト（Flowコンテキストオブジェクト）　　
本nodeは、Modbus機器との通信のアドレス、変化通知対象フラグの格納されたFlowコンテキストのオブジェクトを参照し、その設定に基づきデータを取得して、取得したデータをそのオブジェクトに格納する。  
本オブジェクトの基本仕様は、 ia-cloud-FDS-node.dataLinkObj_doc.mdを参照のこと。
このFlowコンテキストのオブジェクトは、ia-cloud-PLC nodeのデプロイ時（起動時？）にそのnodeのプロパティ設定に応じて生成される。DataObjNameプロパティで設定されたFlowコンテキストオブジェクトが存在しない場合は、本nodeはエラーメッセージを出力し動作を停止する。  

Modbus依存の要素は以下の通り  

| 要素 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
| address | string | "ユニットアドレス:データアドレス"で表現された、Modbusアドレス。ユニットアドレス：データアドレスいずれも10進数文字列表現。|
|notify| boolean |データの変化時に出力メッセージにアドレスを出力するかのフラグ|
|value| number |ModbusDeviceとの通信により取得したデータ。32bitデバイスの場合　-32768〜32767、ビットデバイスの場合 0 or 1。|

ユニットアドレス：  
Modbus RTU、Modbus ASCII の場合はRS485子機アドレス（1〜255）、Modbus TCPの場合はユニット番号（1〜255）

DataLinkObjの例
```
flow.mobusDatObj = {[
	{
		"address": "2:4123",
		"notify": true,
		"value": 567
	},{
		"address": "1:4678",
		"notify": true,
		"value": 2795
	},{
		"address": "1:1748",
		"notify": false,
		"value": 12
	}
]}
```
