# HMI-Schneider-com 通信ノード

## 機能概要

HMI-Schneider NodeやHMI-Schneider-AE Nodeから登録され、HMIとWebSocketを使用して通信します。

## 入力メッセージ

なし  

## 出力メッセージ

なし

## プロパティー

本nodeは以下のプロパティを持つ

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|ノード名称|string| この設定Nodeにつける任意の名称。|
|Netアドレス|string|HMIのIPアドレスか、解決可能なHOST名。|
|Etherポート|number|HMIのポート番号。デフォルト値は8082。|
