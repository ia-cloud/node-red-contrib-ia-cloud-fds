# Schneider HMI 通信ノード

## HMI-Schneider-com

## 機能概要
HMI-Schneider NodeやHMI-Schneider-AE Nodeから登録される、HMIとの通信情報を保持するリンクオブジェクト(linkObj)から、HMIの変数テーブルを作成し、HMIの変数に変化があると通知を受信します。受信したデータはHMI-Schneider機器データオブジェクトノードに通知します。

## 入力メッセージ
なし  

## 出力メッセージ
なし

## 外部メソッドと処理の手順
function addLinkData(linkObj)

HMI-Schneider-comにlinkObjを登録する外部メソッド。HMI-Schneider、PLC-Modbue-AEから呼ばれる。
引数は、linkObjである。
HMI-Schneider-comは、linkObjに従って変数情報をHMIにSubscription登録し、変数の変化通知を受信します。HMIからの変化通知はV3.1時点で500msです。
HMIから変数の変化通知を受信すると、linDataに登録されているNode IDを使い登録元のNodeに通知(RED.getnode(nodeID).valueUpdated(variables))します。


## プロパティー

本nodeは以下のプロパティを持つ

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|ノード名称|string| この設定Nodeにつける任意の名称。|
|Netアドレス|string|HMIのIPアドレスか、解決可能なHOST名。|
|Etherポート|number|HMIのポート番号。デフォルト値は8082。|

