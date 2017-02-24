/**
 * lib.ts
 *
 * bundle for multiplayr libraries
 *
 */

import '../css/local.scss';
import MultiplayR from '../lib/multiplayr';
import LocalClientTransport from '../lib/local.transport';
import * as messages from '../../common/messages';
import * as utils from '../../common/utils';
import MPRULES from '../../rules/rules';
import '../css/mp-components.scss';

export { MultiplayR, LocalClientTransport, messages, utils, MPRULES };
