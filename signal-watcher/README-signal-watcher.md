# シグナルウォッチャーノード

## signal-watcher

## 機能概要

因幡電機産業株式会社の[シグナルウォッチャー](https://www.inaba.co.jp/ourbusiness/industrial/original/signalwatcher/)が送信する表示灯の点灯状態を受信し、ia-cloudオブジェクトを生成するノードである。
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

### オブジェクト設定タブ

| 名称 | 種別 | 説明 |
| --- | --- | --- |
| 定期収集周期 | number | 定期収集周期。最小10秒。0秒もしくは空欄の場合周期収集なし。*1 |　
| 非同期収集有り | boolean | チェックの場合、データ変化時の非同期収集をする。*2 |　
| EnOcean ID | string | 利用するシグナルウォッチャーのEnOcean ID。 |
| objectキー | string | ia-cloudオブジェクトのobjectKeyとして使われる。 |
| objectの説明 | string | ia-cloudオブジェクトのobjectDescriptionとして使われる。 |

***1: 定期収集周期**

* フローをデプロイしてから一度もデータを受信していない場合は定期収集しない
* 1の位を指定した場合は切り上げる(例: 1秒を指定した場合は10秒周期、15秒を指定した場合は20秒周期、となる)

***2: 非同期収集有り**

* データ設定タブで指定したデータ項目に変化があった場合にのみデータを収集する
* ただし、フローをデプロイしてから最初に受信したデータはデータ設定タブで指定された項目の変化かどうかによらずデータが収集される

### データ設定タブ

|名称　| 種別 | 説明 |
| --- | --- | --- |
| データ構造型 | string | ia-cloudオブジェクトのcontentTypeとして使われる。 |
| データ項目・名称・単位 | object[] | ia-cloudオブジェクトに保持したいデータを指定する。複数指定できる。*1 |

ここで指定したデータ項目のみ出力する。  
オブジェクト設定タブで`非同期収集有り`を選択した場合は、ここで指定したデータ項目に変化があったタイミングで指定したデータ項目をすべて出力する。

***1: データ項目・名称・単位**
データ項目に指定できるデータ項目の種類と、そのデータ項目を指定したとき、ia-cloudオブジェクトのobjectContent.contentDataに出力されるデータを示す。  
ia-cloudオブジェクトのobjectContent.contentDataはオブジェクトの配列であり、各オブジェクトはdataName、dataValue、unitを持つ。

| データ項目 | dataNameに出力する値 | dataValueに出力する値 | unitに出力する値 |
| --- | --- | --- | --- |
| CH1状態 | CH1 | CH1の点灯状態*2 | - |
| CH2状態 | CH2 | CH2の点灯状態*2 | - |
| CH3状態 | CH3 | CH3の点灯状態*2 | - |
| CH4状態 | CH4 | CH4の点灯状態*2 | - |
| 電池状態 | bat | 電池状態(low/mid/high) | - |
| 電波状態 | rssi | 受信したテレグラムの中で最高のRSSI値(16進数の文字列(例  0xFF)) | dBm |
| FWバージョン | fw | FWのバージョン | - |

***2: 点灯状態**
以下のいずれかの値が入る。
* off: 消灯、点滅なし
* on: 点灯、点滅なし
* slowBlink: 点灯、低速点滅
* fastBlink: 点灯、高速点滅
* momentaryOff: 点灯中に瞬時消灯
* momentaryOn: 消灯中に瞬時点灯

## 出力メッセージ

ia-cloud CSへストアするためのメッセージを出力する。

| 名称 | 種別 | 説明 |
| --- | --- | --- |
| request | string | "store"(固定) |
| dataObject | object | ストアするia-cloudオブジェクト |
| payload | object | ia-cloudオブジェクトのcontentData部分 |

**サンプル**

```
msg = {
  request: "store",
  dataObject: {
    objectKey: "com.ia-cloud.........",
    objectType: "iaCloudObject",
    timestamp: "",
    objectDescription: "説明",
    objectContent: {
      contentType: "tempCont",
      contentData": [{
        "dataName"
                .
                .
                .
      }]
    }
  },
  payload: {}
}
```
