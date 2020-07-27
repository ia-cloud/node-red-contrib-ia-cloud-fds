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

var PLCNodeConfig = {

    category:'iaCloud',
    color: "rgb(231, 180, 100)",
    
    defaults: {
        // node properties
        // Nodeのデフォルトプロパティ。
        // 必要に応じて、利用する個別のPLCNodeの.htmlファイルのjavscriptでオーバライド?する。
        /*  [example]
            PLCNodeConfig.defaults.name = {value:"PLC-Modbus"}; 
            PLCNodeConfig.defaults.comNode = {value:"通信Node", type:"Modbus-com", required: true};
            PLCNodeConfig.defaults.contentType = {value: "ModbusPLC", required: true};
        */
        name: {value:""},
        comNode: {value:"", type:"", required: true},
        contentType: {value: "", required: true},

        // object properties
        storeInterval: {value:"300"},
        storeAsync: {value: false},
        objectKey: {value:"", required: true},
        objectDescription: {value:""},

        // 必須項目が揃っているかのflag、Nodeに赤三角を表示するために必要
        configReady: {value: "", required: true},

        // dataItems property（editableListで使用する。）
        dataItems : {value: [{},]},

        // defaultのdataItem定義（editableListで追加ボタンが押された時のdataItem）
        /* 利用する個別のPLCNodeの.htmlファイルのjavscriptでオーバライドする
        [Example]
            PLCNodeConfig.defaults.defaultDataItem.value = {
                itemType:"bit",
                dataName:"",
                bit: {deviceType:"Coil", address:0, number:1, logic:"pos"},
                number: {deviceType:"HR", address:0, type:"1w", encode:"unsigned", offset:0, gain:1, unit:""}, 
                string: {deviceType:"HR", address:0, encode:"utf-8", number:1}, 
                numList: {deviceType:"HR", address:0, type:"1w", encode:"unsigned", number:1}
            };           */
//        defaultDataItem: {value:{}},

        // DataItem設定リストのデバイスsellect要素のoptionを追加するDOM要素
        /* 利用する個別のPLCNodeの.htmlファイルのjavscriptでオーバライドする
        [Example]
            PLCNodeConfig.defaults.deviceTypeDef.value = {
                bit: [{value:"Coil", text:"Coil"},{value:"IS", text:"IS"},
                        {value:"HR", text:"HR"},{value:"IR", text:"IR"},],
                number: [{value:"HR", text:"HR"},{value:"IR", text:"IR"}],
                string: [{value:"HR", text:"HR"},{value:"IR", text:"IR"}],
                numList: [{value:"HR", text:"HR"},{value:"IR", text:"IR"}]
            }            */
//        deviceTypeDef: {value:{},}
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
        let node = this;

        // Locale strings
        const lblBit = node._("editor.bit");
        const lblNum = node._("editor.number");
        const lblStr = node._("editor.string");
        const lblNuml = node._("editor.numList");
        const lblDname = node._("editor.dname");
        const lblAdd = node._("editor.address");
        const lblBitnum = node._("editor.bitNum");
        const lblPos = node._("editor.pos");
        const lblNeg = node._("editor.neg");
        const lblUnit = node._("editor.unit");
        const lblUsign = node._("editor.unsigned");
        const lblSign = node._("editor.signed");
        const lblBCD = node._("editor.BCD");
        const lblOff = node._("editor.offset");
        const lblGain = node._("editor.gain");
        const lblSjis = node._("editor.sjis");
        const lblUTF8 = node._("editor.utf");
        const lblEUC = node._("editor.euc");
        const lblWnum = node._("editor.wnumber");
        
 
        // editableList item のhtml要素
        // 1行目のデータタイプとデータ名称
        const itemTypefm =`
            <select style="display:inline-block; width:80px;"
                class="itemType">
                <option selected="selected" value="bit">${lblBit}</span></option>
                <option value="number">${lblNum}</span></option>
                <option value="string">${lblStr}</span></option>
                <option value="numList">${lblNuml}</option>
            </select>
            <label style="width:90px; display:inline-block; text-align:right;">${lblDname}</span></label>
            <input required="required" type="text" style="display:inline-block; width:150px; text-align:left;"
                class="dataName" placeholder=${lblDname}>
        `;
        // 2行目以降のプロパティ設定。データタイプ毎に4種類あり、必要に応じてshow(),hide()する。
        const paraForm =`
            <div class="bitFm">
                <span style="display:inline-block; width:30px"> </span>
                <select class="bit-deviceType" 
                    style="width:80px; display:inline-block; text-align:right; padding-right:5px;">
                    <!-- <option selected="selected" value="Coil">Coil</option>
                    <option value="IS">IS</option> -->
                </select>
                <input required="required" class="bit-add" placeholder=${lblAdd} value="0" type="number"
                    min="0" style="width:80px; display:inline-block; text-align:right; padding-right:5px;">
                <label style="width:50px; 
                    display:inline-block; text-align:right;">${lblBitnum}</span></label>
                <input required="required" value="1" type="number"  min="1" class="bit-num" data-i18n="[placeholder]editor.bitNum"
                    style="width:50px; display:inline-block; text-align:right; padding-right:5px;">
                <select class="bit-logic" style="width:80px; display:inline-block; text-align:right;">
                    <option selected="selected" value= "pos">${lblPos}</span></option>
                    <option value= "neg">${lblNeg}</span></option>
                </select>
            </div>
            <div class="numberFm hidden">
                <div style="margin-top:8px;">
                    <span style="display:inline-block; width:30px"> </span>
                    <select class="number-deviceType" 
                        style="width:60px; display:inline-block; text-align:right; padding-right:5px;">
                        <!-- <option selected="selected" value="IR">IR</option>
                        <option value="HR">HR</option> -->
                    </select>
                    <input required="required" value="0" type="number" min="0"
                        style="width:80px; display:inline-block; text-align:right; padding-right:5px;"
                        class="number-add" placeholder=${lblAdd}>
                    <select class="number-type" 
                        style="width:80px; display:inline-block; text-align:right; padding-right:5px; margin-left:10px;">
                        <option selected="selected" value="1w">1word</option>
                        <option value="2w-b">2wb</option>
                        <option value="2w-l">2wl</option>
                    </select>
                    <select class="number-encode" 
                        style="width:80px; display:inline-block; text-align:right; padding-right:5px;">
                        <option selected="selected" value="unsigned">${lblUsign}</span></option>
                        <option value="signed">${lblSign}</span></option>
                        <option value="BCD">${lblBCD}</span></option>
                    </select>
                </div>
                <div style="margin-top:8px;">
                    <span style="display:inline-block; width:30px"> </span>
                    <label style="width:50px; display:inline-block; text-align:right;">${lblOff}</span></label>
                    <input value="0" type="number" step="any" class="number-offset" placeholder=${lblOff}
                        style="width:70px; display:inline-block; text-align:right; padding-right:5px;">                     
                    <label style="width:50px; display:inline-block; text-align:right; margin-left:10px;">${lblGain}</span></label>
                    <input value="1" type="number" step="any" class="number-gain" placeholder=${lblGain}
                        style="width:70px; display:inline-block; text-align:right; padding-right:5px;">
                    <input type="text" class="number-unit" placeholder=${lblUnit}
                        style="width:50px; display:inline-block; text-align:right; padding-right:5px;margin-left:20px;">              
                </div>
            </div>
            <div class="stringFm hidden" style="margin-top:8px;">
                <span style="display:inline-block; width:30px"> </span>
                <select class="string-deviceType" 
                    style="width:55px; display:inline-block; text-align:right; padding-right:5px;"> 
                    <!-- <option selected="selected" value="IR">IR</option>
                    <option value="HR">HR</option> -->
                </select>
                <input required="required" value="0" type="number"  min="0" class="string-add" placeholder=${lblAdd}
                    style="width:80px; display:inline-block; text-align:right; padding-right:5px;">
                <label style="width:50px; display:inline-block; text-align:right;">${lblWnum}</span></label>
                <input value="1" type="number" min="1" class="string-num" placeholder=${lblWnum}
                    style="width:50px; display:inline-block; text-align:right; padding-right:5px;">
                <select class="string-encode"
                    style="width:80px; display:inline-block; text-align:right; padding-right:5px;">
                    <option value="sJIS">${lblSjis}</span></option>
                    <option selected="selected" value="utf-8">${lblUTF8}</span></option>
                    <option value="EUC">${lblEUC}</span></option>
                </select>
            </div>
            <div class="numListFm hidden" style="margin-top:8px;">
                <span style="display:inline-block; width:30px"> </span>
                <select class="numList-deviceType" 
                    style="width:60px; display:inline-block; text-align:right; padding-right:5px;">
                    <!-- <option selected="selected" value="IR">IR</option>
                    <option value="HR">HR</option> -->
                </select>
                <input required="required" value="0" type="number" min="0" class="numList-add" placeholder=${lblAdd}
                    style="width:70px; display:inline-block; text-align:right; padding-right:5px;">
                <label style="width:30px; display:inline-block; text-align:right;">${lblWnum}</span></label>
                <input required="required" value="1" type="number" min="1" class="numList-num" placeholder=${lblWnum}
                    style="width:50px; display:inline-block; text-align:right;">
                <select class="numList-type" 
                    style="width:65px; display:inline-block; text-align:right;">
                    <option selected="selected" value="1w">1w</option>
                    <option value="2w-b">2wb</option>
                    <option value="2w-l">2wl</option>
                </select>
                <select class="numList-encode"
                    style="width:65px; display:inline-block; text-align:right;">
                    <option selected="selected" value="unsigned">${lblUsign}</span></option>
                    <option value="signed">${lblSign}</span></option>
                    <option value="BCD">${lblBCD}</option>
                </select>
            </div>
        `;

        // Tab要素を設定（Jquery UI を使用）
        $("#ui-tabs").tabs({active: 1});

        // Define editableList.
        $('#node-input-dItemcontainer').css('min-height', '150px').css('min-width', '450px').editableList({
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
                $(itemTypefm).appendTo(div1);

                // デバイス選択以降の編集要素を追加
                $(paraForm).appendTo(div2);

                // データItemのデバイスタイプのsellect要素のoptionを追加する
                // optionのDOMオブジェクトは、利用する個別のPLCNodeのhtmlファイルのjavscriptで定義すること。
                div2.find(".bit-deviceType").append($("#bitDeviceDef>option").clone());
                div2.find(".number-deviceType").append($("#numberDeviceDef>option").clone());
                div2.find(".string-deviceType").append($("#stringDeviceDef>option").clone());
                div2.find(".numList-deviceType").append($("#numListDeviceDef>option").clone());
                                           
                // 追加ボタンが押されたら、dItemは 空{} で呼ばれるので、デフォルトセット
                if(!dItem.hasOwnProperty("itemType")) {

                    dItem.itemType = $("#defaultDataItem").data("itemtype");
                    dItem.dataName = $("#defaultDataItem").data("dataname");
                    dItem[dItem.itemType]={
                        deviceType: $("#defaultBit").data("devicetype"),
                        address: $("#defaultBit").data("address"),
                        number: $("#defaultBit").data("number"),
                        logic: $("#defaultBit").data("logic")
                    }
                }
                let ip = dItem.itemType;
                if  (!(ip === "number" || ip === "string" || ip === "numList" 
                    || ip === "bit" )) return;
                
                // set back dataItem properties on row1
                div1.find(".itemType").val(dItem.itemType);
                div1.find(".dataName").val(dItem.dataName);
                // set back dataItem properties on row2
                switch(dItem.itemType) {
                    case "bit":
                        // bit type parameters
                        div2.find(".bit-deviceType").val(dItem.bit.deviceType);
                        div2.find(".bit-add").val(dItem.bit.address);
                        div2.find(".bit-num").val(dItem.bit.number);
                        div2.find(".bit-logic").val(dItem.bit.logic);
                        break;
                    case "number":
                        // number type parameters
                        div2.find(".number-deviceType").val(dItem.number.deviceType);
                        div2.find(".number-add").val(dItem.number.address);
                        div2.find(".number-type").val(dItem.number.type);
                        div2.find(".number-encode").val(dItem.number.encode);
                        div2.find(".number-offset").val(dItem.number.offset);
                        div2.find(".number-gain").val(dItem.number.gain);
                        div2.find(".number-unit").val(dItem.number.unit);
                        break;
                    case "string":
                        // string type parameters
                        div2.find(".string-deviceType").val(dItem.string.deviceType);
                        div2.find(".string-add").val(dItem.string.address);
                        div2.find(".string-num").val(dItem.string.number);
                        div2.find(".string-encode").val(dItem.string.encode);
                        break;
                    case "numList":
                        // numberList type parameters
                        div2.find(".numList-deviceType").val(dItem.numList.deviceType);
                        div2.find(".numList-add").val(dItem.numList.address);
                        div2.find(".numList-num").val(dItem.numList.number);
                        div2.find(".numList-type").val(dItem.numList.type);
                        div2.find(".numList-encode").val(dItem.numList.encode);
                        break;
                }

                // データタイプが変更されたら呼ばれるコールバック関数を登録
                div1.find(".itemType").change(function(){
                    let type = $(this).val();
                    // 該当するhtml要素を表示、他を隠す。
                    switch(type) {
                        case "bit":
                            div2.find(".bitFm").show();
                            div2.find(".numberFm").hide();
                            div2.find(".stringFm").hide();
                            div2.find(".numListFm").hide();
                            break;
                        case "number":
                            div2.find(".bitFm").hide();
                            div2.find(".numberFm").show();
                            div2.find(".stringFm").hide();
                            div2.find(".numListFm").hide();
                            break;
                        case "string":
                            div2.find(".bitFm").hide();
                            div2.find(".numberFm").hide();
                            div2.find(".stringFm").show();
                            div2.find(".numListFm").hide();
                            break;
                        case "numList":
                            div2.find(".bitFm").hide();
                            div2.find(".numberFm").hide();
                            div2.find(".stringFm").hide();
                            div2.find(".numListFm").show();
                            break;
                    }
                });
                div1.find(".itemType").change();

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
                let items = $('#node-input-dItemcontainer').editableList("items");
                items.each(function(i, elm){
                    // 番号を降り直し
                    elm.find(".index").text((i + 1) + ":");
                });
            }
        });

        // Nodeの設定パラメータを取り出し、editableListに登録
        for (let i=0; i<node.dataItems.length; i++) {
            $("#node-input-dItemcontainer").editableList('addItem',node.dataItems[i]);
        }  
    },

    oneditsave: function () {

        let node = this;
        let configReady = "ready";
        let items = $("#node-input-dItemcontainer").editableList('items');
        let configObj = {};
        // データ設定を作成
        node.dataItems = [];

        items.each(function(i, elm){
            let item = {
                itemType: elm.find(".itemType").val(),
                dataName: elm.find(".dataName").val()
            };
            // 必須propertyが揃っているか？
            if (!item.dataName) configReady = "";

            switch (item.itemType) {
                case "bit":
                    item.bit = {          // bit type parameter
                        deviceType: elm.find(".bit-deviceType").val(),
                        address: parseInt(elm.find(".bit-add").val()),
                        number: parseInt(elm.find(".bit-num").val()),
                        logic: elm.find(".bit-logic").val(),
                    };
                    if (!Number.isInteger(item.bit.address)) configReady = "";
                    break;
                case "number":
                    item.number = {       // number type parameters
                        deviceType: elm.find(".number-deviceType").val(),
                        address: parseInt(elm.find(".number-add").val()),
                        type: elm.find(".number-type").val(),
                        encode: elm.find(".number-encode").val(),
                        offset: Number(elm.find(".number-offset").val()),
                        gain: Number(elm.find(".number-gain").val()),
                        unit: elm.find(".number-unit").val(),
                    };
                    if (!Number.isInteger(item.number.address)) configReady = "";
                    if (!Number.isInteger(item.number.offset)) configReady = "";
                    if (!Number.isInteger(item.number.gain)) configReady = "";
                    break;
                case "string":
                    item.string = {       // string type parameters
                        deviceType: elm.find(".string-deviceType").val(),
                        address: parseInt(elm.find(".string-add").val()),
                        number: parseInt(elm.find(".string-num").val()),
                        encode: elm.find(".string-encode").val(),
                    };
                    if (!Number.isInteger(item.string.address)) configReady = "";
                    if (!Number.isInteger(item.string.number)) configReady = "";
                    break;
                case "numList":
                    item.numList = {      // numberList type parameters
                        deviceType: elm.find(".numList-deviceType").val(),
                        address: parseInt(elm.find(".numList-add").val()),
                        number: parseInt(elm.find(".numList-num").val()),
                        type: elm.find(".numList-type").val(),
                        encode: elm.find(".numList-encode").val(),
                    }
                    if (!Number.isInteger(item.numList.address)) configReady = "";
                    if (!Number.isInteger(item.numList.number)) configReady = "";
                    break;
            }
            // dataItemをプロパティリストにプッシュ
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
        let rows = $("#tab-dItem-property>div:not(.node-input-dItemcontainer-row)");
        for (let i=0; i<rows.length; i++) {
            height -= $(rows[i]).outerHeight(true);
        }
        // タブの部分の高さ（大体）
        height -= 50;

        // editableListのマージンを引く
        const editorRow = $("#tab-dItem-property>div.node-input-dItemcontainer-row");
        height -= (parseInt(editorRow.css("marginTop"))+parseInt(editorRow.css("marginBottom")));
        
        // editableListの高さを設定。editableListが非表示の時は正しく動作しない。
        $("#node-input-dItemcontainer").editableList('height',height);
    }
};

