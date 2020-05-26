# node-REDノードのモジュール構造化設計

ia-cloudにおけるNode-RED Node開発の構造化設計（類似の機能を有する複数のNode間で、共通のコードを共有化する）のため、Node-RED Nodeのエディタ構成ファイル MyNode.htmlと実行ファイル MyNode.js の構造化について調査した。
* このほか、ロケイルのリソースファイルも存在するが、現状構造化の手段はない。Node-RED Coreでは実現しているので、実現の可能性はあるが、Coreの機能拡張を待つのが良いと考える。


## 実行ファイル MyNode.jsの構造化

* 共通コード部分を別ファイルにして、class定義し、これをModule.exportsでモジュール化し外部へエキスポートする。
* Javascriptのクラスは、クラスベースのオブジェクト指向言語（Javaのような）のクラスとは異なり、かなり癖があるので注意が必要
 * クラスメンバ変数の定義と参照が this.xxx となるため、外部メソッドで、クラスメンバを参照するコードを書く時、呼び出し側をthisで参照するプログラムが書けない。
 * インスタンス化（newした）したオブジェクトは、元のクラスのメンバ変数やメソッドが、プロトタイプのプロパティとなるので、Object.keys()や for in などで列挙できない。
 * などなど、いろいろあるが基本、javascriptのプロトタイプチェーン（糖衣クラス表現）に関する知見＋ネット情報で開発可能。
* 事例として、PLCのデータ収集nodeを解説する。
 * 各種PLC共通部分のクラスｋ定義ファイル：　PLC.js
    * 内部プロパティの定義
    * 外部メソッド・内部メソッドの定義
    * クラスのエキスポート
 * Modbus対応PLCnoデータ収集Nodeの実行ファイル：　PLC-modbus.js
    * PLCクラスのrequireによるインポート（必要があれば、メソッドをオーバーライドする拡張を行う。）
    * 拡張クラスのインスタンス化（？実際にはプロトタイプチェーンの追加）
    * 必要な外部メソッドのコールをして実行

## エディタ構成ファイル MyNode.htmlの構造化
エディタ画面を構成するhtmlパート、ヘルプテキストを構成するhtmlパート、エディタの動作やNodeプロパティの処理を行うJavascriptパートに分かれる。

### エディタ画面を構成するhtmlパート

* htmlパートの共通部分を構造化する手段はない。
* htmlをテンプレートリテラルで変数定義したjavascriptコードを、後述のhttpAdmin APIで動的にロードして、JavascriptパートのJavascriptで動的に表示することで可能ではあるが、以下の問題が生じる。
  * テンプレートリテラルは、コードエディタのキーワードハイライト機能が機能しないため、間違いに気が付きにくくバグを生みやすい。（html自体、厳密なエラーチェックがないので元々間違いに気づかないわけではあるが・・・）
  * id="node-input-myproperty"で定義されたinput要素へのpropertyの自動代入機能が働かないので、Node編集終了時（oneditsave()で）全てのpropertyをオブジェクト化・JSON化してNodeのproperty登録し、Node編集開始時（oneditprepare()で）にこれをパースし、個別のinput要素に代入する必要がある。
  * 設定Nodeの選択要素（\<input type="設定Node名"\>）では、この方法も利用できないので、設定Node選択要素は固定のhtmlとしてhtmlパートに記述するほかない。

### ヘルプテキストを構成するhtmlパート
現状、ロケイルリソースファイルの共有化と同様で、構造化する手段はない。Node-RED Coreでは可能だと考えられるので、Coreの機能として提供されるのを待つしかない？

### エディタの動作やNodeプロパティの処理を行うJavascriptパート

Javascriptのプロトタイプチェーンによる継承についての知見があれば、すぐにたどり着いたのかもしれないが、後生のために、自分のたどった経緯を順に記述する。

