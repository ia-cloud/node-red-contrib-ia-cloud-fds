# Modbus通信ノード

## Modbus-com

## 機能概要
PLC-Modbus NodeやPLC-Modbus-AE Nodeから登録される、Modbus機器との通信情報を保持するリンクオブジェクト(linkObj)から、Modbus通信のデバイスアドレステーブルを作成し、定期的にModbus通信機器と通信を実行、データを取得してlinkObjを更新する設定Node。  
linkObjには、通信で取得すべきModbus機器のデバイス種別、デバイスアドレス、取得したデータの値、前回のデータの値、このリンクデータを使用するNodeのID,このデータから生成されるia-cloudオブジェクトのobjectKeyが格納される。詳細は、後述のリンクオブジェクト構造を参照のこと。

## 入力メッセージ
なし  

## 出力メッセージ
なし

## 外部メソッドと処理の手順
function modbusCom.addLinkData(linkObj)

Modbus-comにlinkObjを登録する外部メソッド。PLC-Modbus、PLC-Modbue-AEから呼ばれる。
引数は、linkObjである。
Modbus-comは、Modbus通信周期毎にlinkObjをスキャンし、Modbus通信でアクセスすべきアドレスのデバイス毎のテーブルを作成する。重複を削除し、昇順にソートする。
ソートされたテーブルをから。連続領域で読出しできる範囲を決定し、連続読出しの通信パラメータを設定し通信を実施、データ値を取得して、linkDataを更新する。
取得したデータに変化があった場合(value != preValue)は、linDataに登録されているNode IDを使い登録元のNodeのリスナーファンクション、　RED.getnode(nodeID).linkDataChangeListener(objectKey)をコールする。

*** 現在の実装は、通信周期毎に行う実装になっているが、addLinkDataは各Nodeのデプロイ直後に一度呼ばれるだけなので、無駄な処理を行なっている。addLinkData()実行時に行う、最初の通信周期の時のみ行う、などの検討が必要。***

## プロパティー

本nodeは以下のプロパティを持つ

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|Node名称|string| この設定Nodeにつける任意の名称。|
|通信周期|number|ModbusDeviceとの通信により、データを取得し、linkObjを更新する周期。秒で指定できる。最小設定値 0.1秒。|
|連続読出数|number|Modbus通信での読出し時時に、連続して読出しできる最大のワード数。Modbus機器に依存する。|
|連続限定|boolean|Modbus通信での読出し時時に、アドレスの不連続領域の読出しを禁止するフラグ。Modbus機器に依存する。|
|Modbus通信種別|string|Modbus TCP, Modbus RTU, Modbus ASCII のいずれか。|

Modbus通信が Modbus TCPの場合

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|イーサポート名|string|使用する通信ポート。例: eth0|
|通信アドレス|string|Modbus機器のIPアドレスか、解決可能なHOST名。|
|ユニットID|string|Modbus通信機器のユニットID。|

Modbus通信が Modbus RTU or Modbus ASCII の場合

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|通信ポート名|string|使用する通信ポート。例: COM1|
|通信アドレス|string|Modbus通信の機器アドレス。|
|ボーレート|string|シリアル通信のボーレート。|
|パリティ|string|シリアル通信のパリティビット。無効・偶数・奇数のいずれか。|

#### リンクオブジェクト(linkObj)：
リンクオブジェクト(linkObj)は、Modbusデバイス毎に、アドレスや取得したデータ値を保持するlinkDataを格納した配列を持つオブジェクトである。
```
{Coil:[linkData,], IS:[linkData], IR:[linkData,], HR:[linkData,]}
```
##### リンクデータ(linkData)  
リンクデータ(linkData)は、以下の構造を持つオブジェクトである。複数のNodeやia-cloudオブジェクトから参照されるデバイスアドレスは、nodeIdやobjectKeyの値が異なる複数のlinkDataが存在する。
```
{
    address: "12345", // Modbusデバイスアドレス
    value: "0x13e8",  // 通信で取得された値(bitデバイス："0"/"1"、ワードデバイス："0xoooo"16ビットのHex表現文字列)
    preValue: "",     // 1回前の取得データ
    nodeId: "6171c4a8.ca11fc",      // このリンクデータを利用するNodeのID
    objectKey: "com.ia-cloud.hoge"  // このリンクデータを利用するia-cloudオブジェクトのobjectKey
}
```
