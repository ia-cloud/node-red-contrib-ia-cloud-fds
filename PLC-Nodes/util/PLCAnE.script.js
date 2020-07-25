/**
 * Copyright JS Foundation and other contributors, http://js.foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

var PLCAENodeConfig = {


    category: 'iaCloud',
    color: "rgb(231, 180, 100)",

    defaults: {
        // node properties
        // Nodeのデフォルトプロパティ。
        // 必要に応じて、利用する個別の個別のPLCAnE Nodeの.htmlファイルのjavscriptでオーバライド?する。
        /*  [example]
            PLCNodeConfig.defaults.name = {value:"PLC-ModbusAnE"}; 
            PLCNodeConfig.defaults.comNode = {value:"通信Node", type:"Modbus-com", required: true};
        */
        name: {value:""},
        comNode: {value:"", type:"", required: true},
        contentType: {value: "Alarm&Event", required: true},

        // object properties
        storeInterval: {value:"300"},
        storeAsync: {value: true, required: true},
        objectKey: {value:"", required: true},
        objectDescription: {value:""},

        // 必須項目が揃っているかのflag、Nodeに赤三角を表示するために必要
        configReady: {value: "", required: true},

        // dataItems property（editableListで使用する。
        dataItems: {value: [{}],},

        // defaultのdataItem定義（editableListで追加ボタンが押された時のdataItem）
        /* 利用する個別のPLCNodeの.htmlファイルのjavscriptでオーバライドする
        [Example]
            PLCNodeConfig.defaults.defaultDataItem.value = {
                itemType:"bit",
                commonName:"",
                AnE: {deviceType:"Coil", address:0, logic:"pos", AnECode:"", AnEDesc:""},
        };           */
        defaultDataItem: {value:{}},

            // DataItem設定リストのデバイスsellect要素のoptionを追加するDOM要素
            /* 利用する個別のPLCNodeの.htmlファイルのjavscriptでオーバライドする
            [Example]
                PLCNodeConfig.defaults.deviceTypeDef.value = {
                    AnE: [{value:"Coil", text:"Coil"},{value:"IS", text:"IS"},
                            {value:"HR", text:"HR"},{value:"IR", text:"IR"},],
        }            */
        deviceTypeDef: {value:{},}
    },
    inputs: 1,
    outputs: 1,
    icon: "ia-cloud.png",  //アイコンはTBD

    label: function () {
        return this.name||this._("PlcData-object");
    },
    labelStyle: function () {
        return this.name?"node_label_italic":"";
    },

    oneditprepare: function () {

        const node = this;

        const lblAdd = node._("editor.address");
        const lblNeg = node._("editor.neg");
        const lblPos = node._("editor.pos");
        const lblAnECode = node._("editor.AnECode");
        const lblAnEDesc = node._("editor.AnEDescription");

        // editableList item のhtml要素
        // 1行目のデバイスタイプとアドレス、論理入力項目
        const paraForm1 =`
            <select class="deviceType" 
                style="width:80px; display:inline-block; text-align:right;">
                <!-- <option selected="selected" value="Coil">Coil</option>
                <option value="IS">IS</option> -->
            </select>
            <input required="required" class="address" placeholder="${lblAdd}" type="number" min="0" 
                style="width:80px; display:inline-block; text-align:right; margin-right:20px;">
            <select class="logic" style="width:90px; display:inline-block; text-align:right;">
                <option selected="selected" value= "pos" label="${lblPos}"></option>
                <option value= "neg" label="${lblNeg}"></option>
            </select>
        `;
        // 2行目のA&Eコード、A&E説明プロパティ入力項目
        const paraForm2 =`
            <div class="bitFm">
                <span style="display:inline-block; width:30px"> </span>
                <input class="AnECode" placeholder="${lblAnECode}" type="text"
                    style="width:90px; display:inline-block; text-align:left; margin-right:20px;">
                <input type="text" class="AnEDesc" placeholder="${lblAnEDesc}"
                    style="width:200px; display:inline-block; text-align:left;">
            </div>
        `;
 
        // Tab要素を設定（Jquery UI を使用）
        $("#ui-tabs").tabs({active: 1});

        // Define editableList.
        $('#node-input-AnEcontainer').css('min-height', '150px').css('min-width', '450px').editableList({
            removable: true,
            sortable: true,
            height: 500,

            // Process when click add button.
            addItem: function(container, index, dItem) {
                let div1 = $('<div></div>').appendTo(container);
                let div2 = $('<div></div>',{style:"margin-top:8px;"}).appendTo(container);

                $('<span></span>',{class:"index", 
                    style:"display:inline-block;text-align:right; width:30px; padding-right:5px;"})
                    .text((index + 1) + " :")
                    .appendTo(div1);
                $(paraForm1).appendTo(div1);

                // アラームコード・アラーム文字列の編集要素を追加
                $(paraForm2).appendTo(div2);

                // データItemのデバイスタイプのsellect要素のoptionを追加する関数
                // この関数は、利用する個別のPLC　Nodeのhtmlファイルのjavscriptで定義すること
                for (let key in node.deviceTypeDef) {
                    if (!key) break;
                    let selField = "";
                    let ops = node.deviceTypeDef[key];
                    let len = ops.length;
                    switch (key){
                        case "AnE":
                            selField = div1.find(".deviceType");
                            break;
                        default:
                            break;
                    }
                    if (!selField) break;
                    for (var i=0; i<len; i++) {
                        selField.append($("<option></option>").val(ops[i].value).text(node._(ops[i].text)));
                    }
                }
                // 追加ボタンが押されたら、dItemは 空{} で呼ばれるので、デフォルトセット
                if(!dItem.hasOwnProperty("itemType")) dItem = node.defaultDataItem;

                // AnE parameters
                div1.find(".deviceType").val(dItem.AnE.deviceType);
                div1.find(".address").val(dItem.AnE.address);
                div1.find(".logic").val(dItem.AnE.logic);
                div2.find(".AnECode").val(dItem.AnE.AnECode);
                div2.find(".AnEDesc").val(dItem.AnE.AnEDesc);

            },
            // リストの順番が変わったら呼ばれる。
            sortItems: function(items) {
                items.each(function(i, elm){
                    // 番号を降り直し
                    elm.find(".index").text((i + 1) + ":");
                });
            },
            // リストの項目が削除されたら呼ばれる。
            removeItem: function(dItem){
                let items = $('#node-input-AnEcontainer').editableList("items");
                items.each(function(i, elm){
                    // 番号を降り直し
                    elm.find(".index").text((i + 1) + ":");
                });
            }
        });
        // Nodeの設定パラメータを取り出し、editableListに登録
        for (let i=0; i<node.dataItems.length; i++) {
            $("#node-input-AnEcontainer").editableList('addItem',node.dataItems[i]);
        }  
   },

    oneditsave: function () {
        const node = this;
        let configReady = "ready";
        let items = $("#node-input-AnEcontainer").editableList('items');

        // データ設定を作成
        node.dataItems = [];
        items.each(function(i, elm){
            let item = {
                // Fixed DataItem property
                itemType: node.defaultDataItem.itemType,
                commonName: node.defaultDataItem.commonName,
                // Set A&E propertise back
                AnE: {          
                    deviceType: elm.find(".deviceType").val(),
                    address: parseInt(elm.find(".address").val()),
                    logic: elm.find(".logic").val(),
                    AnECode: elm.find(".AnECode").val(),
                    AnEDesc: elm.find(".AnEDesc").val()
                }
            }
            // 必須propertyが揃っているか？
            if (!Number.isInteger(item.AnE.address)) configReady = "";
            node.dataItems.push(item);
        });
        // objectKeyはある？
        if (!$("#node-input-objectKey").val()) configReady = "";
        // contentTypeはある？
        if (!$("#node-input-contentType").val()) configReady = "";
        // データ設定が一つはある？
        if (!node.dataItems[0]) configReady = "";
        // 設定完了フラグをセット
        $("#node-input-configReady").val(configReady);

    },

    oneditresize: function (size) {
        // エディタがリサイズされたら
        let height = size.height;

        // Tab以外の部分の高さを引く
        height -= $("#PLC-name-block").outerHeight(true);

        // dataItemプロパティTab内の、editableList以外の行の高さを引く
        let rows = $("#tab-AnE-property>div:not(.node-input-AnEcontainer-row)");
        for (let i=0; i<rows.length; i++) {
            height -= $(rows[i]).outerHeight(true);
        }
        // タブの部分の高さ（大体）
        height -= 50;

        // editableListのマージンを引く
        const editorRow = $("#tab-AnE-property>div.node-input-AnEcontainer-row");
        height -= (parseInt(editorRow.css("marginTop"))+parseInt(editorRow.css("marginBottom")));
  
        // editableListの高さを設定。editableListが非表示の時は正しく動作しない。
        $("#node-input-AnEcontainer").editableList('height',height);

    },
}

