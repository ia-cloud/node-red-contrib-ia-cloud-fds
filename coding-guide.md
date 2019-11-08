
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
