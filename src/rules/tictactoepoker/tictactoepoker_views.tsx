import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { MPType, ViewPropsInterface } from '../../common/interfaces';
import { Board, Card, CardType, Suit, PlayNormalCard, PlayJoker, PlayThief } from './tictactoepoker';

export interface TicTacToePokerViewPropsInterface extends ViewPropsInterface {
    waiting: boolean;
    num_players: number;
    view_player: number;  // Player this view represents
    turn: number;  // Player whose turn it is
    winner: number;
    boards: Board[];
    scores: number[];
    table_cards: Card[];
}

function waiting(_props: ViewPropsInterface) {
    return (<div>Waiting for opponent to join</div>);
}

export class TicTacToePokerView extends React.Component<TicTacToePokerViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const view = this.props.waiting ? waiting(this.props) : React.createElement(TicTacToePokerMainView, this.props);

        return mp.getPluginView(
            'gameshell',
            'HostShell-Main',
            {
                'links': {
                    'home': {
                        'icon': 'bomb',
                        'label': 'Flags',
                        'view': view
                    }
                }
            }
        );
    }
}

enum CardViewUILocationEnum {
    PlayerBoard,
    TableCard,
    JokerPopup,
}

interface CardViewPropsInterface {
    readonly card: Card;
    readonly ui_location: CardViewUILocationEnum;
    ui_state_manager: UIStateManager;

    // For PlayerBoard cards
    readonly board_player?: number;
    readonly row?: number;
    readonly col?: number;

    // For TableCard cards
    readonly table_card_index?: number;
}

class CardView extends React.Component<CardViewPropsInterface, {}> {
    constructor(props: CardViewPropsInterface) {
        super(props);
    }

    private static value_string(value: number): string {
        if (value >= 2 && value<= 10) {
            return value.toString();
        } else if (value == 11) {
            return "J";
        } else if (value == 12) {
            return "Q";
        } else if (value == 13) {
            return "K";
        } else if (value == 1) {
            return "A";
        }
        return "?";
    }

    private static suit_string(suit: Suit): string {
        switch(suit) {
            case Suit.Diamonds: return '\u2666';
            case Suit.Clubs: return '\u2660';
            case Suit.Hearts: return '\u2665';
            case Suit.Spades: return '\u2663';
        }
        return '?';
    }

    private static card_type_string(type: CardType): string {
        switch(type) {
            case CardType.Normal: return "";
            case CardType.Empty: return "";
            case CardType.Joker: return "\u{1F921}";
            case CardType.Thief: return "\u{1F575}";
        }
        return "?";
    }

    private handle_drag_event(event: React.DragEvent<HTMLDivElement>) {
        this.props.ui_state_manager.handle_card_view_drag_event(this.props, event);
    }

    private handle_click_event(event: React.MouseEvent<HTMLDivElement>) {
        this.props.ui_state_manager.handle_card_view_click_event(this.props, event);
    }

    public render() {
        let suit_class = "";
        let card_text = "";
        if (this.props.card.is_normal()) {
            suit_class = "suit-" + Suit[this.props.card.get_suit()].toLowerCase();
            card_text = CardView.value_string(this.props.card.get_value()) + " " +
                        CardView.suit_string(this.props.card.get_suit());
        } else {
            suit_class = "suit-special";
            card_text = CardView.card_type_string(this.props.card.get_type());
        }
        return (
            <div className={suit_class + " card-frame"}
                 draggable={true}
                 onClick={this.handle_click_event.bind(this)}
                 onDrag={this.handle_drag_event.bind(this)}
                 onDragEnter={this.handle_drag_event.bind(this)}
                 onDragLeave={this.handle_drag_event.bind(this)}
                 onDragExit={this.handle_drag_event.bind(this)}
                 onDragStart={this.handle_drag_event.bind(this)}
                 onDragEnd={this.handle_drag_event.bind(this)}
                 onDragOver={this.handle_drag_event.bind(this)}
                 onDrop={this.handle_drag_event.bind(this)}>
                <div className="card-text">{card_text}</div>
            </div>);
    }
}

