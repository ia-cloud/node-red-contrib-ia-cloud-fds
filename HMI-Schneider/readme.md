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

