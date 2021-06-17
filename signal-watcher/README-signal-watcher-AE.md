# シグナルウォッチャーアラーム&イベントオブジェクトノード

## signal-watcher-AE

## 機能概要

因幡電機産業株式会社の[シグナルウォッチャー](https://www.inaba.co.jp/ourbusiness/industrial/original/signalwatcher/)が送信する表示灯の点灯状態を受信し、Alarm&EventのcontentTypeを持つia-cloudオブジェクトを生成するノードである。  
設定ノードであるEnOceanComノードを利用する。

動作確認に利用した機器は以下である。

* シグナルウォッチャー: SE-SW001A
* EnOcean受信機: USB型EnOcean受信機  USB400J (S3064-K400)

## 入力メッセージ

ia-cloudオブジェクトを送出するタイミングを指示するメッセージを入力する。

| 名称 | 種別 | 説明 |
| --- | --- | --- |
| payload | boolean/string/number/object | NULL, 0, false, undefined以外の時、その時点での最後に受信したEnOceanデータから生成したia-cloudオブジェクトを出力する。 |

## プロパティ

シグナルウォッチャーノードは以下のプロパティを持つ。このプロパティは、Node-REDの画面から設定できる。

### オブジェクト設定

| 名称 | 種別 | 説明 |
| --- | --- | --- |
| 定期収集周期 | number | 定期収集周期。最小10秒。0秒もしくは空欄の場合周期収集なし。 |　
| 非同期収集有り | boolean | チェックの場合、データ変化時の非同期収集をする。 |　
| EnOcean ID | string | 利用するシグナルウォッチャーのEnOcean ID。 |
| objectキー | string | ia-cloudオブジェクトのobjectKeyとして使われる。 |
| objectの説明 | string | ia-cloudオブジェクトのobjectDescriptionとして使われる。 |

### 警報・イベント設定

|名称　| 種別 | 説明 |
| --- | --- | --- |
| データ構造型 | string | ia-cloudオブジェクトのcontentTypeとして使われる。 |
| AnE対象 | object[] | 警報・イベントの発生条件を指定する。複数指定できる。*1 |

***1: AnE対象**
AnE対象項目に指定できる条件と、その条件に合致したとき、ia-cloudオブジェクトのobjectContent.contentData.dataValueに出力されるデータを示す。  
ia-cloudオブジェクトのobjectContent.contentDataはオブジェクトの配列であり、各オブジェクトはcommonNameとdataValueを持つ。
commonNameは`alarm&Event`固定であり、dataValueはdataName、AnE、AnECode、AnEDescription、AnEStatusを持つ。

| データ項目 | dataName | AnE | AnECode | AnEDescription | AnEStatus | 
| --- | --- | --- | --- | --- | --- |
| CH1状態 | CH1 | 通知対象状態*2 | 画面でA&Eコードに設定した値 | 画面でA&Eの説明に設定した値 | A&Eの状態*3 |
| CH2状態 | CH2 | 通知対象状態*2 | 画面でA&Eコードに設定した値 | 画面でA&Eの説明に設定した値 | A&Eの状態*3 |
| CH3状態 | CH3 | 通知対象状態*2 | 画面でA&Eコードに設定した値 | 画面でA&Eの説明に設定した値 | A&Eの状態*3 |
| CH4状態 | CH4 | 通知対象状態*2 | 画面でA&Eコードに設定した値 | 画面でA&Eの説明に設定した値 | A&Eの状態*3 |
| 電池状態 | bat | 通知対象状態*2 | 画面でA&Eコードに設定した値 | 画面でA&Eの説明に設定した値 | A&Eの状態*3 |

***2: 通知対象状態**
以下のいずれかの値が入る。
* off: 消灯、点滅なし
* on: 点灯、点滅なし
* slowBlink: 点灯、低速点滅
* fastBlink: 点灯、高速点滅
* momentaryOff: 点灯中に瞬時消灯
* momentaryOn: 消灯中に瞬時点灯
* low: 電圧低下(dataNameがbatのときのみ有効)

***3: A&E状態**
on/set/off/resetのいずれかの値が入る。各状態の意味は以下である。

| | 前回の通知 | 今回の通知 |
| --- | --- | --- |
| on | 通知対象状態である | 通知対象状態である |
| set | 通知対象状態ではない | 通知対象状態である |
| off | 通知対象状態ではない | 通知対象状態ではない |
| reset | 通知対象状態である | 通知対象状態ではない |

## 出力メッセージ

ia-cloud CSへストアするためのメッセージを出力する。

| 名称 | 種別 | 説明 |
| --- | --- | --- |
| request | string | "store"(固定) |
| dataObject | object | ストアするia-cloudオブジェクト |
| payload | object | ia-cloudオブジェクトのcontentData部分 |

**サンプル**

サンプル
```
msg = {
  request: "store",
  dataObject: {
    objectKey: "com.ia-cloud.........",
    objectType: "iaCloudObject",
    objectDescription: "説明",
    objectContent: {
      contentType: "Alarm&Event",
      contentData: [
        {
          commonName: "alarm&Event",
          dataValue: {
            dataName: "CH1",
            AnE: "on",
            AnEStatus: "set",
            AnECode: "E309",
            AnEdescription: "XXエラー発生"}
        },{
          commonName: "alarm&Event",
          dataValue: {
            dataName: "bat",
            AnE: "low",
            AnEStatus: "reset",
            AnECode: "W590",
            AnEdescription: "電圧低下"}
        }
                .
                .
                .
      ]
    }
  }
}
```
