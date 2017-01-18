/**
 * gameshell.ts
 */

import * as React from 'react';
import { Panel } from 'office-ui-fabric-react/lib/Panel';
import { Button } from 'office-ui-fabric-react/lib/Button';

import {
    GameRuleInterface,
    MPType,
    ViewPropsInterface
} from '../../common/interfaces';

export const Shell: GameRuleInterface = {

    name: 'gameshell',
    css: ['shell.css'],

    plugins: {},
    methods: {},

    globalData: {},
    playerData: {},

    onDataChange: (mp: MPType) => {
        return false;
    },

    views: {
        'HostShell-Main': class extends React.Component<ViewPropsInterface, {}> {
            public render() {
                const header = React.createElement(Shell.views['HostShell-Main-Head'], this.props);
                const body = React.createElement(Shell.views['HostShell-Main-Body'], this.props);

                return React.DOM.div(
                    { id: 'shell-main' },
                    header,
                    body);
            }
        },

        'HostShell-Main-Head': class extends React.Component<ViewPropsInterface, {showPanel: boolean}> {
            constructor(props: ViewPropsInterface) {
                super(props);
                this.state = {showPanel: false};
            }

            private _showPanel() {
                this.setState({showPanel: true});
            }

            private _hidePanel() {
                this.setState({showPanel: false});
            }

            public render() {
                return (
                    <div id='shell-header'>
                        <Button description='Menu' onClick={ this._showPanel.bind(this) }>Menu</Button>
                        <div id='shell-room'>
                            {this.props.MP.roomId}
                        </div>
                        <Panel
                            isOpen={ this.state.showPanel }
                            isLightDismiss={ true }
                            isBlocking={ false }
                            onDismiss= { this._hidePanel.bind(this) }>

                            <span className='ms-font-m'>Light Dismiss usage is meant for the Contextual Menu on mobile sized breakpoints.</span>
                        </Panel>
                    </div>
                );
            }
        },

        'HostShell-Main-Body': class extends React.Component<ViewPropsInterface & { links: any }, { currentView: string }> {
            constructor(props: ViewPropsInterface) {
                super(props);
                this.state = { currentView: 'home' };
            }
            public setView(newView: string) {
                this.state.currentView = newView;
                document.getElementById('shell-nav-trigger').setAttribute('checked', ''); // todo: this should be proper react
                this.forceUpdate();
            }
            public render() {
                const hamburgerMenus = React.createElement(Shell.views['HostShell-Main-Body-Menu'], {
                    links: this.props.links,
                    setView: this.setView
                });

                const content = React.DOM.div(
                    { id: 'shell-main-content' },
                    this.props['view-' + this.state.currentView.toLowerCase()]);

                return (
                    <div id='shell-body'>
                        { hamburgerMenus }
                        <input type='checkbox' id='shell-nav-trigger' className='shell-nav-trigger' />
                        <label htmlFor='shell-nav-trigger' />
                        { content }
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
                const tr = [React.DOM.li({ onClick: this.setView, key: 'home' }, 'Home')];
                for (let i = 0; i < this.props.links.length; i = i + 1) {
                    tr.push(React.DOM.li({ onClick: this.setView, key: ('link-' + i) }, this.props['links'][i]));
                }
                return React.DOM.ul(
                    { className: 'shell-navigation' },
                    tr);
            }
        }
    }

};

export default Shell;
