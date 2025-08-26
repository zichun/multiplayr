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
            {}
        > {
            constructor(props: any) {
                super(props);
                this.copyRoomId = this.copyRoomId.bind(this);
            }
            public copyRoomId() {
                const url = window.location.protocol + "//" + window.location.host + "/join#roomId=" + this.props.roomId;
                navigator.clipboard.writeText(url);
            }
            public render() {
                let topbar = null;
                if (!this.props.topBarContent) {
                    topbar = (<div className="room-id" onClick={ this.copyRoomId }>{ this.props.roomId }</div>);
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
