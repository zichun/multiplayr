/**
 * lib.ts
 *
 * bundle for multiplayr libraries
 *
 */

import * as React from 'react';
import * as ReactDOM from 'react-dom';

(window as any).React = React;
(window as any).ReactDOM = ReactDOM;

import MultiplayR from '../lib/multiplayr';
import SocketTransport from '../lib/socket.transport';
import WebRTCTransport from '../lib/webrtc.transport';
import * as messages from '../../common/messages';
import * as utils from '../../common/utils';
import * as savedsessions from '../lib/savedsessions';

import '../css/multiplayr.scss';
import '../css/mp-components.scss';
//import './fontawesome';

export { MultiplayR, SocketTransport, WebRTCTransport, messages, utils, savedsessions };