function BoardView(props: PlayerViewPropsInterface) {
    const result = [];
    for (let row = 0; row < 3; row++) {
        const row_result = [];
        for (let col = 0; col < 3; col++) {
            row_result.push(
                <td key={row.toString() + "," + col.toString()}>
                    <CardView
                        card={props.board.get_card(row, col)}
                        ui_location={CardViewUILocationEnum.PlayerBoard}
                        board_player={props.board_player}
                        row={row}
                        col={col}
                        ui_state_manager={props.ui_state_manager} />
                </td>);
        }
        result.push(<tr key={row}>{row_result}</tr>);
    }
    return (<table><tbody>{result}</tbody></table>);
}

function TableCardsView(props: {table_cards: Card[], ui_state_manager: UIStateManager}) {
    const result = [];
    for (let tci = 0; tci < props.table_cards.length; tci++) {
        result.push(<td key={tci}>
            <CardView
                card={props.table_cards[tci]}
                ui_location={CardViewUILocationEnum.TableCard}
                table_card_index={tci}
                ui_state_manager={props.ui_state_manager} />
        </td>);
    }

    let active_class = "";
    if (props.ui_state_manager.is_table_cards_view_active()) {
        active_class = "active";
    } else {
        active_class = "inactive";
    }
    return (
        <div id="table-cards-view" className={active_class}>
            <table><tbody><tr>{result}</tr></tbody></table>
        </div>);
}

interface PlayerViewPropsInterface {
    board_player: number;
    board: Board;
    score: number;
    ui_state_manager: UIStateManager;
}

class PlayerView extends React.Component<PlayerViewPropsInterface, {}> {
    constructor(props: PlayerViewPropsInterface) {
        super(props);
    }

    public render() {
        let player_view_class = "player-view ";
        if (this.props.ui_state_manager.is_player_view_active(this.props.board_player)) {
            player_view_class += "active";
        } else {
            player_view_class += "inactive";
        }
        return (<div className={player_view_class}>
            <BoardView {...this.props} />
            <div className="player-name">Player {this.props.board_player}</div>
            <div className="player-score">Score: {this.props.score}</div>
        </div>);
    }
}

enum UIStateEnum {
    Unknown,
    NotMyTurn,
    MyTurnThinking,
    MyTurnDraggingTableCard,
    MyTurnThiefThinking,
    MyTurnThiefDraggingCardToSteal,
    MyTurnJokerPopup,
    GameOver,
}

class UIStateManager {
    private rerender: () => void;
    private MP: MPType;
    private ui_state: UIStateEnum;
    private readonly view_player: number;
    private turn: number;

    // For MyTurnDraggingTableCard, MyTurnJokerPopup, MyTurnThiefDraggingCardToSteal
    // (for the Joker and Thief cases, this is the table card index of the Joker / Thief)
    private table_card: Card;
    private table_card_index: number;

    // For MyTurnJokerPopup
    private play_at_row: number;
    private play_at_col: number;

    // For MyTurnThiefDraggingCardToSteal
    private steal_from_player: number;
    private steal_from_row: number;
    private steal_from_col: number;

    constructor(rerender: () => void, MP: MPType, view_player: number) {
        this.ui_state = UIStateEnum.Unknown;
        this.rerender = rerender;
        this.MP = MP;
        this.view_player = view_player;
    }

    public get_turn(): number {
        return this.turn;
    }

    public set_turn(turn: number) {
        if (this.turn == turn) {
            return;
        }
        this.turn = turn;
        if (this.view_player == turn) {
            this.set_state(UIStateEnum.MyTurnThinking);
        } else {
            this.set_state(UIStateEnum.NotMyTurn);
        }

        if (turn == -1) {
            this.set_state(UIStateEnum.GameOver);
        }
    }

