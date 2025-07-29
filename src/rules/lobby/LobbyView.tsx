import {
    ViewPropsInterface
} from '../../common/interfaces';
import { IconName } from '@fortawesome/fontawesome-common-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import * as React from 'react';

export const icons: IconName[] = [
    'car', 'id-badge', 'battery-empty', 'battery-full', 'battery-half', 'thermometer-empty', 'user-circle', 'address-card', 'umbrella', 'quote-left',
    'id-card', 'bath', 'dice', 'dna', 'microchip', 'adjust', 'chart-area', 'fire', 'battery-quarter',
    'bicycle', 'book', 'briefcase', 'bullhorn', 'calculator', 'circle', 'coffee', 'cube', 'envelope', 'faucet',
    'fire-extinguisher', 'gift', 'hand-peace', 'hand-spock', 'hashtag', 'hotel', 'hourglass', 'hourglass-end', 'hourglass-half',
    'mortar-pestle', 'pen', 'pencil-alt', 'phone', 'chart-pie', 'power-off', 'trash', 'binoculars', 'bug', 'cog', 'cubes',
    'female', 'flag', 'flask', 'chart-line', 'sign-language', 'sitemap', 'space-shuttle', 'tags', 'wrench',
    'ticket-alt', 'tree', 'unlock', 'street-view', 'plug', 'money-bill', 'male', 'fighter-jet', 'cut', 'bus', 'birthday-cake',
    'bed', 'beer', 'bomb', 'blind', 'cloud', 'cookie', 'fax', 'futbol', 'map', 'map-signs', 'paw', 'ship', 'grin',
    'telegram', 'imdb', 'etsy', 'apple', 'amazon', 'quora', 'windows', 'facebook-square', 'twitter', 'google', 'android', 'linux'
];

const colors_default = ['#0074D9', '#7FDBFF', '#39CCCC', '#3D9970', '#2ECC40', '#01FF70', '#EEAB00', '#FF851B', '#FF4136',
                        '#F012BE', '#B10DC9', '#AAAAAA'];

interface LobbyViewInterface extends ViewPropsInterface {
    names: string[],
    icons: number[],
    accents: string[]
}
interface LobbySetNameViewInterface extends ViewPropsInterface {
    name: string,
    colors?: string[]
}

function namesAllFilled(names: string[]): boolean {
    for (let i = 0; i < names.length; i++) {
        if (names[i].trim().length < 1) {
            return false;
        }
    }
    return true;
}

export class LobbyAvatarView extends React.Component<{
    name: string,
    accent: string,
    icon: number
}, {}> {
    public render() {
        return (
            <div className='lobby-avatar'
                    style={{ backgroundColor: this.props.accent }}>
                <FontAwesomeIcon icon={ icons[this.props.icon] }
                                size='4x'
                                className='lobby-avatar-icon' />
            </div>
        );
    }
}
export class LobbyHelloView extends React.Component<{
    name: string,
    icon: number,
    accent: string
}, {}> {
    public render() {
        const avatar = React.createElement(
            LobbyAvatarView,
            this.props);

        return (
            <div className='lobby-player-card'>
                { avatar }
                <div className='lobby-name'>{ this.props.name }</div>
            </div>
        );
    }
}
export class LobbyView extends React.Component<LobbyViewInterface, {}> {
    constructor(props: LobbyViewInterface) {
        super(props);
        this.startGame = this.startGame.bind(this);
    }

    public startGame() {
        const mp = this.props.MP;
        const names = this.props.names;
        if (!namesAllFilled(names)) {
            alert('Please fill in all player names before starting the game.');
            return;
        }

        mp.parent.startGame();
    }

