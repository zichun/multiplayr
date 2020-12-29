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

import '../css/local.scss';
import '../css/multiplayr.scss';
import '../css/mp-components.scss';
import '../../rules/fontawesome';

export { MultiplayR, LocalClientTransport, messages, utils };
