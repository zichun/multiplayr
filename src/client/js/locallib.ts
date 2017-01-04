/**
 * lib.ts
 *
 * bundle for multiplayr libraries
 *
 */

import MultiplayR from '../lib/multiplayr';
import LocalClientTransport from '../lib/local.transport';
import * as messages from '../../common/messages';
import * as utils from '../../common/utils';
import MPRULES from '../../rules/rules';

export {MultiplayR, LocalClientTransport, messages, utils, MPRULES};
