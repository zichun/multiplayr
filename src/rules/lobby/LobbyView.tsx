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
    'bed', 'beer', 'bomb', 'blind', 'cloud', 'cookie', 'fax', 'futbol', 'map', 'map-signs', 'paw', 'ship', 'grin'
];

function getCookie(name: string): string {
    if (typeof document === 'undefined') return '';
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
    return '';
}

function setCookie(name: string, value: string, days = 365) {
    if (typeof document === 'undefined') return;
    const d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = `expires=${d.toUTCString()}`;
    document.cookie = `${name}=${encodeURIComponent(value)};${expires};path=/;SameSite=Lax`;
}

function isDebugger(): boolean {
    if (typeof window === 'undefined') return false;
    const filename = window.location.pathname.split('/').pop() || '';
    return filename.indexOf('debug') !== -1;
}

function getTakenColors(props: any): string[] {
    const taken = [];
    const myClientId = props.MP.clientId;
    if (props.accents && props.clientIds) {
        for (let i = 0; i < props.clientIds.length; i++) {
            if (props.clientIds[i] !== myClientId) {
                taken.push(props.accents[i]);
            }
        }
    }
    return taken;
}

function getTakenIcons(props: any): number[] {
    const taken = [];
    const myClientId = props.MP.clientId;
    if (props.icons && props.clientIds) {
        for (let i = 0; i < props.clientIds.length; i++) {
            if (props.clientIds[i] !== myClientId) {
                taken.push(props.icons[i]);
            }
        }
    }
    return taken;
}

const colors_default = ['#0074D9', '#7FDBFF', '#39CCCC', '#3D9970', '#2ECC40', '#01FF70', '#EEAB00', '#FF851B', '#FF4136',
    '#F012BE', '#B10DC9'];

