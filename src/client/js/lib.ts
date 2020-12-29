/**
 * lib.ts
 *
 * bundle for multiplayr libraries
 *
 */

import MultiplayR from '../lib/multiplayr';
import SocketTransport from '../lib/socket.transport';
import * as messages from '../../common/messages';
import * as utils from '../../common/utils';

import '../css/multiplayr.scss';
import '../css/mp-components.scss';
//import './fontawesome';

export { MultiplayR, SocketTransport, messages, utils };