* Webページでjavascriptを自身のサーバや外部サーバから動的にロードし、実行する手段について
  * 基本はAjaxのXMLHttpRequestを利用した動的なリソースのロード機能であるが、jQueryでラップされた様々なメソッドが提供されている。
  * javascriptコードをロードし実行するには、jQuery.getScript()が使える。$.getScript()と同じ。
  * $.get()でコードのテキストファイルをロードしeval()しても同じことが可能。（実際内部ではそうしているハズ。）
  * Ajaxでリソースをロードするには、サーバ側に対応するエンドポイントが必要である。このエンドポイントを作成するAPIとして、RED.httpAdmin.get()が用意されているが、使い方についての仕様を書いたものがない。
  * node-red-contrib-serialport でシリアルポートのリストを取得するAPIとして使用してる方法が、
  * (https://github.com/node-red/cookbook.nodered.org/wiki/Create-an-admin-configuration-API-endpoint)

  にあるので参考とした。

  ```
  RED.httpAdmin.get("/PLC-Com.script", RED.auth.needsPermission('Mitsubishi-com.read'), function(req,res) {
      let jscript;
      let fname = path.join(__dirname, 'util/PLC-Com.script.js')
      try{
          jscript = fs.readFileSync(fname);
      } catch(e) {
          //エラーの場合。
          jscript = null;
      }
      res.type("text/javascript").send(jscript);
  });

  ```
* MyNode.htmlの\<script type="text/javascript"\>は、RED.nodes.registerType()を実行する
```
RED.nodes.registerType('node-type',{
        // このオブジェクトを動的に生成する。
    });
```
具体的には、httpAdmin で作成したエンドポイントから以下のようなPLC通信設定Nodeの共通スクリプトを読み込む
```
let PLCNodeConfig = {
    category: 'ia-cloud',
    color: '#a6bbcf',
    defaults: {
        name: {value:""}
    },
    inputs:1,
    outputs:1,
    icon: "file.png",
    label: function() {
        return this.name||"lower-case";
    },
    oneditprepare: function() {},
    oneditsave: function() {}

    // この設定オブジェクトを読み込んだ後、各MyNode.htmlでカスタマイズするプロパティのエントリ
    exampleProperty1: {hoge},
    exampleProperty2: {hoge}
          .
          .
          .
}
```
このオブジェクトを読み込み、Nodeの定義の個別部分を変更して登録する。
```
// httpAdmin で作成したエンドポイントからPLC通信設定Nodeの共通スクリプトを読み込み
$.getScript("PLC.script").done(function(script, textStatus){

    // Nodeプロパティーのデフォルト設定を上書き
    PLCNodeConfig.name = "PLC-Modbus";
    PLCNodeConfig.comNode = value: "";
    PLCNodeConfig.contentType = "ModbusPLC";

    // 個別の設定を上書き追加定義
    PLCNodeConfig.exampleProperty1 = {};
    PLCNodeConfig.exampleProperty2 = {};

    // NodeをNode-REDへ登録
    RED.nodes.registerType('PLC-Modbus', PLCNodeConfig);
});
```
#### _結果：失敗_
利用するNodeで同一のオブジェクトPLCNodeConfigをロードし定義するので、二重定義のSyntaxエラーとなる。ロード・定義箇所を一箇所に絞っても、利用する個別Nodeで同一のオブジェクトPLCNodeConfigを書き換えているので、全てのNodeが最後の上書き情報で書き変えられてしまう。

* Node設定オブジェクトをES6のClassを使って定義する。クラスはNewして個別のNode毎のインスタンスを作るので、個別のNode設定が他のNodeへ影響しない。httpAdminのエンドポイントは同様だが、スクリプトファイルの内容を以下とした。
  ```
  export class PLCNodeConfig{
    constructor(){
      this.category = 'ia-cloud',
      this.color = '#a6bbcf',
      this.defaults = {
          name: {value:""}
      },
      this.inputs = 1,
      this.outputs = 1,
      this.icon = "file.png"
    };
    label () {
        return this.name||"lower-case";
    };
    oneditprepare () {};
    oneditsave () {};

    // この設定オブジェクトを読み込んだ後、各MyNode.htmlでカスタマイズするプロパティ・メソッドのエントリ
    exampleProperty1 = {hoge};
    exampleMethod() {fuga};
          .
  }
  ```
  利用側は
  ```
  // httpAdmin で作成したエンドポイントからPLC通信設定Nodeの共通スクリプトを読み込み
  $.getScript("PLC.script").done(function(script, textStatus){

      // Nodeプロパティ定義オブジェクトの擬似的インスタンス化
      const dfg =  new PLCNodeConfig();

      // Nodeプロパティーのデフォルト設定を上書き
      PLCNodeConfig.name = "PLC-Modbus";
      PLCNodeConfig.comNode = "";
      PLCNodeConfig.contentType = "ModbusPLC";

      // 個別の設定を上書き追加定義
      exampleProperty1 = {hogehoge};
      exampleMethod = function () {fugafuga};

      // NodeをNode-REDへ登録
      RED.nodes.registerType('PLC-Modbus', PLCNodeConfig);
  });
  ```
  #### _結果：失敗_
  利用するNodeで同一のclass PLCNodeConfigをロードし定義するので、二重定義のSyntaxエラーとなる。
  Classのメソッドで内部プロパティへの参照は、this.アクセスでしかアクセスできないのに。oneditprepare()
  では、this.でNodeオブジェクトへの参照が必要。

* 同様にES6のimport/exportもトライ
  ES6の外部モジュール機構を利用すると、二重定義エラーにならないのではないか

    $.getScript()をimport文に変更
  ```
  import {PLCnodeConfig} from "/PLC.script.js";
  ```
    import/exportを利用するためには、
    * ロードされるファイルは.jsでなければならないので、エンドポイントの定義を変更
    * ロードする側は、\<script type="module"\>でなければならない

  #### _結果：失敗_
    * 利用するNodeで同一のclass PLCNodeConfigをロードし定義するので、二重定義のSyntaxエラーとなる。
    * Classのメソッドで内部プロパティへの参照は、this.アクセスでしかアクセスできないのに,
    oneditprepare()では、this.でNodeオブジェクトへの参照が必要。
    * 実行ファイルのところで述べた、「インスタンス化（newした）したオブジェクトや、プロトタイプチェーンで継承したオブジェクトは、元のクラスのメンバ変数やメソッドが、プロトタイプのプロパティとなるので、Object.keys()や for in などで列挙できない。」ことからNode-REDエディタがアクセスできない部分があり、再描画時にエラーとなる。
    * \<script type="module"\>でスクリプトを定義するので、Node-REDエディタのコードからNodeにアクセスできず、再描画時にエラーとなる。

### 最終的にどうしたか？

```
// httpAdmin で作成したエンドポイントからPLC通信設定Nodeの共通スクリプトを読み込み
$.getScript("PLC.script").done(function(script, textStatus){

    // Node登録オブジェクトのシャローコピー
    let cfg = Object.assign({},PLCNodeConfig);

    // Nodeプロパティーのデフォルト設定を上書き
    dflts.name = "PLC-Modbus";
    dflts.comNode = value: "";
    dflts.contentType = "ModbusPLC";

    // 個別の設定を上書き追加定義
    dflts.exampleProperty1 = {};
    dflts.exampleProperty2 = {};

    // NodeをNode-REDへ登録
    RED.nodes.registerType('PLC-Modbus', PLCNodeConfig);
});
```
* 利用するNodeで同一のclass PLCNodeConfigをロードし定義するので、二重定義のSyntaxエラーとなる。

のは、まだ解決できない。苦肉の手段として、ロードされるスクリプト側での宣言を、letではなく二重宣言が許されるvarで宣言する。
```
var PLCNodeConfig = {
    category: 'ia-cloud',
    color: '#a6bbcf',
          .
          .
          .
}
```
#### _結果：なんとか成功
  * めでたしめでたし

### ーーーさらに追加ーーー

#### Nodeを登録するオブジェクトPLCNodeConfigと生成されたNode自身のオブジェクトの関係。

  `RED.nodes.registerType('PLC-Modbus', PLCNodeConfig);`

  のPLCNodeCofigオブジェクトのdefaults:{xxx:{value:"value"}}プロパティは、生成されたNode直下のプロパティとなるので、Node.xxxでアクセスできる。この仕組みを利用し、
  PLCNodeConfig.defaults.xxx = {value:"value"}}で上書き設定した値を、oneditprepare()でnode.xxxとして参照し個別のNodeにあった動作を実現している。