    public set_state(new_state: UIStateEnum) {
        if (this.ui_state == UIStateEnum.MyTurnJokerPopup ||
            this.ui_state == UIStateEnum.MyTurnThiefDraggingCardToSteal) {
            // Rerender when transitioning out of the Joker popup,
            // or when finishing a Thief drag to steal.
            this.rerender();
        }

        this.ui_state = new_state;

        if (new_state == UIStateEnum.MyTurnJokerPopup ||
            new_state == UIStateEnum.MyTurnThiefThinking) {
                // Rerender when transitioning into Joker popup,
                // or Thief
                this.rerender();
        }
    }

    public is_table_cards_view_active(): boolean {
        if (this.ui_state == UIStateEnum.MyTurnThinking) {
            return true;
        }
        return false;
    }

    public is_player_view_active(board_player: number): boolean {
        if (this.ui_state == UIStateEnum.GameOver) {
            // If the game is over then all boards are inactive.
            return false;
        }
        if (board_player == this.view_player && this.ui_state != UIStateEnum.NotMyTurn) {
            // Active if it's my turn and it's my board.
            return true;
        }
        if (this.ui_state == UIStateEnum.MyTurnThiefThinking) {
            // If we're in the Thief thinking state, then all boards are active.
            return true;
        }

        return false;
    }

    public handle_card_view_click_event(
        card_view_props: CardViewPropsInterface,
        event: React.MouseEvent<HTMLDivElement>) {
        event.preventDefault();

        if (this.ui_state == UIStateEnum.MyTurnJokerPopup) {
            // A click on a card in the Joker popup
            if (card_view_props.ui_location != CardViewUILocationEnum.JokerPopup) {
                return;
            }

            this.MP.make_move(new PlayJoker(
                this.view_player, this.table_card_index, this.play_at_row, this.play_at_col,
                card_view_props.card));
            this.set_state(UIStateEnum.NotMyTurn);

            return;
        }

        if (this.ui_state == UIStateEnum.MyTurnThinking) {
            // A click on a table card when thinking
            if (card_view_props.ui_location != CardViewUILocationEnum.TableCard ||
                card_view_props.card.get_type() != CardType.Thief) {
                // Only Thieves can be clicked
                return;
            }
            this.table_card = card_view_props.card;
            this.table_card_index = card_view_props.table_card_index;
            this.set_state(UIStateEnum.MyTurnThiefThinking);
            return;
        }
    }

