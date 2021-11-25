const helper = require('node-red-node-test-helper');
const changeNode = require('../../ia-cloud-change/ia-cloud-change');

// eslint-disable-next-line no-undef
describe('ia-cloud-change node', () => {
    // eslint-disable-next-line no-undef
    afterEach(() => {
        helper.unload();
    });

    const payloadGroveTemperatureHumidity = {
        _msgid: '5abe837c.44d1dc',
        payload: {
            temperature: 20,
            humidity: 46,
        },
    };

    // eslint-disable-next-line no-undef
    it('should be loaded', (done) => {
        const flow = [{ id: 'n1', type: 'ia-cloud-change', name: 'test name' }];
        helper.load(changeNode, flow, () => {
            const n1 = helper.getNode('n1');
            n1.should.have.property('name', 'test name');
            return done();
        });
    });

    // eslint-disable-next-line no-undef
    it('should convert to ia-cloud format', (done) => {
        const flow = [
            {
                id: 'n1',
                type: 'ia-cloud-change',
                name: 'test name',
                objectKey: 'com.ia-cloud',
                rules: [
                    { type: 'msg', value: 'payload.temperature', dataName: '温度', commonName: 'temperature', unit: '℃' },
                ],
                wires: [['n2']],
            },
            { id: 'n2', type: 'helper' }];

        helper.load(changeNode, flow, () => {
            const n2 = helper.getNode('n2');
            const n1 = helper.getNode('n1');

            n2.on('input', (msg) => {
                // console.log(JSON.stringify(msg, undefined, '  '));

                msg.should.have.property('request', 'store');
                msg.should.have.property('dataObject');
                msg.dataObject.should.have.property('objectType', 'iaCloudObject');
                msg.dataObject.should.have.property('objectKey', 'com.ia-cloud');
                msg.dataObject.should.have.property('timestamp');
                msg.dataObject.should.have.property('objectContent');
                msg.dataObject.objectContent.should.have.property('contentType', 'iaCloudData');
                msg.dataObject.objectContent.should.have.property('contentData');

                if (msg.dataObject.objectContent.contentData.length !== 1) {
                    return done('msg.dataObject.objectContent.contentData.length must be 1.');
                }
                msg.dataObject.objectContent.contentData[0].should.have.property('dataValue', 20);
                msg.dataObject.objectContent.contentData[0].should.have.property('dataName', '温度');
                msg.dataObject.objectContent.contentData[0].should.have.property('commonName', 'temperature');
                msg.dataObject.objectContent.contentData[0].should.have.property('unit', '℃');

                return done();
            });
            n1.receive(payloadGroveTemperatureHumidity);
        });
    });
});
