/**
 * Notification.tsx
 *
 * Notification component - renders a modal notification.
 *
 * todo: allow non-modal views, and timer to auto hide.
 */

import { CSSTransition, TransitionGroup } from 'react-transition-group';
import * as React from 'react';

export class Notification extends React.Component<{
    hideAfter?: number,
    clickToHide?: boolean
}, {
    hidden: boolean,
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

        if (this.props.hideAfter !== undefined) {
            setTimeout(this._onClick.bind(this),
                       this.props.hideAfter);
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
                <TransitionGroup>
                    {children && (
                        <CSSTransition
                            key="mp-notification-content"
                            classNames="mp-notification"
                            timeout={{ enter: 500, exit: 500 }}
                            appear={true}>
                            {children}
                        </CSSTransition>
                    )}
                </TransitionGroup>
            </div>
        );
    }
}
