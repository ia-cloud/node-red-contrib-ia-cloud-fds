# ia-cloud接続ノード

## ia-cloud-cnct

## 機能概要
　
本nodeは、起動時（デプロイ時？）に設定された自身のプロパティに従い、ia-cloudサーバへ接続**connect**リクエストをこない、serviceIDを取得し、ia-cloud接続情報オブジェクト**ia-cloud-conf**を生成する。
ia-cloud接続情報は、Flowコンテキストオブジェクトを通じて他のia-cloudオブジェクトnodeから参照できる。

Flowの終了時には、接続されている ia-cloudサーバに対し、**disconnect** リクエストを発行して接続を終了し、ia-cloud接続情報オブジェクト**ia-cloud-conf**を削除する。

## 入力メッセージ

 * ``msg.payload``: ia-cloud CCSへのリクエストで早出するJSONボディ文字列。仕様上の定義されているkeyの値が、nullか""（空文字列）の場合、nodeのプロパティで設定されている値が使用される。ただし、"timestamp"の場合は、現在時刻が使用される。

例
 ```
{
	"request" : "connect",
	"Authorization" : "",
	"FDSKey" : "" ,
	"FDSType" : "iaCloudFDS",
	"timestamp" : "",
	"comment" : "コメント"
}
 ```
 の場合、認証データとFDSKeyには、このnodeインスタンスに設定されている値が代入され、timestampには、現在時刻がセットされる。

 * ``msg.connect``: ia-cloudのconnectリクエストで早出するia-cloudオブジェクト。
 * ``msg.store``: ia-cloudのstoreリクエストで早出するia-cloudオブジェクト。
 * ``msg.retrieve``: ia-cloudのretrieveリクエストで早出するia-cloudオブジェクト。


入力メーッセージオブジェクトに、これらのエントリーが複数存在した場合、以下の順位で最初のエントリーのみを有効とする。

payload -> connect -> store -> retrieve

## プロパティー

本nodeは以下のプロパティを持つ

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
|ia-cloudサーバ名称|string|接続先の ia-cloudサーバの名称。|
|ia-cloudサーバurl|string|接続先の ia-cloudサーバのurl。|
|ID|string|接続先の ia-cloudサーバの認証用のID。|
|パスワード|string|接続先の ia-cloudサーバの認証用のパスワード。|
|データソースキー|string|このデータソース(FDS)につけるユニークなキー|
|コメント|string|このデータオブジェクトソース(FDS)につけるコメント|
|タイムゾーン|string|この接続でしようするタイムスタンプのタイムゾーン|

## 出力メッセージ

* ``payload``:  ia-cloudサーバへconnectやstoreなどのリクエストをした結果、返されたJSON文字列。下位レベルのエラーがなければ、以下のJSONが出力される。

**connectリクエストの場合**
```
msg.payload = {
	"userID" : { string } ,
	"FDSKey" : { string } ,
	"FDSType" : "iaCloudFDS",
	"serviceID" : { string }
}
```

**storeリクエストの場合**
```
msg.payload = {
    "serviceID": { string } ,
    "status" : { string },
    "newServiceID": { string },
    "optionalMessage" : {object}
}

```


## ia-cloud接続情報オブジェクト（Flowコンテキストオブジェクト）　　

### ia-cloud-conf

### 機能概要

このオブジェクトは、ia-cloudサーバとの接続情報を管理するFlowコンテキストオブジェクト。
ia-cloud接続node(ia-cloud-cnct)によって、起動時に（デプロイ時？）生成され、他のia-cloudオブジェクトノードによって参照できる。（現在ところ明確な使い道は想定できていない。）

### オブジェクト構造

| 名称 | 種別 | 説明 |
|:----------|:-----:|:--------------------|
| name| string| 接続しているia-cloudサーバの名称。この名称でia-cloud-confオブジェクトが作られる。|
| url| string| 接続しているia-cloudサーバのurl|
| Authorization | string |httpsへッダーにセットするBase64エンコードされたBasic認証ヘッダー。|
| serviceID | string |ia-cloudサーバの応答に含まれる、次回以降のリクエストに使用されるserviceID.|
| sTimestamp | string |最初に**connect**した時のタイムスタンプ|

例
```
flow.ia-cloud-name = {
	"name": "ia-cloud-name",
	"url": "domain.com/.../ia-cloud-rest/V2",
	"Authorization": "Basic SUFfY2xvdWRVc2VySUQ6UGFzc2NvZGU=",
	"serviceID": "31d4d96e407aad42",
	"sTimestamp": "2018-08-15T13:43:28.0+9:00"
}
```