    public handle_card_view_drag_event(
        card_view_props: CardViewPropsInterface,
        event: React.DragEvent<HTMLDivElement>) {


        const handle_drag_start = (event: React.DragEvent<HTMLDivElement>) => {
            console.log("start");

            // For it to be a thief drag, we must be in the Thief thinking state,
            // and we must be dragging a board card from another player's board.
            const is_valid_thief_drag = (this.ui_state == UIStateEnum.MyTurnThiefThinking &&
                card_view_props.ui_location == CardViewUILocationEnum.PlayerBoard &&
                card_view_props.board_player != this.view_player);

            if (is_valid_thief_drag) {
                this.set_state(UIStateEnum.MyTurnThiefDraggingCardToSteal);
                this.steal_from_player = card_view_props.board_player;
                this.steal_from_row = card_view_props.row;
                this.steal_from_col = card_view_props.col;
            } else {
                // Otherwise, drags are only permitted in MyTurnThinking state,
                // and we can only drag a table card.
                if (this.ui_state != UIStateEnum.MyTurnThinking ||
                    card_view_props.ui_location != CardViewUILocationEnum.TableCard)  {
                    event.preventDefault();
                    return;
                }
                this.set_state(UIStateEnum.MyTurnDraggingTableCard);
                this.table_card = card_view_props.card;
                this.table_card_index = card_view_props.table_card_index;
            }

        }

        const handle_drop = (event: React.DragEvent<HTMLDivElement>) => {
            // For the drop event, the card_view_props is the card corresponding to the
            // blank space on the target board (i.e. it's the card that's being dropped ONTO,
            // and NOT the card that was being dragged).
            console.log("drop");
            event.preventDefault();
            if (this.ui_state != UIStateEnum.MyTurnDraggingTableCard &&
                this.ui_state != UIStateEnum.MyTurnThiefDraggingCardToSteal)  {
                return;
            }

            // Can only drop onto an empty space on your player board.
            if (card_view_props.ui_location != CardViewUILocationEnum.PlayerBoard ||
                card_view_props.board_player != this.view_player ||
                !card_view_props.card.is_empty()) {
                return;
            }

            if (this.ui_state == UIStateEnum.MyTurnDraggingTableCard) {
                if (this.table_card.is_normal()) {
                    this.MP.make_move(new PlayNormalCard(
                        this.view_player, this.table_card_index,
                        card_view_props.row, card_view_props.col));
                    this.set_state(UIStateEnum.NotMyTurn);
                } else {
                    if (this.table_card.get_type() == CardType.Joker) {
                        this.play_at_row = card_view_props.row;
                        this.play_at_col = card_view_props.col;
                        this.set_state(UIStateEnum.MyTurnJokerPopup);
                    }
                }
            } else if (this.ui_state == UIStateEnum.MyTurnThiefDraggingCardToSteal) {
                this.MP.make_move(new PlayThief(
                    this.view_player, this.table_card_index,
                    card_view_props.row, card_view_props.col,
                    this.steal_from_player, this.steal_from_row, this.steal_from_col));
                this.set_state(UIStateEnum.NotMyTurn);
            }
        };
        const handle_drag = (event: React.DragEvent<HTMLDivElement>) => {
            console.log("drag");
            if (this.ui_state != UIStateEnum.MyTurnDraggingTableCard &&
                this.ui_state != UIStateEnum.MyTurnThiefDraggingCardToSteal)  {
                return;
            }
        };
        const handle_drag_over = (event: React.DragEvent<HTMLDivElement>) => {
            console.log("over");
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
        };
        const handle_drag_enter = (event: React.DragEvent<HTMLDivElement>) =>  {
            console.log("enter");
            event.preventDefault();

            if (this.ui_state != UIStateEnum.MyTurnDraggingTableCard &&
                this.ui_state != UIStateEnum.MyTurnThiefDraggingCardToSteal) {
                return;
            }

            if (card_view_props.board_player != this.view_player) {
                return;
            }
            if (!card_view_props.card.is_empty()) {
                return;
            }

            if (!event.currentTarget.classList.contains("drag-highlight")) {
                event.currentTarget.classList.add("drag-highlight");
            }
        }
        const handle_drag_leave = (event: React.DragEvent<HTMLDivElement>) =>  {
            console.log("leave");
            event.preventDefault();
            if (this.ui_state != UIStateEnum.MyTurnDraggingTableCard &&
                this.ui_state != UIStateEnum.MyTurnThiefDraggingCardToSteal)  {
                return;
            }
            event.currentTarget.classList.remove("drag-highlight");
        }
        const handle_drag_end = (event: React.DragEvent<HTMLDivElement>) => {
            console.log("end");
            event.preventDefault();
            if (this.ui_state == UIStateEnum.MyTurnDraggingTableCard)  {
                this.set_state(UIStateEnum.MyTurnThinking);
            } else if (this.ui_state == UIStateEnum.MyTurnThiefDraggingCardToSteal) {
                this.set_state(UIStateEnum.MyTurnThiefThinking);
            }
        }

        const handlers = {
            "drag": handle_drag,
            "dragstart": handle_drag_start,
            "dragend": handle_drag_end,
            "dragenter": handle_drag_enter,
            "dragexit": handle_drag_leave,
            "dragleave": handle_drag_leave,
            "dragover": handle_drag_over,
            "drop": handle_drop,
        };

        if (event.type in handlers) {
            return handlers[event.type](event);
        }
    }

    public get_ui_state(): UIStateEnum {
        return this.ui_state;
    }

}

function WinnerView(props: {view_player: number, winner: number}) {
    if (props.winner == -1) {
        return (<></>);
    }

    if (props.winner == props.view_player) {
        return (<div id="winner">You win!</div>);
    } else {
        return (<div id="winner">You lost to player {props.winner}!</div>);
    }
}

