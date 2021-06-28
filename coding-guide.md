
# coding-guide

This doc mainly describes about ``.eslintrc.yml`` configuration.  
See also [Creating Nodes : Node-RED](https://nodered.org/docs/creating-nodes/).  

## ファイル

* ファイル名に日本語を使用してはいけない
* 大文字小文字を、設定やコード(``package.json``など)と合わせる
* 文字コードはutf-8、改行コードはLFとする

## 一般的には複数の方法があるものについての方針/リポジトリ特有のコーディング

* ``package.json`` はリポジトリに1つとする
* ``package.json`` の ``dependencies`` はABC順に並べる
* 必ずi18n対応を行う
* データの形式は[仕様](https://github.com/ia-cloud/Web-API-Specification-V2)に従う

## ここに記載されない一般的なルールについて

* [リーダブルコード](https://www.oreilly.co.jp/books/9784873115658/)
* [ノードの開発 : Node-RED日本ユーザ会](https://nodered.jp/docs/creating-nodes/)
* ESLintに設定してあるルール(``.eslintrc.yml``)に従う
  * インデントはスペース4つ
  * 未使用の変数を放置しない
  * varを使用せず、``let`` または ``const`` を使用する
  * jsの文字列はシングルクオートで囲う
  * ``console.log`` を使用しない

## Node.js基礎

* 依存関係を追加する場合は ``package.json`` にも追記する
* 依存関係の変更を行った場合は、``npm i`` を行い ``package.json`` と共に ``package-lock.json`` もコミットする
* ``node_modules`` など不要なファイルをバージョン管理しない

## ライセンス表示について

* Apache 2.0ライセンスを適用する
* リポジトリの直下に ``LICENSE`` ファイルを配置し、そこにApache 2.0のライセンス条文を記載する。ファイルの内容はGitHubで新規リポジトリ作成の際にApache 2.0ライセンスを指定してデフォルトで生成されるものでよい
* ``package.json`` ファイルにも ``"license": "Apache-2.0",`` を含める
* 各ファイルへのライセンス表記については、各メンバーの任意とする  
  ただし、表記する場合はつぎのように記載する  

htmlファイル

```.html
<!--
   Copyright 2019 ryoichi-obara

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
-->
```

jsファイル

```.js
/**
 * Copyright 2019 ryoichi-obara
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
```
