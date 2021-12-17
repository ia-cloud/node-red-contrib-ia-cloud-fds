# HMI-Schneider-com 通信ノード

## 機能概要

HMI-Schneider NodeやHMI-Schneider-AE Nodeから登録され、Schneider表示器とWebSocketを使用して通信します。

## 入力メッセージ

なし  

## 出力メッセージ

なし

## プロパティー

本nodeは以下のプロパティを持ちます。

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|ノード名称|string| この設定Nodeにつける任意の名称。|
|Netアドレス|string|Schneider表示器のIPアドレスか、解決可能なHOST名。|
|Etherポート|number|Schneider表示器のポート番号。デフォルト値は8082。|
