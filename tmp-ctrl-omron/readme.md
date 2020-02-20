# Omron温度調節計Modbus通信接続ノード

## tmp-ctrl-omron、tmp-ctrl-omron-AE

## 機能概要
これら一連のノードは、Omron製温度調節計とModbus通信で接続し、温度調節計が保持するデータを読み出して、ia-cloud Center Server（CCS）へ格納するオブジェクトを生成して出力メッセージとして送出する。

![構成図](構成図.png)

#### tmp-ctrl-omron：  
Omron製温度調節計の持つ運転データや設定データ等を読み出し、ia-cloudオブジェクトを生成するNode。Node-redのUIによる設定のほか、設定ファイルを指定することも可能である。設定ファイルを指定した場合は、複数のia-cloudオブジェクトの設定が可能である（実際にはほとんど使わないが・・・）。  
contentType="TempContData"のcontentDataを設定できる。
#### tmp-ctrl-omron-AE：  
Omron製温度調節計の持つステータスデータや警報データを読み出し、アラーム＆イベント情報を持つia-cloudオブジェクトを生成するNode。Node-redのUIによる設定のほか、設定ファイルを指定することも可能である。設定ファイルを指定した場合は、複数のia-cloudオブジェクトの設定が可能である（実際にはほとんど使わないが・・・）。  
contentType="Alarm&Event"のcontentDataを設定できる。
#### PLC-Modbus/Modbus-com：  
PLC登録されたlinkObj（デバイスアドレスとデータ値等を保持する）から、Modbus通信のデバイスアドレステーブルを作成し、定期的にModbus通信機器と通信を実行、データを取得してlinkObjを更新する設定Node。

### Node間のI/Fで使用されるオブジェクト　　

#### 設定オブジェクト：  
PLC-Modbus、PLC-Modbus-AEの設定情報を保持するオブジェクト。
```
{
  "targetNodeName": "{設定データが対象とする nodeの名称}",
  "comment": "{設定データに関する説明}",
  "dataObjects":    // Node-RED UIで設定されるときは配列要素は1つだけ。
    [{
      objectName: "bit系データ",
      objectKey: "com.atbridge-cnsltg.node-RED.test1",
      objectType: "iaCloudObject",
      objectDescription: "modbusのビット系データ",
      options:{storeInterval: 60, storeAsync: true},   // オブジェクトのオプション
      ObjectContent: {
        contentType: "PLC-bit",
        contentData: [{
          dataName: "装置I稼働",
          unit: "°C",
          options: {                        //DataItemオプション
            source: pv,
          }
        },   ........  ]  // 一つ以上のデータアイテム
    }
  },  ........  ]       // UIの場合は一つのia-cloudオブジェクト、設定ファイルの場合は一つ以上のia-cloudオブジェクト
}
```
ia-cloudオブジェクトの設定オプション
```
dataObjects[i].options = {
  storeInterval: 60,    // 定期収集周期（秒）最小値10秒
  storeAsync: true      // データ変化時の非同期収集の有無
  }
```
データアイテムの設定オプション(bit列)
```
dataObjects[i].ObjectContent.contentData[i].options = {
    source:123,           // 取得するビットデータ
  }
```

#### リンクオブジェクト(linkObj)：
```
{Coil:[linkData,], IS:[linkData], IR:[linkData,], HR:[linkData,]}
```
リンクデータ(linkData)  
複数のNodeやia-cloudオブジェクトから参照されるデバイスアドレスは、linkDataも複数存在する。
```
{
    address: 0,       // Modbusデバイスアドレス
    value: "",        // 通信で取得された値(bitデバイス："0"/"1"、ワードデバイス："0xoooo"16ビットのHex表現文字列)
    preValue: "",     // 1回前の取得データ
    nodeId: null,     // このリンクデータを利用するNodeのID
    objectKey: ""     // このリンクデータを利用するia-cloudオブジェクトのobjectKey
}
```
