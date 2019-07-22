# HMI-Schneider通信機器関連ノード

## HMI-Schneider、HMI-Schneider-AE
## HMI-Schneider-dataItems、HMI-Schneider-AnE、HMI-Schneider-com

## 機能概要
これら一連のノードは、HMIとの通信を行い、それらの機器が保持するデータ情報を受信して、ia-cloud Center Server（CCS）へ格納するオブジェクトを生成して出力メッセージとして送出する。

#### HMI-Schneider：  
HMIの持つ変数情報を読み出し、ia-cloudオブジェクトを生成するNode。Node-redのUIによる設定のほか、設定ファイルを指定することも可能である。設定ファイルを指定した場合は、複数のia-cloudオブジェクトの設定が可能である。
#### HMI-Schneider-AE：  
HMIの持つビットデータを読み出し、アラーム＆イベント情報を持つia-cloudオブジェクトを生成するNode。Node-redのUIによる設定のほか、設定ファイルを指定することも可能である。設定ファイルを指定した場合は、複数のia-cloudオブジェクトの設定が可能である。
#### HMI-Schneider-com：  
登録されたlinkObj（デバイスアドレスとデータ値等を保持する）から、Modbus通信のデバイスアドレステーブルを作成し、定期的にModbus通信機器と通信を実行、データを取得してlinkObjを更新する設定Node。
#### HMI-Schneider-dataItems：　　
HMI-Schneider NodeのcontentDataを設定する設定Node。ビット列、数値、文字列、数値列の自由な組み合わせを設定可能。
#### HMI-Schneider-AE：　　
HMI-Schneider-AE NodeのcontentDataを設定する設定Node。contentType="Alarm&Event"のcontentDataを設定できる。

### Node間のI/Fで使用されるオブジェクト　　

#### 設定オブジェクト：  
HMI-Schneider、HMI-Schneider-AEの設定情報を保持するオブジェクト。設定ファイルはこのオブジェクトのJSONファイルである。
```
{
  configName: "hmiSchneiderConfig.json",
  comment: "hmi schneider ia-cloud object configration data for test.",  // UIには無い
  dataObjects:    // Node-RED UIで設定されるときは配列要素は1つだけ。
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
        options: {                        //DataItemオプション
          itemType: "bit",
          deviceType: "Coil",
          source:123,
          number: 1,
          logic: "pos"
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
    itemType: "bit",      // 取得するデータの種別、bit(ビット列)
    deviceType: "Coil",   // 取得するビットデータ列のあるデバイス種別（Coil/IS）
    source:123,           // 取得するビットデータ列の先頭デバイスアドレス
    number: 1,            // 取得するビットデータ列のビット数
    logic: "pos"          // 取得するビットデータの論理（pos:1がtrue/neg:0がtrue）
  }
```
データアイテムの設定オプション(number)
```
dataObjects[i].ObjectContent.contentData[i].options = {
    itemType: "number",   // 取得するデータの種別、number(数値)
    deviceType: "IR",     // 取得するデータのあるデバイス種別（HR/IR）
    source:213,           // 取得するデータのあるデバイスアドレス
    type: "1w",           // 取得するデータの種別（1w:ワード、2w_b:ダブルワードビッグエンディアン、2w-l:ダブルワードリトルエンディアン）
    encode: "unsigned",   // 取得するデータの形式(unsigned:符号なし、signed:符号付、BCD:2進化10進)
    offset: 0,            // 取得するデータのゼロ点オフセット
    gain: 1               // 取得するデータの倍率
  }
```
データアイテムの設定オプション(string)
```
dataObjects[i].ObjectContent.contentData[i].options = {
    itemType: "string",   // 取得するデータの種別、string(文字列)
    deviceType: "IR",     // 取得する文字列のあるデバイス種別（HR/IR）
    source:123,           // 取得する文字列の先頭デバイスアドレス
    number: 1,            // 取得する文字列のワード数（文字数では無い、連続ワードデバイスの数）
    encode: "utf-8"       // 取得する文字列のエンコード（utf-8/sJIS/EUC）
  }
```
データアイテムの設定オプション(numList)
```
dataObjects[i].ObjectContent.contentData[i].options = {
    itemType: "numList",  // 取得するデータの種別、numList(数値列)
    deviceType: "HR",     // 取得するデータのあるデバイス種別（HR/IR）
    source:213,           // 取得するデータのあるデバイスアドレス
    number: 1,            // 取得するデータ列の数（ワード数では無い、連続データの数）
    type: "1w",           // 取得するデータの種別（1w:ワード、2w_b:ダブルワードビッグエンディアン、2w-l:ダブルワードリトルエンディアン）
    encode: "unsigned",   // 取得するデータの形式(unsigned:符号なし、signed:符号付、BCD:2進化10進)
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
