/**
 * debugger.ui.ts
 *
 * Centralized, modernized layout manager for local debug pages.
 */

declare const $: any;

import MultiplayR from '../lib/multiplayr';
import LocalClientTransport from '../lib/local.transport';
import * as messages from '../../common/messages';

interface DebuggerConfig {
    gameId: string;
    gameName: string;
    ruleName: string;
    defaultClientsCount: number;
    hasAI?: boolean;
    setupAI?: (roomId: string, container: HTMLElement) => void;
}

export class DebuggerUI {
    public static init(config: DebuggerConfig) {
        // 1. Load Outfit and Inter Google Fonts dynamically
        if (!$('link[href*="fonts.googleapis.com"]').length) {
            const fontLink = document.createElement('link');
            fontLink.rel = 'stylesheet';
            fontLink.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&family=Inter:wght@400;600&display=swap';
            document.head.appendChild(fontLink);
        }

        // 2. Set modern styling on the body element
        $('body').css({
            'background-color': '#0f172a',
            'color': '#f1f5f9',
            'font-family': "'Outfit', 'Inter', sans-serif",
            'margin': '0',
            'padding': '0',
            'min-height': '100vh',
            'overflow-x': 'hidden'
        });

        // 3. Clear existing elements from the body safely, leaving script tags intact
        $('body').children().not('script').remove();

        // 4. Retrieve state history from sessionStorage to determine player count
        const statesS = sessionStorage.getItem('debuggerGameStates');
        let initialClientsCount = config.defaultClientsCount;
        let isReconnecting = false;

        if (statesS) {
            try {
                const states = JSON.parse(statesS);
                if (states && states.length > 0) {
                    const state = states[states.length - 1];
                    const players = Object.keys(JSON.parse(state).clientsStore).length;
                    if (players > 0) {
                        initialClientsCount = players;
                        isReconnecting = true;
                    }
                }
            } catch (e) {
                console.error('Failed to restore active player count from history:', e);
            }
        }

        // 5. Construct the premium dashboard layout container
        const $appContainer = $('<div class="debugger-app"></div>');

        const $header = $(`
            <header class="debugger-header">
                <div class="header-left">
                    <span class="header-logo">⚡</span>
                    <h1 class="header-title">MultiplayR <span class="accent">Debugger</span></h1>
                    <span class="game-badge">${config.gameName}</span>
                </div>
                <div class="header-center">
                    <div class="selector-group">
                        <label for="host-res-select">Host Viewport:</label>
                        <select id="host-res-select">
                            <option value="host-tablet-L">Tablet (Landscape)</option>
                            <option value="host-tablet-P">Tablet (Portrait)</option>
                            <option value="host-mobile-P">Mobile (Portrait)</option>
                            <option value="host-mobile-L">Mobile (Landscape)</option>
                            <option value="host-flex">Flexible Width</option>
                        </select>
                    </div>
                    <div class="selector-group">
                        <label for="client-res-select">Client Viewport:</label>
                        <select id="client-res-select">
                            <option value="iphone15_P">iPhone 15/16 (Portrait)</option>
                            <option value="iphone15_L">iPhone 15/16 (Landscape)</option>
                            <option value="iphone15promax_P">iPhone 15 Pro Max (Portrait)</option>
                            <option value="iphone15promax_L">iPhone 15 Pro Max (Landscape)</option>
                            <option value="galaxyS23_P">Galaxy S23/S24 (Portrait)</option>
                            <option value="galaxyS23_L">Galaxy S23/S24 (Landscape)</option>
                            <option value="ipad_P">iPad Pro (Portrait)</option>
                            <option value="ipad_L">iPad Pro (Landscape)</option>
                        </select>
                    </div>
                </div>
                <div class="header-right">
                    <div class="mode-toggles">
                        <button id="mode-all-btn" class="toggle-btn active">All-in-One</button>
                        <button id="mode-tabs-btn" class="toggle-btn">Tab View</button>
                    </div>
                    <button id="add-client-btn" class="primary-btn">+ Add Client</button>
                </div>
            </header>
        `);

        const $mainContent = $(`
            <main class="debugger-main">
                <section class="host-section">
                    <div class="section-header">
                        <h2 class="section-title">📺 Shared Host Screen</h2>
                        <span id="room-code-badge" class="badge">Room: Connecting...</span>
                    </div>
                    <div class="host-viewport-wrapper">
                        <div id="host-container" class="host-tablet-L"></div>
                    </div>
                </section>
                <section class="clients-section">
                    <div class="section-header">
                        <h2 class="section-title">📱 Connected Devices</h2>
                        <div class="tabs-nav-wrapper" style="display: none;">
                            <div class="tabs-nav" id="clients-tabs-bar">
                                <button class="tab-link active" data-client-tab="all">All Viewports</button>
                            </div>
                        </div>
                    </div>
                    <div id="clients-grid" class="iphone15_P view-all"></div>
                </section>
            </main>
        `);

        $appContainer.append($header).append($mainContent);
        $('body').append($appContainer);

        // Core UI States
        let viewMode: 'all' | 'tabs' = 'all';
        let currentTab: string = 'all';
        let hostResClass = 'host-tablet-L';
        let clientResClass = 'iphone15_P';
        const clientsList: { index: number; connected: boolean }[] = [];
        let createdRoomId = '';

        // Selectors Action Bindings
        $('#host-res-select').on('change', (evt) => {
            const nextClass = $(evt.target).val().toString();
            $('#host-container').removeClass(hostResClass).addClass(nextClass);
            hostResClass = nextClass;
        });

        $('#client-res-select').on('change', (evt) => {
            const nextClass = $(evt.target).val().toString();
            $('#clients-grid').removeClass(clientResClass).addClass(nextClass);
            clientResClass = nextClass;
        });

        // Mode toggles
        $('#mode-all-btn').on('click', () => {
            setViewMode('all');
        });

        $('#mode-tabs-btn').on('click', () => {
            setViewMode('tabs');
        });

        function setViewMode(mode: 'all' | 'tabs') {
            viewMode = mode;
            if (mode === 'all') {
                $('#mode-all-btn').addClass('active');
                $('#mode-tabs-btn').removeClass('active');
                $('.tabs-nav-wrapper').hide();
                $('#clients-grid').addClass('view-all').removeClass('view-tabs');
                $('.client-card').show();
            } else {
                $('#mode-tabs-btn').addClass('active');
                $('#mode-all-btn').removeClass('active');
                $('.tabs-nav-wrapper').show();
                $('#clients-grid').addClass('view-tabs').removeClass('view-all');
                renderTabsBar();
                showActiveTab();
            }
        }

        function renderTabsBar() {
            const $bar = $('#clients-tabs-bar');
            $bar.empty();

            const allBtn = $(`<button class="tab-link ${currentTab === 'all' ? 'active' : ''}" data-client-tab="all">All Viewports</button>`);
            allBtn.on('click', () => selectTab('all'));
            $bar.append(allBtn);

            clientsList.forEach((c) => {
                const statusClass = c.connected ? 'status-online' : 'status-offline';
                const tabBtn = $(`
                    <button class="tab-link ${currentTab === 'client' + c.index ? 'active' : ''}" data-client-tab="client${c.index}">
                        <span class="status-dot ${statusClass}"></span>
                        Client ${c.index + 1}
                    </button>
                `);
                tabBtn.on('click', () => selectTab('client' + c.index));
                $bar.append(tabBtn);
            });
        }

        function selectTab(tabId: string) {
            currentTab = tabId;
            $('#clients-tabs-bar .tab-link').removeClass('active');
            $(`#clients-tabs-bar .tab-link[data-client-tab="${tabId}"]`).addClass('active');
            showActiveTab();
        }

        function showActiveTab() {
            if (viewMode === 'tabs') {
                if (currentTab === 'all') {
                    $('.client-card').show();
                } else {
                    $('.client-card').hide();
                    $('#' + currentTab).show();
                }
            }
        }

        // Add dynamic client cards
        function addClientCard(index: number, roomId: string) {
            const clientId = 'client' + index;
            const $card = $(`
                <div id="${clientId}" class="client-card">
                    <div class="client-card-header">
                        <span class="client-title">📱 Device #${index + 1}</span>
                        <span class="client-status status-badge-disconnected" id="${clientId}-status">Offline</span>
                    </div>
                    <div id="${clientId}-container" class="client-container">
                        <div class="client-join-overlay" id="${clientId}-join-overlay">
                            <div class="overlay-actions"></div>
                        </div>
                    </div>
                </div>
            `);

            $('#clients-grid').append($card);
            clientsList.push({ index: index, connected: false });

            const container = document.getElementById(clientId + '-container');
            const $actions = $card.find('.overlay-actions');

            const $joinBtn = $(`<button class="btn join-btn">Connect Player 🚪</button>`);
            $joinBtn.on('click', () => {
                const transport = new LocalClientTransport();
                MultiplayR.Join(roomId, transport, container);
                $card.find(`#${clientId}-join-overlay`).fadeOut(300);
                $card.find(`#${clientId}-status`).text('Connected').removeClass('status-badge-disconnected').addClass('status-badge-connected');

                // Update internal status
                const clientObj = clientsList.find(c => c.index === index);
                if (clientObj) {
                    clientObj.connected = true;
                }
                if (viewMode === 'tabs') {
                    renderTabsBar();
                }
            });
            $actions.append($joinBtn);

            // Add AI support if configured
            if (config.hasAI && config.setupAI) {
                const $aiBtn = $(`<button class="btn ai-btn">Connect AI 🤖</button>`);
                $aiBtn.on('click', () => {
                    config.setupAI(roomId, container);
                    $card.find(`#${clientId}-join-overlay`).fadeOut(300);
                    $card.find(`#${clientId}-status`).text('AI Bot').removeClass('status-badge-disconnected').addClass('status-badge-ai');

                    const clientObj = clientsList.find(c => c.index === index);
                    if (clientObj) {
                        clientObj.connected = true;
                    }
                    if (viewMode === 'tabs') {
                        renderTabsBar();
                    }
                });
                $actions.append($aiBtn);
            }

            if (viewMode === 'tabs') {
                renderTabsBar();
                showActiveTab();
            }
        }

        // Header Action: Add Client
        $('#add-client-btn').on('click', () => {
            if (createdRoomId) {
                const nextIndex = clientsList.length;
                addClientCard(nextIndex, createdRoomId);
                if (viewMode === 'tabs') {
                    selectTab('client' + nextIndex);
                }
            }
        });

        // host reconnection parsing
        let hostId = '';
        if (statesS) {
            try {
                const states = JSON.parse(statesS);
                if (states && states.length > 0) {
                    const state = states[states.length - 1];
                    hostId = JSON.parse(state).hostId || '';
                }
            } catch (e) {
                // ignore
            }
        }

        const transport = new LocalClientTransport(
            (data) => {
                messages.checkReturnMessage(data, 'clientId');
            },
            hostId
        );

        MultiplayR.Host(
            config.ruleName,
            transport,
            document.getElementById('host-container'),
            (res) => {
                messages.checkReturnMessage(res, 'roomId');
                createdRoomId = res.message;
                $('#room-code-badge').text('Room: ' + createdRoomId).addClass('ready');

                // Build default number of client cards
                for (let i = 0; i < initialClientsCount; i++) {
                    addClientCard(i, createdRoomId);
                }

                // Automatically trigger connection click on state reconnection
                if (statesS && isReconnecting) {
                    setTimeout(() => {
                        for (let i = 0; i < initialClientsCount; i++) {
                            const joinBtn = $(`#client${i}-container .join-btn`);
                            if (joinBtn.length) {
                                joinBtn.click();
                            }
                        }
                    }, 100);
                }
            }
        );
    }
}
