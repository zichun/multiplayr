/**
 * index.ts
 *
 * entry point for webpack bundle
 *
 */

import '../lib/multiplayr';
import SocketTransport from '../lib/socket.transport';
import Session from '../lib/session';

import {checkReturnMessage} from '../../common/messages';

declare var io;

const t = new SocketTransport(io,
                              location.protocol + '//' + location.host,
                              (data) => {
                                  checkReturnMessage(data, 'clientId');

                                  alert('connected, clientId: ' + t.getClientId());

                                  const s = new Session(t);

                                  s.createRoom((roomId) => {
                                      alert('created room id: ' + roomId);
                                  });

                              });
