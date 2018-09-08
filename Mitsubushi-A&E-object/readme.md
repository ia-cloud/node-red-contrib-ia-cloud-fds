# ModbusA&Eオブジェクトノード

## ia-cloud-ModbusA&EObj

## 機能概要

このノードは、Modbus-com nodeからのデータ変化メッセージを受けて、FlowコンテキストオブジェクトであるModbusLinkObjを参照し、ia-cloudアラーム&イベントデモデルを内包したia-cloudオブジェクトを生成し、ia-cloud CCSへストアーするため、ia-cloud接続nodeに対しA&Eデータオブジェクトを出力メッセージとして送出する。  

起動時（デプロイ時？）には、自身のプロパティにで指定された、Modbus通信を実行するNodeとのデータリンクを実現するためのFlowコンテキストオブジェクトであるデータリンクオブジェクトに対し、プロパティで指定されたデータItem情報に従い、必要なエントリーを追加する。起動時（デプロイ時？）に、プロパティにで指定された、Flowコンテキストオブジェクトであるデータリンクオブジェクトが存在しない場合は、例外を発生する。

## 入力メッセージ

* ``payload``: Modbusアドレス格納値に変化があったModbusアドレスの配列  

このメッセージを受けて、データの変化のあったオブジェクトのストアーを行う。

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
## プロパティー

本nodeは以下のプロパティを持つ

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
| linkObjName|string|読み出すデータのModbusアドレスと、変化時通知のフラグを格納するFlowコンテキストオブジェクトの名称。デフォルトは、ModbusLinkObj。|
|ストア周期|number|Flowコンテキストオブジェクトよりデータを取得し、ia-cloudオブジェクトを生成しia-cloud CCS ヘストアする周期, S（秒）で指定できる。|
|アラーム情報オブジェクト|object| nodeが生成する ia-cloudオブジェクトの情報|

**アラーム情報オブジェクト**

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|オブジェクトキー|string| ia-cloudオブジェクトのobjectKeyとして使われる。|
|オブジェクトの説明|string| ia-cloudオブジェクトのobjectDiscriptionとして使われる。|
|アラーム情報| object| objectContentとして挿入されるアラーム＆イベントモデルを生成するための情報。|

**アラーム情報**
以下のオブジェクトの配列(**複数のアラーム＆Eデータを組み合わせることができる**。)

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|データ名称|string|オブジェクトのデータitemのCommon Name。 "A&E Status"固定。|
|データアドレス| string |A&Eデータ取得するlinkObjのModbusアドレス。"ユニットアドレス:データアドレス"で表される。|
|A&Eコード| string|上記アドレスに対応するA&Eコード。commonName "A&E  code"のvalueにセットされる。文字列であることに注意。|
|A&Eの説明|string|対応するA&Eの説明文字列。commonName "A&E Discpription"のvalueにセットされる。|


## 出力メッセージ

* ``msg.store``：ia-cloud CCSにstoreされるべきia-cloudデータオブジェクト

上述のプロパティを元に、ia-cloudサーバに送出されるia-cloudメッセージボディJSONは、以下のようになる。

例
```
{
	"objectType": "iaCloudObject",
	"objectKey": "「オブジェクトキー」",
	"objectDiscription": "『オブジェクトの説明』"
	"timeStamp": "2018-07-26T23:59:09+09:00",
	"objectContent": {
		"contentType": "Alarm&Event",
		"contentData": [{
			"commonName": "A&E Status",
			"dataValue": "set" / "reset",
		},{
			"commonName": "A&E code",
			"dataValue": 『"2E75"』
		},{
			"commonName": "A&E Discription",
			"dataValue": "A&E 説明文字列"
		},
						:
						:
						:
						:
		]
	}
}
```


## リンクデータオブジェクト（Flowコンテキストオブジェクト）　　
本nodeは起動時（デプロイ時？）に、Modbus機器との通信で取得すべきデータのアドレスと変化通知対象フラグが格納された、Flowコンテキストのオブジェクト**.mobusLinkObj**を生成する。（Modbus通信nodeは、その設定に基づきデータを取得して、取得したデータをそのオブジェクトに格納する。）  
本nodeは、必要なタイミングで、このオブジェクトからデータを読み出し、 ia-cloudオブジェクトのJSON文字列を生成し、 ia-cloudプロトコールで ia-cloudサーバへ送出する。

本オブジェクトの基本仕様は、 ia-cloud-FDS-node.PLCLinkObj_doc.mdを参照のこと。

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
flow.mobusLinkObj = {[
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
