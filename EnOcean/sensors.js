
const coreStaffTemperatureHumidity = require('./sensor-core-staff-temperature-humidity');
const itecCT = require('./sensor-itec-ct');
const optexOccupancy = require('./sensor-optex-occupancy');
const optexRockerSwitch = require('./sensor-optex-rocker-switch');
const urdAC = require('./sensor-urd-ac');
const wattyTemperature = require('./sensor-watty-temperature');

module.exports = [
    {
        name: 'CoreStaff Temperature/Humidity',
        type: 'core_staff',
        process: coreStaffTemperatureHumidity.process,
        nodeRedFunction: coreStaffTemperatureHumidity.nodeRedFunction,
    },
    {
        name: 'iTEC CT',
        type: 'itec',
        process: itecCT.process,
        nodeRedFunction: itecCT.nodeRedFunction,
    },
    {
        name: 'Optex occupancy',
        type: 'optex_occupancy',
        process: optexOccupancy.process,
        nodeRedFunction: optexOccupancy.nodeRedFunction,
    },
    {
        name: 'Optex rocker switch',
        type: 'optex_rocker',
        process: optexRockerSwitch.process,
        nodeRedFunction: optexRockerSwitch.nodeRedFunction,
    },
    {
        name: 'URD AC',
        type: 'u-rd',
        process: urdAC.process,
        nodeRedFunction: urdAC.nodeRedFunction,
    },
    {
        name: 'Watty temperature',
        type: 'watty',
        process: wattyTemperature.process,
        nodeRedFunction: wattyTemperature.nodeRedFunction,
    },
];
