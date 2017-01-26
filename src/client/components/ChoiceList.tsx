/**
 * ChoiceList.tsx
 *
 * ChoiceList component - renders a list of selectable choices.
 */

import * as React from 'react';

export class ChoiceList extends React.Component<{
    onSelect: (choice: string, choiceIndex: number) => boolean,
    onUnselect?: (choice: string, choiceIndex: number) => boolean,
    selectedKey?: string,
    selectedKeys?: string[],
    multi?: boolean,
    className?: string,
    itemClassName?: string,
    style?: any
}, {
    selectedKeys: string[]
}> {
    constructor(props: any) {
        super(props);

        if (this.props.selectedKey) {
            this.state = { selectedKeys: [this.props.selectedKey] };
        } else if (this.props.selectedKeys) {
            this.state = { selectedKeys: this.props.selectedKeys };
        } else {
            this.state = { selectedKeys: [] };
        }

        this._selectItem = this._selectItem.bind(this);
        this._unselectItem = this._unselectItem.bind(this);
    }

    private _selectItem(key: string, index: number) {
        if (this.props.onSelect) {
            this.props.onSelect(key, index);
        }
        if (this.props.multi) {
            for (let i = 0; i < this.state.selectedKeys.length; i = i + 1) {
                if (this.state.selectedKeys[i] === key) {
                    return;
                }
            }
            this.state.selectedKeys.push(key);
        } else {
            this.state.selectedKeys = [key];
        }
    }

    private _unselectItem(key: string, index: number) {

        if (this.props.onUnselect) {
            this.props.onUnselect(key, index);
        }

        if (this.props.multi) {
            const tr = [];
            for (let i = 0; i < this.state.selectedKeys.length; i = i + 1) {
                if (this.state.selectedKeys[i] !== key) {
                    tr.push(this.state.selectedKeys[i]);
                }
            }
            this.state.selectedKeys = tr;
        }
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
                if (item.type.name !== 'Choice') {
                    return item;
                }
                let isSelected = false;
                for (let i = 0; i < this.state.selectedKeys.length; i = i + 1) {
                    if (item.key === this.state.selectedKeys[i]) {
                        isSelected = true;
                        break;
                    }
                }
                let itemClassName = item.props.className ? item.props.className : '';

                if (this.props.itemClassName) {
                    if (itemClassName) {
                        itemClassName += ' ';
                    }
                    itemClassName += this.props.itemClassName;
                }

                return React.cloneElement(item, {
                    isSelected: isSelected,
                    multi: this.props.multi,
                    selectItem: this._selectItem,
                    unselectItem: this._unselectItem,
                    index: i,
                    className: itemClassName,
                    choiceKey: item.key
                });
            });

        return (
            <div className={ className } style={ this.props.style }>
                { children }
            </div>
        );
    }
}

export class Choice extends React.Component<{
    choiceKey?: string,
    index?: number,
    multi?: boolean,
    className?: string,
    selectItem?: (choice: string, choiceIndex: number) => boolean,
    unselectItem?: (choice: string, choiceIndex: number) => boolean,
    isSelected?: boolean
}, {}> {

    private _onClick() {
        if (this.props.multi) {
            if (this.props.isSelected) {
                this.props.unselectItem(this.props.choiceKey, this.props.index);
            } else {
                this.props.selectItem(this.props.choiceKey, this.props.index);
            }
        } else {
            this.props.selectItem(this.props.choiceKey, this.props.index);
        }
    }

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
                 onClick={ this._onClick.bind(this) } >

                { this.props.children }
            </div>
        );
    }
}
