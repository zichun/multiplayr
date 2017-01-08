/**
 * gameshell.ts
 */

import * as React from 'react';

import {GameRuleInterface,
        MPType,
        ViewPropsInterface} from '../../common/interfaces';

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

                return React.DOM.div({id: 'shell-main'},
                                     header,
                                     body);
            }
        },

        'HostShell-Main-Head': class extends React.Component<ViewPropsInterface, {}> {
            public render() {
                return React.DOM.div({id: 'shell-header'},
                                     React.DOM.div({id: 'shell-room'},
                                                   this.props.MP.roomId));
            }
        },

        'HostShell-Main-Body': class extends React.Component<ViewPropsInterface & {links: any}, {currentView: string}> {
            constructor(props: ViewPropsInterface) {
                super(props);
                this.state = {currentView: 'home'};
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

                const content = React.DOM.div({ id: 'shell-main-content' },
                                              this.props['view-' + this.state.currentView.toLowerCase()]);

                return React.DOM.div({id: 'shell-body'},
                                     hamburgerMenus,
                                     React.DOM.input({ type: 'checkbox', id: 'shell-nav-trigger', className: 'shell-nav-trigger' }),
                                     React.DOM.label({ htmlFor: 'shell-nav-trigger' }),
                                     content);
            }
        },

        'HostShell-Main-Body-Menu': class extends React.Component<ViewPropsInterface & {links: any,
                                                                                        setView: any}, {}> {
            constructor(props: any) {
                super(props);
                this.setView = this.setView.bind(this);
            }

            public setView(e: any) {
                this.props.setView(e.target.innerText);
            }

            public render() {
                const tr = [React.DOM.li({onClick: this.setView, key: 'home'}, 'Home')];
                for (let i = 0; i < this.props.links.length; i = i + 1) {
                    tr.push(React.DOM.li({onClick: this.setView, key: ('link-' + i)}, this.props['links'][i]));
                }
                return React.DOM.ul({ className: 'shell-navigation' },
                                    tr);
            }
        }
    }

};

export default Shell;
