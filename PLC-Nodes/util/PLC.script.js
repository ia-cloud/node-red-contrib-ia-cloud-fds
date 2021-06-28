
var PLCNodeConfig = {

    category:'iaCloud devices',
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
        storeInterval: {value:"60"},
        storeAsync: {value: false},
        objectKey: {value:"", required: true},
        objectDescription: {value:""},

        // 必須項目が揃っているかのflag、Nodeに赤三角を表示するために必要
        configReady: {value: "", required: true},

        // dataItems property（editableListで使用する。）
        dataItems : {value: [{},]},

    },


    inputs: 1,
    outputs: 1,
    icon: "ia-cloud.png",  //アイコンはTBD

    paletteLabel: function() {
        return this._("editor.paletteLabel") || "PLC-Mitsubishi";
    },
    label: function () {
        return this.name || this._("editor.paletteLabel");
    },
    labelStyle: function () {
        return this.name?"node_label_italic":"";
    },

    oneditprepare: function () {
        let node = this;

        // Locale strings
        const lblBit = node._("editor.bit");
        const lblBitList = node._("editor.bitList");
        const lblNum = node._("editor.number");
        const lblStr = node._("editor.string");
        const lblNuml = node._("editor.numList");
        const lblDname = node._("editor.dname");
        const lblAdd = node._("editor.address");
        const lblBitform = node._("editor.bitForm");
        const lblopStatus = node._("editor.opStatus");
        const lblAnE = node._("editor.AnE");
        const lblonoff = node._("editor.onoff");
        const lbl10 = node._("editor.10");
        const lblbool = node._("editor.bool");
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
                <option selected="selected" value="bit">${lblBit}</option>
                <option value="bitList">${lblBitList}</option>
                <option value="number">${lblNum}</option>
                <option value="string">${lblStr}</option>
                <option value="numList">${lblNuml}</option>
            </select>
            <label style="width:90px; display:inline-block; text-align:right;">${lblDname}</label>
            <input required="required" type="text" style="display:inline-block; width:150px; text-align:left;"
                class="dataName" placeholder=${lblDname}>
        `;
        // 2行目以降のプロパティ設定。データタイプ毎に5種類あり、必要に応じてshow(),hide()する。
        const paraForm =`
            <div class="bitFm">
                <span style="display:inline-block; width:30px"> </span>                
                <select class="bit-deviceType" 
                    style="width:80px; display:inline-block; text-align:right; padding-right:5px;">
                    <!-- <option selected="selected" value="Coil">Coil</option>
                    <option value="IS">IS</option> -->
                </select>
                <input required="required" class="bit-add" placeholder=${lblAdd} value="0" type="number"
                    min="0" style="width:80px; display:inline-block; text-align:right; margin-right:5px;">
                <select class="bit-form" style="width:80px; display:inline-block; text-align:right;">
                    <option selected="selected" value= "opStatus">${lblopStatus}</option>
                    <option value= "AnE">${lblAnE}</option>
                    <option value= "onoff">${lblonoff}</option>
                    <option value= "10">${lbl10}</option>
                    <option value= "bool">${lblbool}</option>
                </select>
                <select class="bit-logic" style="width:80px; display:inline-block; text-align:right;">
                    <option selected="selected" value= "pos">${lblPos}</option>
                    <option value= "neg">${lblNeg}</option>
                </select>
            </div>
            <div class="bitListFm">
                <span style="display:inline-block; width:30px"> </span>                
                <select class="bitList-deviceType" 
                    style="width:80px; display:inline-block; text-align:right; padding-right:5px;">
                    <!-- <option selected="selected" value="Coil">Coil</option>
                    <option value="IS">IS</option> -->
                </select>
                <input required="required" class="bitList-add" placeholder=${lblAdd} value="0" type="number"
                    min="0" style="width:80px; display:inline-block; text-align:right; padding-right:5px;">
                <label style="width:50px; 
                    display:inline-block; text-align:right;">${lblBitnum}</label>
                <input required="required" value="1" type="number"  min="1" class="bitList-num" data-i18n="[placeholder]editor.bitNum"
                    style="width:50px; display:inline-block; text-align:right; padding-right:5px;">
                <select class="bitList-logic" style="width:80px; display:inline-block; text-align:right;">
                    <option selected="selected" value= "pos">${lblPos}</option>
                    <option value= "neg">${lblNeg}</option>
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
                        <option selected="selected" value="unsigned">${lblUsign}</option>
                        <option value="signed">${lblSign}</option>
                        <option value="BCD">${lblBCD}</option>
                    </select>
                </div>
                <div style="margin-top:8px;">
                    <span style="display:inline-block; width:30px"> </span>
                    <label style="width:50px; display:inline-block; text-align:right;">${lblOff}</label>
                    <input value="0" type="number" step="any" class="number-offset" placeholder=${lblOff}
                        style="width:70px; display:inline-block; text-align:right; padding-right:5px;">                     
                    <label style="width:50px; display:inline-block; text-align:right; margin-left:10px;">${lblGain}</label>
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
                <label style="width:50px; display:inline-block; text-align:right;">${lblWnum}</label>
                <input value="1" type="number" min="1" class="string-num" placeholder=${lblWnum}
                    style="width:50px; display:inline-block; text-align:right; padding-right:5px;">
                <select class="string-encode"
                    style="width:80px; display:inline-block; text-align:right; padding-right:5px;">
                    <option value="sJIS">${lblSjis}</option>
                    <option selected="selected" value="utf-8">${lblUTF8}</option>
                    <option value="EUC">${lblEUC}</option>
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
                <label style="width:30px; display:inline-block; text-align:right;">${lblWnum}</label>
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
                    <option selected="selected" value="unsigned">${lblUsign}</option>
                    <option value="signed">${lblSign}</option>
                    <option value="BCD">${lblBCD}</option>
                </select>
            </div>
        `;

        // Tab
        const tabs = RED.tabs.create({
            id: 'red-tabs',
            onchange(tab) {
                $('#plc-tabs-content').children().hide();
                $("#" + tab.id).show();
                $("#red-tabs").resize();
            },
        });
        tabs.addTab({
            id: 'tab-object-properties',
            label: this._('editor.tab.object-settings'),
        });
        tabs.addTab({
            id: 'tab-dataItem-properties',
            label: this._('editor.tab.data-settings'),
        });

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
                div2.find(".bitList-deviceType").append($("#bitListDeviceDef>option").clone());
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
                        form: $("#defaultBit").data("form"),
                        logic: $("#defaultBit").data("logic")
                    }
                }
                let ip = dItem.itemType;
                if  (!(ip === "number" || ip === "string" || ip === "numList" 
                    || ip === "bit" || ip === "bitList" )) return;
                
                // set back dataItem properties on row1
                div1.find(".itemType").val(dItem.itemType);
                div1.find(".dataName").val(dItem.dataName);
                // set back dataItem properties on row2
                switch(dItem.itemType) {
                    case "bit":
                        // bit type parameters
                        div2.find(".bit-deviceType").val(dItem.bit.deviceType);
                        div2.find(".bit-add").val(dItem.bit.address);
                        div2.find(".bit-form").val(dItem.bit.form);
                        div2.find(".bit-logic").val(dItem.bit.logic);
                        break;
                    case "bitList":
                        // bit type parameters
                        div2.find(".bitList-deviceType").val(dItem.bitList.deviceType);
                        div2.find(".bitList-add").val(dItem.bitList.address);
                        div2.find(".bitList-num").val(dItem.bitList.number);
                        div2.find(".bitList-logic").val(dItem.bitList.logic);
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
                            div2.find(".bitListFm").hide();
                            div2.find(".numberFm").hide();
                            div2.find(".stringFm").hide();
                            div2.find(".numListFm").hide();
                            break; 
                        case "bitList":
                            div2.find(".bitFm").hide();
                            div2.find(".bitListFm").show();
                            div2.find(".numberFm").hide();
                            div2.find(".stringFm").hide();
                            div2.find(".numListFm").hide();
                            break;
                        case "number":
                            div2.find(".bitFm").hide();
                            div2.find(".bitListFm").hide();
                            div2.find(".numberFm").show();
                            div2.find(".stringFm").hide();
                            div2.find(".numListFm").hide();
                            break;
                        case "string":
                            div2.find(".bitFm").hide();
                            div2.find(".bitListFm").hide();
                            div2.find(".numberFm").hide();
                            div2.find(".stringFm").show();
                            div2.find(".numListFm").hide();
                            break;
                        case "numList":
                            div2.find(".bitFm").hide();
                            div2.find(".bitListFm").hide();
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
                        form: elm.find(".bit-form").val(),
                        logic: elm.find(".bit-logic").val(),
                    };
                    if (!Number.isInteger(item.bit.address)) configReady = "";
                    break;
                case "bitList":
                    item.bitList = {          // bitList type parameter
                        deviceType: elm.find(".bitList-deviceType").val(),
                        address: parseInt(elm.find(".bitList-add").val()),
                        number: parseInt(elm.find(".bitList-num").val()),
                        logic: elm.find(".bitList-logic").val(),
                    };
                    if (!Number.isInteger(item.bitList.address)) configReady = "";
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
                    if (item.number.offset === NaN ) configReady = "";
                    if (item.number.gain === 0 || item.number.gain === NaN ) configReady = "";
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
        if ($("#tab-dataItem-properties").is(":visible")) {
            // エディタがリサイズされたら
            let height = size.height;

            // Tab以外の部分の高さを引く
            height -= $("#PLC-com-block").outerHeight(true);
            height -= $("#PLC-name-block").outerHeight(true);
            // dataItemプロパティTab内の、editableList以外の行の高さを引く
            let rows = $("#tab-dataItem-properties>div:not(.node-input-dItemcontainer-row)");
            for (let i=0; i<rows.length; i++) {
                height -= $(rows[i]).outerHeight(true);
            }
            // タブの部分の高さ（大体）
            height -= 80;

            // editableListのマージンを引く
            const editorRow = $("#tab-dataItem-properties>div.node-input-dItemcontainer-row");
            height -= (parseInt(editorRow.css("marginTop"))+parseInt(editorRow.css("marginBottom")));
            
            // editableListの高さを設定。editableListが非表示の時は正しく動作しない。
            $("#node-input-dItemcontainer").editableList('height',height);
        }
    }
};

