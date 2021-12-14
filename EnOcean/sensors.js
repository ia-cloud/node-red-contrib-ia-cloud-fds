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
const wattyHyhq = require('./sensor-watty-hyhq');
const wattyHyhqFf = require('./sensor-watty-hyhq-ff');
const wattyHyhu3 = require('./sensor-watty-hyhu3');
const wattyHyco = require('./sensor-watty-hyco');
const wattyHypm = require('./sensor-watty-hypm');

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
    {
        name: 'Watty HYHQ',
        type: 'watty_hyhq',
        process: wattyHyhq.process,
        nodeRedFunction: wattyHyhq.nodeRedFunction,
    },
    {
        name: 'Watty HYHQ-FF',
        type: 'watty_hyhq_ff',
        process: wattyHyhqFf.process,
        nodeRedFunction: wattyHyhqFf.nodeRedFunction,
    },
    {
        name: 'Watty HYHU3',
        type: 'watty_hyhu3',
        process: wattyHyhu3.process,
        nodeRedFunction: wattyHyhu3.nodeRedFunction,
    },
    {
        name: 'Watty HYCO',
        type: 'watty_hyco',
        process: wattyHyco.process,
        nodeRedFunction: wattyHyco.nodeRedFunction,
    },
    {
        name: 'Watty HYPM',
        type: 'watty_hypm',
        process: wattyHypm.process,
        nodeRedFunction: wattyHypm.nodeRedFunction,
    },
];
