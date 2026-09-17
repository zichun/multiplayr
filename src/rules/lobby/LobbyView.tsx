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
    showHost?: boolean,
    clientIds?: string[],
    playerOrder?: string[]
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
    names?: string[],
    showHost?: boolean
}, {}> {
    public render() {
        let i = undefined;
        if (this.props.clientIndex !== undefined) {
            i = this.props.showHost ? this.props.clientIndex : this.props.clientIndex + 1;
        } else if (this.props.clientId !== undefined && this.props.clientIds !== undefined) {
            for (i = 0; i < this.props.clientIds.length; i = i + 1) {
                if (this.props.clientId === this.props.clientIds[i]) {
                    break;
                }
            }
        }

        if (i === undefined || this.props.clientIds === undefined || i >= this.props.clientIds.length || this.props.names === undefined) {
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
    accent: string,
    isItemHost?: boolean,
    canReorder?: boolean,
    onMoveUp?: () => void,
    onMoveDown?: () => void,
    isDragging?: boolean,
    isDragOver?: boolean,
    containerProps?: any,
    dragHandleProps?: any
}, {}> {
    public render() {
        const avatar = React.createElement(
            LobbyAvatarView,
            this.props);

        const isDragging = this.props.isDragging;
        const isDragOver = this.props.isDragOver;

        return (
            <div
                className={`lobby-player-card ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''} ${this.props.isItemHost ? 'is-host' : ''}`}
                {...this.props.containerProps}
            >
                {this.props.canReorder && (
                    <div
                        className="lobby-card-drag-handle"
                        {...this.props.dragHandleProps}
                        title="Drag to change player order"
                    >
                        <FontAwesomeIcon icon="bars" />
                    </div>
                )}
                {avatar}
                <div className='lobby-name'>
                    {this.props.name}
                    {this.props.isItemHost && <span className="lobby-host-pill">Host</span>}
                </div>
                {this.props.canReorder && (
                    <div className="lobby-card-reorder-btns">
                        <button
                            type="button"
                            className="lobby-order-btn"
                            disabled={!this.props.onMoveUp}
                            onClick={this.props.onMoveUp}
                            title="Move up in turn order"
                        >
                            ▲
                        </button>
                        <button
                            type="button"
                            className="lobby-order-btn"
                            disabled={!this.props.onMoveDown}
                            onClick={this.props.onMoveDown}
                            title="Move down in turn order"
                        >
                            ▼
                        </button>
                    </div>
                )}
            </div>
        );
    }
}

interface LobbyViewState {
    draggingIndex: number | null;
    dragOverIndex: number | null;
}

export class LobbyView extends React.Component<LobbyViewInterface, LobbyViewState> {
    private touchStartY: number = 0;
    private touchStartIndex: number | null = null;
    private touchCurrentTargetIndex: number | null = null;

    constructor(props: LobbyViewInterface) {
        super(props);
        this.state = {
            draggingIndex: null,
            dragOverIndex: null
        };
        this.startGame = this.startGame.bind(this);
        this.handleMove = this.handleMove.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
    }

    public startGame() {
        const mp = this.props.MP;
        const names = this.props.names;
        const showHost = this.props.showHost;
        const namesToCheck = showHost ? names : (names ? names.slice(1) : []);
        if (!namesAllFilled(namesToCheck)) {
            alert('Please fill in all player names before starting the game.');
            return;
        }

        mp.parent.startGame();
    }

    public handleMove(fromIndex: number, toIndex: number) {
        const mp = this.props.MP;
        if (mp && mp.reorderPlayer) {
            mp.reorderPlayer(fromIndex, toIndex);
        }
    }

    private handleTouchStart(e: React.TouchEvent, index: number) {
        this.touchStartY = e.touches[0].clientY;
        this.touchStartIndex = index;
        this.touchCurrentTargetIndex = index;
        this.setState({ draggingIndex: index, dragOverIndex: index });
    }

    private handleTouchMove(e: React.TouchEvent) {
        if (this.touchStartIndex === null) return;
        const touch = e.touches[0];
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        if (el) {
            const cardEl = el.closest('[data-player-index]');
            if (cardEl) {
                const targetIdx = parseInt(cardEl.getAttribute('data-player-index') || '-1', 10);
                if (targetIdx >= 0 && targetIdx !== this.state.dragOverIndex) {
                    this.touchCurrentTargetIndex = targetIdx;
                    this.setState({ dragOverIndex: targetIdx });
                }
            }
        }
    }

    private handleTouchEnd() {
        if (this.touchStartIndex !== null && this.touchCurrentTargetIndex !== null && this.touchStartIndex !== this.touchCurrentTargetIndex) {
            this.handleMove(this.touchStartIndex, this.touchCurrentTargetIndex);
        }
        this.touchStartIndex = null;
        this.touchCurrentTargetIndex = null;
        this.setState({ draggingIndex: null, dragOverIndex: null });
    }

    public render() {
        const isHost = this.props.MP.clientId === this.props.MP.hostId;
        const createHello = (names, icons, accents) => {
            const tr = [];
            const startIndex = this.props.showHost ? 0 : 1;
            const limit = names ? names.length : 0;
            const clientIds = this.props.clientIds || [];

            for (let i = startIndex; i < limit; i = i + 1) {
                const isItemHost = clientIds[i] === this.props.MP.hostId;
                const canMoveUp = i > startIndex;
                const canMoveDown = i < limit - 1;

                tr.push(
                    React.createElement(
                        LobbyHelloView,
                        {
                            key: 'hello-' + (clientIds[i] || i),
                            name: names[i],
                            icon: icons[i],
                            accent: accents[i],
                            isItemHost: isItemHost,
                            canReorder: isHost && (limit - startIndex > 1),
                            onMoveUp: canMoveUp ? () => this.handleMove(i, i - 1) : undefined,
                            onMoveDown: canMoveDown ? () => this.handleMove(i, i + 1) : undefined,
                            isDragging: this.state.draggingIndex === i,
                            isDragOver: this.state.dragOverIndex === i && this.state.draggingIndex !== i,
                            containerProps: {
                                'data-player-index': i,
                                draggable: isHost,
                                onDragStart: (e: React.DragEvent) => {
                                    e.dataTransfer.setData('text/plain', String(i));
                                    this.setState({ draggingIndex: i });
                                },
                                onDragOver: (e: React.DragEvent) => {
                                    e.preventDefault();
                                    if (this.state.dragOverIndex !== i) {
                                        this.setState({ dragOverIndex: i });
                                    }
                                },
                                onDrop: (e: React.DragEvent) => {
                                    e.preventDefault();
                                    const from = this.state.draggingIndex;
                                    if (from !== null && from !== i) {
                                        this.handleMove(from, i);
                                    }
                                    this.setState({ draggingIndex: null, dragOverIndex: null });
                                },
                                onDragEnd: () => {
                                    this.setState({ draggingIndex: null, dragOverIndex: null });
                                }
                            },
                            dragHandleProps: {
                                onTouchStart: (e: React.TouchEvent) => this.handleTouchStart(e, i),
                                onTouchMove: (e: React.TouchEvent) => this.handleTouchMove(e),
                                onTouchEnd: () => this.handleTouchEnd()
                            }
                        }));
            }

            if (limit - startIndex <= 0) {
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
