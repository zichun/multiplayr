/**
 * gameshell.ts
 */

import * as React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

//import { Panel } from 'office-ui-fabric-react/lib/Panel';
//import { Button } from 'office-ui-fabric-react/lib/Button';

import './shell.scss';

import {
    GameRuleInterface,
    MPType,
    ViewPropsInterface
} from '../../common/interfaces';

import { forEach } from '../../common/utils';

interface HostShellMainInterface extends ViewPropsInterface {
    links: any,
    currentView?: string,
    topBarContent?: any
    gameName?: string,
}

interface HostShellMainPanelInterface extends ViewPropsInterface {
    links: any,
    setView: any,
    currentView: string
}

export const Shell: GameRuleInterface = {

    name: 'gameshell',

    plugins: {},
    methods: {},

    globalData: {},
    playerData: {},

    onDataChange: (mp: MPType) => {
        return false;
    },

    views: {
        'HostShell-Main': class extends React.Component<HostShellMainInterface, { currentView: string }> {

            constructor (props: HostShellMainInterface) {
                super(props);
                this.state = { currentView: 'home' };
            }

            private _setView(viewName: string) {
                this.setState({ currentView: viewName });
            }

            public render() {
                const header = React.createElement(
                    Shell.views['HostShell-Main-Head'],
                    {
                        topBarContent: this.props.topBarContent,
                        roomId: this.props.MP.roomId,
                        gameName: this.props.gameName ?? '',
                    });

                const body = React.createElement(Shell.views['HostShell-Main-Body'], {
                    links: this.props.links,
                    currentView: this.state.currentView
                });

                const panel = React.createElement(Shell.views['HostShell-Main-Panel'], {
                    links: this.props.links,
                    setView: this._setView.bind(this),
                    currentView: this.state.currentView
                });

                return (
                    <div className='shell-main'>
                    { header }
                    { panel }
                    { body }
                    </div>
                );
            }
        },

        'HostShell-Main-Panel': class extends React.Component<HostShellMainPanelInterface, { showPanel: boolean }> {

            constructor(props: HostShellMainPanelInterface) {
                super(props);
                this.state = { showPanel: false };
                this._togglePanel = this._togglePanel.bind(this);
            }

            private _togglePanel() {
                this.setState({ showPanel: !this.state.showPanel });
            }

            public render() {
                const icons = [];
                const labels = [];

                forEach(
                    this.props.links,
                    (linkName: string, linkObj: any) => {

                        let className = 'icon';

                        if (this.props.currentView === linkName) {
                            className += ' active';
                        }

                        icons.push(
                            <div className='shell-main-panel-link'
                                 onClick={ this.props.setView.bind(this, linkName) }
                                 key={ 'link-' + linkName }>

                                <FontAwesomeIcon icon={ linkObj.icon }
                                             className={ className }
                                             size='1x'
                                             key={ 'icon-' + linkName } />
                                <label>{ linkObj.label }</label>
                            </div>
                        );
                        labels.push();
                    });

                const pannelExtensionClassName = this.state.showPanel ?
                                                 'shell-main-panel show' :
                                                 'shell-main-panel';
                return (
                    <div className={ pannelExtensionClassName }>
                        <div className='shell-main-panel-link'
                             onClick={ this._togglePanel }>

                            <FontAwesomeIcon icon="bars"
                                         size='1x'
                                         className='icon menu' />
                        </div>
                        { icons }
                    </div>
                );
            }
        },

        'HostShell-Main-Head': class extends React.Component<
            ViewPropsInterface & { topBarContent: any, gameName: string, roomId: string},
            { copied: boolean }
        > {
            constructor(props: any) {
                super(props);
                this.state = { copied: false };
                this.copyRoomId = this.copyRoomId.bind(this);
            }
            public copyRoomId() {
                const protocol = window.location.protocol;
                const host = window.location.host;
                const pathname = window.location.pathname;

                let joinPath = "/join";
                if (pathname.indexOf("host_p2p.html") >= 0) {
                    joinPath = pathname.replace("host_p2p.html", "join_p2p.html");
                } else if (pathname.indexOf("host_p2p") >= 0) {
                    joinPath = pathname.replace("host_p2p", "join_p2p");
                } else if (pathname.indexOf("host.html") >= 0) {
                    joinPath = pathname.replace("host.html", "join.html");
                } else if (pathname.indexOf("host") >= 0) {
                    joinPath = pathname.replace("host", "join");
                }

                const url = protocol + "//" + host + joinPath + "#roomId=" + this.props.roomId;

                const reportSuccess = () => {
                    this.setState({ copied: true });
                    setTimeout(() => {
                        this.setState({ copied: false });
                    }, 1500);
                };

                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(url)
                        .then(reportSuccess)
                        .catch((err) => {
                            console.error('Async: Could not copy text: ', err);
                            this.fallbackCopyText(url);
                            reportSuccess();
                        });
                } else {
                    this.fallbackCopyText(url);
                    reportSuccess();
                }
            }
            private fallbackCopyText(text: string) {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                
                textArea.style.position = "fixed";
                textArea.style.top = "0";
                textArea.style.left = "0";
                
                textArea.style.width = "2em";
                textArea.style.height = "2em";
                textArea.style.padding = "0";
                textArea.style.border = "none";
                textArea.style.outline = "none";
                textArea.style.boxShadow = "none";
                textArea.style.background = "transparent";
                
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();

                try {
                    document.execCommand('copy');
                } catch (err) {
                    console.error('Fallback: Oops, unable to copy', err);
                }

                document.body.removeChild(textArea);
            }
            public render() {
                let topbar = null;
                if (!this.props.topBarContent) {
                    const text = this.state.copied ? "Copied!" : this.props.roomId;
                    topbar = (<div className="room-id" onClick={ this.copyRoomId }>{ text }</div>);
                } else {
                    topbar = this.props.topBarContent;
                }
                return (
                    <div className='shell-header'>
                        <div className='shell-room'>
                            { topbar }
                        </div>
                        <div className='shell-title'>
                            { this.props.gameName }
                        </div>
                    </div>
                );
            }
        },

        'HostShell-Main-Body': class extends React.Component<ViewPropsInterface & {
            currentView: string,
            links: any
        }, {}> {
            public render() {
                const content = this.props.links[this.props.currentView.toLowerCase()].view;
                const childViews = [];

                forEach(
                    this.props.links,
                    (key, obj) => {
                        let style = {};
                        if (key !== this.props.currentView.toLowerCase()) {
                            style = { display: 'none' };
                        }

                        childViews.push(
                            <div className='shell-body-container'
                                 style={ style }
                                 key={ key }>
                                { obj.view }
                            </div>
                        );
                    });

                return (
                    <div className='shell-body'>
                        { childViews }
                    </div>
                );
            }
        },

        'HostShell-Main-Body-Menu': class extends React.Component<ViewPropsInterface & {
            links: any,
            setView: any
        }, {}> {
            constructor(props: any) {
                super(props);
                this.setView = this.setView.bind(this);
            }

            public setView(e: any) {
                this.props.setView(e.target.innerText);
            }

            public render() {
                const tr = [React.createElement('li', { onClick: this.setView, key: 'home' }, 'Home')];
                for (let i = 0; i < this.props.links.length; i = i + 1) {
                    tr.push(React.createElement('li', { onClick: this.setView, key: ('link-' + i) }, this.props['links'][i]));
                }
                return React.createElement(
                    'li',
                    { className: 'shell-navigation' },
                    tr);
            }
        }
    }

};

export default Shell;
