/**
 * locallib.ts
 *
 * bundle for multiplayr libraries (local debug)
 *
 */

import MultiplayR from '../lib/multiplayr';
import LocalClientTransport from '../lib/local.transport';
import * as messages from '../../common/messages';
import * as utils from '../../common/utils';
import MPRULES from '../../rules/rules';

import '../css/local.scss';
import '../css/mp-components.scss';

export { MultiplayR, LocalClientTransport, messages, utils, MPRULES };
