/**
 * Notification.tsx
 *
 * Notification component - renders a modal notification.
 *
 * todo: allow non-modal views, and timer to auto hide.
 */

import * as ReactCSSTransitionGroup from 'react-addons-css-transition-group';
import * as React from 'react';

export class Notification extends React.Component<{
    clickToHide?: boolean
}, {
    hidden: boolean
}> {
    private _clickToHide: boolean;

    constructor(props: any) {
        super(props);

        this.state = {
            hidden: false
        };

        if (this.props.clickToHide === undefined) {
            this._clickToHide = true;
        } else {
            this._clickToHide = this.props.clickToHide;
        }
    }

    private _onClick() {
        if (this._clickToHide) {
            this.setState({
                hidden: true
            });
        }
    }

    public render() {
        let children = null;
        let overlay = null;

        if (this.state.hidden === false) {
            children = (
                <div className='mp-notification'>
                    <div key='mp-notification-content'
                         className='mp-notification-content'>
                        { this.props.children }
                    </div>
                </div>
            );
            overlay = (
                <div className='mp-notification-overlay'
                     onClick={ this._onClick.bind(this) }>
                    &nbsp;
                </div>
            );
        }

        return (
            <div>
                { overlay }
                <ReactCSSTransitionGroup
                    transitionName='mp-notification'
                    transitionAppear={ true }
                    transitionAppearTimeout={ 500 }
                    transitionLeaveTimeout={ 500 }
                    transitionLeave={ true }
                    transitionEnter={ false }>
                    { children }
                </ReactCSSTransitionGroup>
            </div>
        );
    }
}