function MessageView(props: {ui_state_manager: UIStateManager}) {
    let message = "";
    switch (props.ui_state_manager.get_ui_state()) {
        case UIStateEnum.NotMyTurn:
            message = "Player " + props.ui_state_manager.get_turn() + " is thinking...";
            break;
        case UIStateEnum.MyTurnThinking:
        case UIStateEnum.MyTurnDraggingTableCard:
            message = "Drag a table card to your board";
            break;
        case UIStateEnum.MyTurnThiefThinking:
        case UIStateEnum.MyTurnThiefDraggingCardToSteal:
            message = "🕵 Drag an opponent's card to your board to steal it 🕵";
            break;
        case UIStateEnum.MyTurnJokerPopup:
        case UIStateEnum.GameOver:
            message = "";
            break;
    }
    return <span>{message}</span>;
}

class JokerPopupView extends React.Component<{ui_state_manager: UIStateManager}, {}> {
    constructor(props: {ui_state_manager: UIStateManager}) {
        super(props);
    }

    public render() {
        let visible_class = "hidden";
        if (this.props.ui_state_manager.get_ui_state() == UIStateEnum.MyTurnJokerPopup) {
            visible_class = "";
        }
        const card_rows = [];
        for (const suit of Object.values(Suit).filter(v => typeof v == "number")) {
            const card_cols = [];
            for (let value = 1; value <= 13; value++) {
                let card: Card;
                if (value == 1) {
                    card = Card.create_normal(suit as Suit, Card.AceValue);
                } else {
                    card = Card.create_normal(suit as Suit, value);
                }
                card_cols.push(
                    <td key={card.toString()}>
                    <CardView
                        card={card}
                        ui_location={CardViewUILocationEnum.JokerPopup}
                        ui_state_manager={this.props.ui_state_manager} />
                    </td>
                );
            }
            card_rows.push(<tr key={Suit[suit]}>{card_cols}</tr>);
        }
        return (
            <div id="joker-popup-view" className={visible_class}>
                <p style={{fontSize: "48pt"}}>🤡 Joker 🤡</p>
                <p style={{fontSize: "24pt"}}>Select card to play the Joker as</p>
                <div id="joker-select-card">
                    <table>
                    <tbody>
                    {card_rows}
                    </tbody>
                    </table>
                </div>
            </div>);
    }
}

class TicTacToePokerMainView extends React.Component<
    TicTacToePokerViewPropsInterface, {rerender_count: number}> {
    private ui_state_manager: UIStateManager;

    constructor(props: TicTacToePokerViewPropsInterface) {
        super(props);
        this.state = {rerender_count: 0};
        const rerender = () => {
            this.setState({ rerender_count: this.state.rerender_count + 1 });
        };
        this.ui_state_manager = new UIStateManager(rerender, props.MP, props.view_player);
        console.log("view_player: " + this.props.view_player);
    }

    public render() {
        this.ui_state_manager.set_turn(this.props.turn);
        console.log("turn: " + this.props.turn);
        console.log("render");
        const player_views = [];
        let player = this.props.view_player;
        for (let count = 0; count < this.props.num_players; count++) {
            player_views.push(
                <PlayerView key={player}
                    board_player={player}
                    board={this.props.boards[player]}
                    score={this.props.scores[player]}
                    ui_state_manager={this.ui_state_manager} />);
            player_views.push(<div key={player.toString() + "-separator"} className="player-view-separator"></div>);
            player = (player + 1) % this.props.num_players;
        }
        return (
            <div className="main">
                <div id="message-section">
                    <MessageView ui_state_manager={this.ui_state_manager} />
                </div>
                <div className="top-section">
                    <WinnerView view_player={this.props.view_player} winner={this.props.winner} />
                    {player_views}
                    <div className="clear"></div>
                </div>
                <div className="bottom-section">
                    <div className="table-card-separator"></div>
                    <TableCardsView table_cards={this.props.table_cards}
                                    ui_state_manager={this.ui_state_manager} />
                    <JokerPopupView ui_state_manager={this.ui_state_manager} />
                </div>
          </div>);
    }
}

export default TicTacToePokerView;