```
// httpAdmin で作成したエンドポイントからPLC通信設定Nodeの共通スクリプトを読み込み
$.getScript("PLC.script").done(function(script, textStatus){

    // Node登録オブジェクトのシャローコピー
    let cfg = Object.assign({},PLCNodeConfig);
    // デフォルトプロパティのシャローコピー
    let dflts = Object.assign({},cfg.defaults);

    // Nodeプロパティーのデフォルト設定を上書き
    dflts.name = {value: "PLC-Modbus"};
    dflts.comNode = {value: "", type: "Modbus-com", required: true};
    dflts.contentType = {value: "ModbusPLC"};

    // DataItem設定リストのデバイスsellect要素のoptionを定義
    dflts.deviceTypeDef = {value:
        {
            bit: [{value:"Coil", text:"editor.dev-Coil"},{value:"IS", text:"editor.dev-IS"},
                    {value:"HR", text:"editor.dev-HR"},{value:"IR", text:"editor.dev-IR"},],
            number: [{value:"HR", text:"editor.dev-HR"},{value:"IR", text:"editor.dev-IR"}],
            string: [{value:"HR", text:"editor.dev-HR"},{value:"IR", text:"editor.dev-IR"}],
            numList: [{value:"HR", text:"editor.dev-HR"},{value:"IR", text:"editor.dev-IR"}]
        }
    };
    //  デフォルトのPLCデータ項目を定義
    dflts.defaultDataItem = {value:
        {
            itemType:"bit",
            dataName:"",
            bit: {deviceType:"Coil", address:0, number:1, logic:"pos"},
            number: {deviceType:"HR", address:0, type:"1w", encode:"unsigned", offset:0, gain:1, unit:""},
            string: {deviceType:"HR", address:0,  number:1, encode:"utf-8"},
            numList: {deviceType:"HR", address:0, number:1, type:"1w", encode:"unsigned"}
        }
    };
    // デフォルトプロパティを付け替え
    cfg.defaults = dflts;

    // NodeをNode-REDへ登録
    RED.nodes.registerType('PLC-Modbus', cfg);
});
```
