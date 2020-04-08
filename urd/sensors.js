/**
 * (C) 2020 URD
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
 */

const AC1ch = require('./urd-ac-1ch');
const AC3ch = require('./urd-ac-3ch');

module.exports = [
    {
        name: 'URD AC 1ch',
        type: 'AC1ch',
        process: AC1ch.process,
        nodeRedFunction: AC1ch.nodeRedFunction,
    },
    {
        name: 'URD AC 3ch',
        type: 'AC3ch',
        process: AC3ch.process,
        nodeRedFunction: AC3ch.nodeRedFunction,
    },
];
