
"use strict";
class PLCCom {
    constructor (config, comObject){

        this.config = config;

        this.comObj = comObject;
        this.linkObj = {};
        this.addTbl = {};               // PLC通信でアクセスするデバイスのアドレステーブル

        // PLC通信で取得したデータに変化があった時にコールするリスナ関数のを持つNodeIDと、
        // そのデータを使用しているオブジェクトキー
        // {nodeID:[objectKey, ]}　の構造を持つ
        this.listeners = {};
        this.comList = [];       // PLC通信フレーム情報
        this.flagRecon = false;   // PLC通信フレーム情報の再構築フラグ
    };

    // 新たなlinkDtataがaddされたlinkObjから、読み出し通信アドレステーブルを作成する
    _reconfigAddTable() {
       
        let comList = this.comList;
        let linkObj = this.linkObj;
        let addTbl = this.addTbl;
        let maxDataNum = Number(this.config.maxDataNum);
        let noBlanck = this.config.noBlanck;

        // まず、現在の通信フレーム情報をクリア
        comList.length = 0;

        //linkObjの各項目ををスキャンし、読み出すデバイスのリスト（配列）を作成。昇順に並べ重複を削除する。
        Object.keys(linkObj).forEach(function (key) {
            if (key != "error") {
                let addList = [];
                linkObj[key].forEach(function (linkData, idx) {
                    addList.push(linkData.address);
           
                });
                addList.sort(function (add, next) { return add - next; });
                addTbl[key] = Array.from(new Set(addList));
            }
        });

        //効率的な通信のため、連続読み出し領域を探し、PLC通信フレーム情報を作成。
        Object.keys(addTbl).forEach(function (key) {

            let addList = addTbl[key];
            let saddr;
            let dataNum = 0;
            let maxAdd;
            for (let idx = 0, l = addList.length; idx < l; idx++) {
                let address = Number(addList[idx]);
                if (dataNum == 0) {
                    dataNum = 1;
                    saddr = address;
                    maxAdd = address + maxDataNum;
                }
                else if (noBlanck && address == (saddr + dataNum)) {
                    dataNum = address - saddr + 1;
                }
                else if (!noBlanck && address < maxAdd) {
                    dataNum = address - saddr + 1;
                }else {
                    //PLC通信フレーム情報を追加
                    comList.push({ device: key, address: saddr, quantity: dataNum });
                    dataNum = 1;
                    saddr = address;
                    maxAdd = address + maxDataNum;
                }
                if (idx == (l - 1)) {
                    //PLC通信フレーム情報を追加
                    comList.push({ device: key, address: saddr, quantity: dataNum });
                }
            }
        });
    };

    // 拡張した子クラスによってオーバライドされるべき、Abstractな通信実行メソッド
    async readItemsFromPLC(config, params) {

        let comType = config.comType;
        let comObj  = this.comObj ;

        for (let param of params){
            // このコードは実際には動作しない。必ずオーバーライドすること。
        }
        throw new Error("Method 'readItemsFromPLC()' must be implemented.");
    };

    //作成したリンクオブジェクトに基づき、PLC通信を実施し、リンクオブジェクトの各Valueを更新する
    // 外部メソッド。this を固定するためアロー関数で記述

    CyclicRead (RED) {return new Promise(resolve => {

        let comObj = this.comObj;    
        let linkObj = this.linkObj;
        let flagRecon = this.flagRecon;
        let comList = this.comList;
        let listeners = this.listeners = {};
        let config = this.config;

        // 通信フレーム情報の再構成フラグがonの時は、再構成する
        if (flagRecon) {
            // 通信フレーム情報の再構成フラグをoff
            this.flagRecon = false;
            this._reconfigAddTable();
        }

        //PLC通信フレーム送受信
        if (comList.length) {
            let params = [];
            comList.forEach(function (com) {
                params.push({
                    dev    : com.device,
                    addr  : com.address,
                    qty   : com.quantity,
                });
            });
            this.readItemsFromPLC(config, params)
            .then((resp) => {
            // 通信成功、レスポンスデータをlinkObjに格納
                for(let obj of resp){

                    this._storeToLinkObj(obj.dev, obj.addr, obj.qty, obj.value);
                }
                // 通信が成功したので、linkObjのエラー情報をクリア、PLCnodeへイベント発行
                let len = linkObj.error.length;
                for (let i = 0; i < len; i++) {
                    this._valueStoreAddListeners("ok", linkObj.error, listeners);
                }
            })
            // 通信エラーが発生した場合のエラー処理。LinkObjにエラー情報を格納し、PLCnodeへイベント発行
            .catch((err) => {
                // エラー情報をLinkObjに格納
                let num = linkObj.error.length;
                for (let i = 0; i < num; i++) {
                    this._valueStoreAddListeners(err.message, linkObj.error, listeners);
                }
            })
            // 更新結果に変化があり、変化通知フラグのある項目は、登録されたchangeListenerを呼ぶ
            .finally(() => {
                // 変化通知を要求したNodeのリスナーをコール(引数はobjectKeyの配列)
                Object.keys(listeners).forEach(function (nodeId) {
                    if (nodeId) {
                        let listener = RED.nodes.getNode(nodeId);
                        if (listener)
                            listener.emit("changeListener", listeners[nodeId]);
                    }
                });
                listeners = {};
                resolve();
            });
        }
        else resolve();
    })};

    // PLC通信のコールバック関数
    // 通信のレスポンスフレームのデータでlinkObjのvalueを更新、
    // さらに、変化イベントのリスナーが登録されていたら、各Nodeのリストに追加
    _storeToLinkObj(dev, start, num, list){

        let linkObj = this.linkObj;
        let listeners = this.listeners;

        for (let i = 0; i < num; i++) {
            let links = linkObj[dev].filter(function(elm) {
                return (elm.address == Number(start) + i);
            });
            if (!links) return;
            let value = this.toLinkObjectValue(list[i]);
            this._valueStoreAddListeners(value, links, listeners);
        }
    };

    _valueStoreAddListeners(value, links, listeners) {
 
        links.forEach((linkD) => {
            linkD.preValue = linkD.value;
            linkD.value = value;
            let nodeId = linkD.nodeId;
            // 変化通知が登録されていて、前回の値に変化があったら（初回はパス）
            if(nodeId && linkD.preValue && (linkD.value != linkD.preValue)) {
                // 要求元のPLC Object Nodeとオブジェクトキーを登録
                // 重複の無いように
                // objectKeyリストがからだったら、リストに追加
                if (!listeners[nodeId]) listeners[nodeId] = [linkD.objectKey,];
                // 登録済みのObjectKeyでなかったら、リストに追加
                else if (listeners[nodeId].indexOf(linkD.objectKey) == -1) {
                    listeners[nodeId].push(linkD.objectKey);
                }
            }
        });
    }

    // LinkObjectのデータ形式に変換
    // 必要に応じて拡張クラスでオーバーライドする。
    toLinkObjectValue(value) {
        throw new Error("Method 'toLinkObjectValue(value)' must be implemented.");
    };

    // linkObjにlinkDataを追加、各PLCNodeから呼ばれる。
    addLinkData(lObj) {
        let linkObj = this.linkObj;
        for(let dev of Object.keys(lObj)) {
            // linkObjに新たなリンクデータを追加
            if (!(dev in linkObj)) linkObj[dev] = [];
            Array.prototype.push.apply(linkObj[dev], lObj[dev]);
        }
        // linkObjが変更されたので、通信フレーム情報の再構築フラグをon
        this.flagRecon = true;
    };
}

module.exports = PLCCom;