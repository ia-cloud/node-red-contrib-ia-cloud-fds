/**
 * Copyright 2019 ia-cloud project
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

const coreStaffTemperatureHumidity = require('./sensor-core-staff-temperature-humidity');
const itecCT = require('./sensor-itec-ct');
const optexOccupancy = require('./sensor-optex-occupancy');
const optexRockerSwitch = require('./sensor-optex-rocker-switch');
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
        name: 'Watty temperature',
        type: 'watty',
        process: wattyTemperature.process,
        nodeRedFunction: wattyTemperature.nodeRedFunction,
    },
];
