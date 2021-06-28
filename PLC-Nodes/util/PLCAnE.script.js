
var PLCAENodeConfig = {


    category: 'iaCloud devices',
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
        storeInterval: {value:"0"},
        storeAsync: {value: true, required: true},
        objectKey: {value:"", required: true},
        objectDescription: {value:""},

        // 必須項目が揃っているかのflag、Nodeに赤三角を表示するために必要
        configReady: {value: "", required: true},

        // dataItems property（editableListで使用する。
        dataItems: {value: [{}],},

    },
    inputs: 1,
    outputs: 1,
    icon: "ia-cloud.png",  //アイコンはTBD

    paletteLabel: function() {
        return this._("editor.paletteLabel") || "PLC-Mitsubishi-AnE";
    },
    label: function () {
        return this.name||this._("editor.paletteLabel");
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
            <input required="required" class="addressBit" placeholder="${lblAdd}" type="number" min="0" 
                step="any" style="width:80px; display:inline-block; text-align:right; margin-right:20px;">
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
            id: 'tab-AnE-properties',
            label: this._('editor.tab.data-settings'),
        });

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

                // データItemのデバイスタイプのsellect要素のoptionを追加する
                // optionのDOMオブジェクトは、利用する個別のPLCNodeのhtmlファイルのjavscriptで定義すること。
                div1.find(".deviceType").append($("#deviceDef>option").clone());

                // 追加ボタンが押されたら、dItemは 空{} で呼ばれるので、デフォルトセット
                if(!dItem.hasOwnProperty("itemType")) {
                    let itemType = $("#defaultDataItem").data("itemtype");
                    dItem[itemType]={
                        deviceType: $("#defaultAnE").data("devicetype"),
                        addressBit: $("#defaultAnE").data("address"),
                        logic: $("#defaultAnE").data("logic"),
                        AnECode: $("#defaultAnE").data("anecode"),
                        AnEDesc: $("#defaultAnE").data("anedesc")
                    }
                }

                // AnE parameters
                div1.find(".deviceType").val(dItem.AnE.deviceType);
                div1.find(".addressBit").val(dItem.AnE.addressBit);
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
                itemType: $("#defaultDataItem").data("itemtype"),
                commonName: $("#defaultDataItem").data("commonname"),
                // Set A&E propertise back
                AnE: {          
                    deviceType: elm.find(".deviceType").val(),
                    addressBit: elm.find(".addressBit").val(),
                    address: parseInt(elm.find(".addressBit").val()),
                    bit: parseInt(String(elm.find(".addressBit").val()).split(".")[1]),
                    logic: elm.find(".logic").val(),
                    AnECode: elm.find(".AnECode").val(),
                    AnEDesc: elm.find(".AnEDesc").val()
                }
            }
            // 必須propertyが揃っているか？
            if (isNaN(item.AnE.address)) configReady = "";
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

        if ($("#tab-AnE-properties").is(":visible")) {
            // エディタがリサイズされたら
            let height = size.height;

            // Tab以外の部分の高さを引く
            height -= $("#PLC-com-block").outerHeight(true);
            height -= $("#PLC-name-block").outerHeight(true);

            // dataItemプロパティTab内の、editableList以外の行の高さを引く
            let rows = $("#tab-AnE-properties>div:not(.node-input-AnEcontainer-row)");
            for (let i=0; i<rows.length; i++) {
                height -= $(rows[i]).outerHeight(true);
            }
            // タブの部分の高さ（大体）
            height -= 80;

            // editableListのマージンを引く
            const editorRow = $("#tab-AnE-properties>div.node-input-AnEcontainer-row");
            height -= (parseInt(editorRow.css("marginTop"))+parseInt(editorRow.css("marginBottom")));
    
            // editableListの高さを設定。editableListが非表示の時は正しく動作しない。
            $("#node-input-AnEcontainer").editableList('height',height);
        }

    },
}