interface LobbyViewInterface extends ViewPropsInterface {
    names: string[],
    icons: number[],
    accents: string[],
    showHost?: boolean
}
interface LobbySetNameViewInterface extends ViewPropsInterface {
    name: string,
    colors?: string[],
    uniqueColorAndIcon?: boolean,
    clientIds?: string[],
    accents?: string[],
    icons?: number[]
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
                <FontAwesomeIcon icon={icons[this.props.icon]}
                    size='4x'
                    className='lobby-avatar-icon' />
            </div>
        );
    }
}
export class LobbyNameView extends React.Component<{
    name?: string,
    icon?: number,
    accent?: string,
    clientId?: string,
    clientIds?: string[],
    clientIndex?: number,
    names?: string[]
}, {}> {
    public render() {
        let i = undefined;
        if (this.props.clientIndex !== undefined) {
            i = this.props.clientIndex;
        } else if (this.props.clientId !== undefined && this.props.clientIds !== undefined) {
            for (i = 0; i < this.props.clientIds.length; i = i + 1) {
                if (this.props.clientId === this.props.clientIds[i]) {
                    break;
                }
            }
        }

        if (i === undefined || this.props.clientIds === undefined || i === this.props.clientIds.length || this.props.names === undefined) {
            return (
                <span>{this.props.name}</span>
            );
        }

        return (
            <span>{this.props.names[i]}</span>
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
                {avatar}
                <div className='lobby-name'>{this.props.name}</div>
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
        const showHost = this.props.showHost;
        const namesToCheck = showHost ? names : names.slice(0, names.length - 1);
        if (!namesAllFilled(namesToCheck)) {
            alert('Please fill in all player names before starting the game.');
            return;
        }

        mp.parent.startGame();
    }

    public render() {
        const createHello = (names, icons, accents) => {
            const tr = [];
            const limit = this.props.showHost ? names.length : names.length - 1;

            for (let i = 0; i < limit; i = i + 1) {
                tr.push(
                    React.createElement(
                        LobbyHelloView,
                        {
                            key: 'hello-' + i,
                            name: names[i],
                            icon: icons[i],
                            accent: accents[i]
                        }));
            }

            if (limit === 0) {
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

        const isHost = this.props.MP.clientId === this.props.MP.hostId;

        return (
            <div>
                <div id="lobby-playerlist">
                    {createHello(this.props.names, this.props.icons, this.props.accents)}
                </div>
                {isHost && (

                    <div style={{ marginTop: '30px' }}>
                        <button
                            className="lobby-brutalist-button btn-primary"
                            onClick={() => this.startGame()}
                        >
                            Start Game
                        </button>
                    </div>

                )}
            </div>
        );
    }
}
export class LobbyHostNameView extends React.Component<LobbyViewInterface & { name: string }, {}> {
    public render() {
        return (
            <div>
                {React.createElement(LobbySetNameView, this.props)}
                <hr />
                {React.createElement(LobbyView, this.props)}
            </div>
        )
    }
}
export class LobbySetNameView extends React.Component<LobbySetNameViewInterface, { name: string }> {
    constructor(props: LobbySetNameViewInterface) {
        super(props);
        let initialName = this.props.name;
        if (!isDebugger()) {
            const savedName = getCookie('mp_player_name');
            if (savedName && savedName.trim() !== '') {
                if (!initialName || initialName.trim() === '' || initialName === 'Host') {
                    initialName = savedName;
                }
            }
        }
        this.state = { name: initialName };
        this.onChange = this.onChange.bind(this);
    }

    public componentDidMount() {
        if (!isDebugger()) {
            const savedName = getCookie('mp_player_name');
            if (savedName && savedName.trim() !== '') {
                const currentName = this.props.name;
                if (!currentName || currentName.trim() === '' || currentName === 'Host') {
                    this.props.MP.setName(savedName);
                }
            }
        }
    }

    public onChange(e: any) {
        const val = e.target.value;
        this.setState({ name: val });
        this.props.MP.setName(val);
        if (!isDebugger()) {
            setCookie('mp_player_name', val);
        }
        return true;
    }

    public render() {
        const selectIcon = React.createElement(LobbySelectIconView, this.props);
        const selectAccent = React.createElement(LobbySelectAccentView, this.props);
        return (
            <div className='lobby-setname-container'>
                <input className='lobby-setname-input'
                    value={this.state.name || ''}
                    onChange={this.onChange}
                    placeholder='Your Name'
                />

                {selectIcon}
                {selectAccent}
            </div>
        );
    }
}

export class LobbySelectAccentView extends React.Component<ViewPropsInterface & { accent: string, colors?: string[], uniqueColorAndIcon?: boolean, clientIds?: string[], accents?: string[] }, { accent: string }> {
    constructor(props: any) {
        super(props);
        const colors = this.props.colors || colors_default;
        if (!this.props.accent) {
            const savedAccent = !isDebugger() ? getCookie('mp_player_accent') : '';
            let accent = (savedAccent && colors.indexOf(savedAccent) !== -1)
                ? savedAccent
                : colors[Math.floor(colors.length * Math.random())];

            if (this.props.uniqueColorAndIcon) {
                const takenColors = getTakenColors(this.props);
                if (takenColors.indexOf(accent) !== -1) {
                    const availableColors = colors.filter(c => takenColors.indexOf(c) === -1);
                    if (availableColors.length > 0) {
                        accent = availableColors[Math.floor(Math.random() * availableColors.length)];
                    }
                }
            }

            this.state = { accent: accent };
            this._setAccent(accent);
        } else {
            this.state = { accent: this.props.accent };
        }
    }

    public componentDidMount() {
        if (this.props.uniqueColorAndIcon) {
            const colors = this.props.colors || colors_default;
            const takenColors = getTakenColors(this.props);
            if (takenColors.indexOf(this.state.accent) !== -1) {
                const availableColors = colors.filter(c => takenColors.indexOf(c) === -1);
                if (availableColors.length > 0) {
                    const newAccent = availableColors[Math.floor(Math.random() * availableColors.length)];
                    this.setState({ accent: newAccent });
                    this._setAccent(newAccent);
                }
            }
        }
    }

    public componentDidUpdate(prevProps: any) {
        if (prevProps.accent !== this.props.accent) {
            this.setState({ accent: this.props.accent });
        }
    }

    private _setAccent(accent: string) {
        this.props.MP.setAccent(accent);
        this.setState({ accent: accent });
        if (!isDebugger()) {
            setCookie('mp_player_accent', accent);
        }
        return true;
    }

    public render() {
        const tr = [];
        const colors = this.props.colors || colors_default;
        const takenColors = getTakenColors(this.props);

        for (let i = 0; i < colors.length; i = i + 1) {
            let className = 'lobby-select-accent';

            if (colors[i] === this.state.accent) {
                className += ' selected';
            }

            const isTaken = this.props.uniqueColorAndIcon && takenColors.indexOf(colors[i]) !== -1;
            if (isTaken) {
                className += ' disabled';
            }

            tr.push(
                <div className={className}
                    style={{ backgroundColor: colors[i] }}
                    onClick={isTaken ? undefined : this._setAccent.bind(this, colors[i])}
                    key={'accent' + i}>
                </div>
            );
        }

        return (
            <div className='lobby-select-accent-container'>
                {tr}
                <div className='clear'>&nbsp;</div>
            </div>
        );
    }
}

export class LobbySelectIconView extends React.Component<ViewPropsInterface & { icon: number, accent: string, uniqueColorAndIcon?: boolean, clientIds?: string[], icons?: number[] }, { icon: number }> {
    constructor(props: any) {
        super(props);
        this.state = { icon: this.props.icon };
    }

    public componentDidMount() {
        let desiredIcon = this.props.icon;
        if (!isDebugger()) {
            const savedIconStr = getCookie('mp_player_icon');
            if (savedIconStr !== '') {
                const savedIcon = parseInt(savedIconStr, 10);
                if (!isNaN(savedIcon) && savedIcon >= 0 && savedIcon < icons.length) {
                    desiredIcon = savedIcon;
                }
            }
        }

        if (this.props.uniqueColorAndIcon) {
            const takenIcons = getTakenIcons(this.props);
            if (takenIcons.indexOf(desiredIcon) !== -1) {
                const availableIcons = [];
                for (let i = 0; i < icons.length; i++) {
                    if (takenIcons.indexOf(i) === -1) {
                        availableIcons.push(i);
                    }
                }
                if (availableIcons.length > 0) {
                    desiredIcon = availableIcons[Math.floor(Math.random() * availableIcons.length)];
                }
            }
        }

        if (this.props.icon !== desiredIcon) {
            this.props.MP.setIcon(desiredIcon);
            this.setState({ icon: desiredIcon });
        }
    }

    public componentDidUpdate(prevProps: any) {
        if (prevProps.icon !== this.props.icon) {
            this.setState({ icon: this.props.icon });
        }
    }

    private _setIcon(icon: number) {
        this.props.MP.setIcon(icon);
        this.setState({ icon: icon });
        if (!isDebugger()) {
            setCookie('mp_player_icon', icon.toString());
        }
        return true;
    }

    public render() {
        const tr = [];
        const takenIcons = getTakenIcons(this.props);

        for (let i = 0; i < icons.length; i = i + 1) {
            let className = 'lobby-select-icon-icon';
            let style = {};
            if (this.state.icon === i) {
                className += ' selected';
                style = { 'color': this.props.accent };
            }
            const isTaken = this.props.uniqueColorAndIcon && takenIcons.indexOf(i) !== -1;
            let iconContainerClassName = 'lobby-select-icon';
            if (isTaken) {
                iconContainerClassName += ' disabled';
            }
            tr.push(
                <div className={iconContainerClassName}
                    key={'select-icon-' + i}
                    onClick={isTaken ? undefined : this._setIcon.bind(this, i)}>

                    <FontAwesomeIcon icon={icons[i]}
                        size='2x'
                        className={className}
                        style={style}
                        key={'icon-' + icons[i]} />
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