    public render() {
        const createHello = (names, icons, accents) => {
            const tr = [];

            for (let i = 0; i < names.length; i = i + 1) {
                tr.push(
                    React.createElement(
                        LobbyHelloView,
                        {
                            key: 'hello-' + i,
                            name: names[i],
                            icon: icons[i],
                            accent: accents[i]
                        }) );
            }

            if (names.length === 0) {
                tr.push(
                    React.createElement(
                        'div',
                        {
                            className: 'waiting',
                            key: 'waiting'
                        },
                        'Waiting for players to join'));
            }

            return tr;
        };

        return React.createElement(
            'div',
            null,
            React.createElement('div', { id: 'lobby-playerlist' }, createHello(this.props.names, this.props.icons, this.props.accents)),
            React.createElement('button', { onClick: this.startGame }, 'Start game')
        );
    }
}
export class LobbyHostNameView extends React.Component<LobbyViewInterface & { name: string }, {}> {
    public render() {
        return (
            <div>
                { React.createElement(LobbySetNameView, this.props) }
                <hr />
                { React.createElement(LobbyView, this.props) }
            </div>
        )
    }
}
export class LobbySetNameView extends React.Component<LobbySetNameViewInterface, { name: string }> {
    constructor(props: LobbySetNameViewInterface) {
        super(props);
        this.state = { name: this.props.name };
        this.onChange = this.onChange.bind(this);
    }

    public onChange(e: any) {
        this.setState({ name: e.target.value });
        this.props.MP.setName(e.target.value);
        return true;
    }

    public render() {
        const selectIcon = React.createElement(LobbySelectIconView, this.props);
        const selectAccent = React.createElement(LobbySelectAccentView, this.props);
        return (
            <div className='lobby-setname-container'>
                <input className='lobby-setname-input'
                        defaultValue={ this.state.name }
                        onChange={ this.onChange }
                        placeholder='Your Name'
                        />

                { selectIcon }
                { selectAccent }
            </div>
        );
    }
}

export class LobbySelectAccentView extends React.Component<ViewPropsInterface & { accent: string, colors?: string[] }, { accent: string }> {
    constructor(props: any) {
        super(props);
        const colors = this.props.colors || colors_default;
        if (!this.props.accent) {
            const accent = colors[Math.floor(colors.length * Math.random())];
            this.state = { accent: accent };
            this._setAccent(accent);
        } else {
            this.state = { accent: this.props.accent };
        }
    }

    private _setAccent(accent: string) {
        this.props.MP.setAccent(accent);
        this.setState({ accent: accent });
        return true;
    }

    public render() {
        const tr = [];
        const colors = this.props.colors || colors_default;

        for (let i = 0; i < colors.length; i = i + 1) {
            let className = 'lobby-select-accent';

            if (colors[i] === this.state.accent) {
                className += ' selected';
            }

            tr.push(
                <div className={ className }
                        style={{ backgroundColor: colors[i] }}
                        onClick={ this._setAccent.bind(this, colors[i]) }
                        key={ 'accent' + i }>
                </div>
            );
        }

        return (
            <div className='lobby-select-accent-container'>
                {tr};
                <div className='clear'>&nbsp;</div>
            </div>
        );
    }
}

export class LobbySelectIconView extends React.Component<ViewPropsInterface & { icon: number, accent: string } , { icon: number }> {
    constructor(props: any) {
        super(props);
        this.state = { icon: this.props.icon };
    }

    private _setIcon(icon: number) {
        this.props.MP.setIcon(icon);
        this.setState({ icon: icon });
        return true;
    }

    public render() {
        const tr = [];

        for (let i = 0; i < icons.length; i = i + 1) {
            let className = 'lobby-select-icon-icon';
            let style = {};
            if (this.state.icon === i) {
                className += ' selected';
                style = { 'color': this.props.accent };
            }
            tr.push(
                <div className='lobby-select-icon'
                        key={ 'select-icon-' + i }
                        onClick={ this._setIcon.bind(this, i) }>

                    <FontAwesomeIcon icon={ icons[i] }
                                    size='2x'
                                    className={ className }
                                    style={ style }
                                    key={ 'icon-' + icons[i] } />
                </div>
            );
        }

        return (
            <div className='lobby-select-icon-container'>
                {tr}
                <div className='clear'>&nbsp;</div>
            </div>
        );
    }
}
