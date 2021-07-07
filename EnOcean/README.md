# EnOcean通信ノード

## EnOceanCom

## 機能概要

EnOceanComノードは、EnOcean受信機(USBドングル？)で取得したデータを、そのデータを利用するノード(EnOceanデータ利用ノードと呼ぶ)に渡す機能を提供するNode-REDの設定ノードである。  
EnOceanデータ利用ノードでは、あらかじめLinkObject*1、ノードID、データを参照したいEnOceanデバイスに付与されたEnOceanIDをEnOceanComノードに設定しておく必要がある。  
EnOceanComノードがEnOceanデータを受信すると、このLinkObjectの更新を行い、さらにそのデータを利用したいEnOceanデータ利用ノードにイベントを送信する。  

*1: LinkObjectとはEnOceanComノードとEnOceanデータ利用ノードが共有する変数であり、EnOceanComノードでLinkObjectを変更すると、EnOceanデータ利用ノードからそのデータを参照できる。

## 入力メッセージ

なし

## プロパティ

EnOceanComノードは以下のプロパティを持つ。このプロパティは、EnOceanデータ利用ノードのプロパティの通信ノードから設定できる。

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
| シリアルポート | string | 使用する通信ポート。例: `/dev/tty.usbserial-XXXXXXXX` |

## 出力メッセージ

なし

## EnOceanComノードを利用するEnOceanデータ利用ノードの実装方法

### LinkObjectの登録

EnOceanデータ利用ノードからEnOceanComノードにLinkObjectを登録する。
LinkObjectはJavaScriptのオブジェクトであり、以下のデータを含む。

| Key | 型 | 説明 |
| --- | --- | --- |
| sensorId | string | EnOceanデータ利用ノードで受信したい、EnOceanデータを送信するデバイスに付与されたEnOceanID。 |
| nodeId | string | 実行時にEnOceanデータ利用ノードに付与されるノードのID。 |
| objectKey | string | オブジェクトキー。 |

EnOceanComノードは、ノードの実行時に渡されるconfigのenOceanComを利用して以下のように取得する。

```
const enOceanCom = RED.nodes.getNode(config.enOceanCom)
```

LinkObjectの登録は、上記で取得したenOceanComに`addLinkData`イベント(LinkObjectを含む)を送信する。

```
enOceanCom.emit("addLinkData", linkObj);
```

実装例を以下に示す。

```
const enOceanCom = RED.nodes.getNode(config.enOceanCom)

let linkObj = {
    sensorId: "XXXXXXXX",
    nodeId: "XXXXXXXX.XXXXXX",
    objectKey: "objectkey"
};

enOceanCom.emit("addLinkData", linkObj);
```

### EnOceanデータ受信イベント

EnOceanComノードが、上記のLinkObjectのsensorIdに合致するEnOceanデータを受信すると、EnOceanデータ利用ノードに`changeListener`イベントが送信される。
EnOceanデータ利用ノードで、イベントを受け取った際に、上記のLinkObjectを参照することで受信したデータを参照できる。

```
    this.on("changeListener", (objectKey) => {
        // 登録したLinkObjectの変数に受信したデータが入力されるので必要に応じ操作する
    }
```

受信したデータを含むLinkObjectの形式は以下である。

| Key | 型 | 説明 |
| --- | --- | --- |
| sensorId | string | EnOceanデータ利用ノードで受信したい、EnOceanデータを送信するデバイスに付与されたEnOceanID。 |
| nodeId | string | 実行時にEnOceanデータ利用ノードに付与されるノードのID。 |
| objectKey | string | オブジェクトキー。 |
| value | string | 受信したデータのERP2のRaw Data(16進数の文字列)。例: `0xFFFFFFFF` |
| optionalData | string | 電界強度。例: `0xa6` |
