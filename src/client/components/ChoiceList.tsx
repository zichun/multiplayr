/**
 * ChoiceList.tsx
 *
 * ChoiceList component - renders a list of selectable choices.
 */

import * as React from 'react';

export class ChoiceList extends React.Component<{
    onSelect: (choice: string, choiceIndex: number) => boolean,
    selectedKey: string,
    className?: string,
    itemClassName?: string
}, {
    selectedKey: string
}> {
    constructor(props: any) {
        super(props);
        this.state = { selectedKey: this.props.selectedKey };
        this._selectItem = this._selectItem.bind(this);
    }

    private _selectItem(key: string, index: number) {
        this.props.onSelect(key, index);
        this.state.selectedKey = key;
    }

    public render() {
        let className = 'mp-choicelist';

        if (this.props.className) {
            className += ' ' + this.props.className;
        }

        const children = React.Children.map(
            this.props.children,
            (child, i) => {
                const item = child as any;
                const isSelected = (item.key === this.state.selectedKey);
                let itemClassName = item.props.className ? item.props.className : '';

                if (this.props.itemClassName) {
                    if (itemClassName) {
                        itemClassName += ' ';
                    }
                    itemClassName += this.props.itemClassName;
                }

                return React.cloneElement(item, {
                    isSelected: isSelected,
                    selectItem: this._selectItem,
                    index: i,
                    className: itemClassName,
                    choiceKey: item.key
                });
            });

        return (
            <div className={ className }>
                { children }
            </div>
        );
    }
}

export class Choice extends React.Component<{
    choiceKey?: string,
    index?: number,
    className?: string,
    selectItem?: (choice: string, choiceIndex: number) => boolean,
    isSelected?: boolean
}, {}> {
    public render() {
        let className = 'mp-choicelist-item';

        if (this.props.isSelected) {
            className += ' selected';
        }

        if (this.props.className) {
            className += ' ' + this.props.className;
        }

        return (
            <div className={ className }
                 key={ this.props.choiceKey }
                 onClick={ this.props.selectItem.bind(this, this.props.choiceKey, this.props.index) }>

                { this.props.children }
            </div>
        );
    }
}
