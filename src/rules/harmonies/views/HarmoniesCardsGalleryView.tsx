/**
 * HarmoniesCardsGalleryView.tsx
 *
 * Full compendium and visual reference of all 35 Animal Cards in Harmonies.
 * Displays cards across all 5 habitat families (Water, Field, Mountain, Building, Tree),
 * with real-time habitat filtering, name search, sorting, pattern previews, and full
 * inspection modal.
 */

import * as React from 'react';
import { AnimalCardSpec, ANIMAL_CARD_SPECS, HabitatType, getHarmoniesCardDefinition, ALL_HARMONIES_ICONS } from '../HarmoniesAssets';
import { HarmoniesGameStateData, PlayerState, findPatternMatches } from '../HarmoniesGameState';
import { PlayingCard } from '../../../client/lib/card-renderer/PlayingCard';
import { HabitatPatternPreview, HarmoniesCardDetailModal } from './HarmoniesViews';

export interface HarmoniesCardsGalleryViewProps {
    gameState?: HarmoniesGameStateData | null;
    myPlayer?: PlayerState | null;
    isMyTurn?: boolean;
    onTakeCard?: (cardId: string) => void;
    onSelectCardForCube?: (card: AnimalCardSpec) => void;
}

type HabitatFilter = 'all' | HabitatType;
type SortOption = 'id' | 'name' | 'points' | 'cubes';

export const HarmoniesCardsGalleryView: React.FC<HarmoniesCardsGalleryViewProps> = ({
    gameState,
    myPlayer,
    isMyTurn = false,
    onTakeCard,
    onSelectCardForCube
}) => {
    const [habitatFilter, setHabitatFilter] = React.useState<HabitatFilter>('all');
    const [searchQuery, setSearchQuery] = React.useState<string>('');
    const [sortBy, setSortBy] = React.useState<SortOption>('id');
    const [inspectedCard, setInspectedCard] = React.useState<AnimalCardSpec | null>(null);

    // Active card locations in game state (if in-game)
    const displayCardIds = React.useMemo(() => {
        if (!gameState || !gameState.animalDisplay) return new Set<string>();
        return new Set(gameState.animalDisplay.map(c => c.id));
    }, [gameState]);

    const handCardIds = React.useMemo(() => {
        if (!myPlayer || !myPlayer.hand) return new Set<string>();
        return new Set(myPlayer.hand.map(h => h.card.id));
    }, [myPlayer]);

    const completedCardIds = React.useMemo(() => {
        if (!myPlayer || !myPlayer.completed) return new Set<string>();
        return new Set(myPlayer.completed.map(c => c.id));
    }, [myPlayer]);

    // Filter cards
    const filteredCards = React.useMemo(() => {
        let list = [...ANIMAL_CARD_SPECS];

        if (habitatFilter !== 'all') {
            list = list.filter(c => c.habitat === habitatFilter);
        }

        const q = searchQuery.trim().toLowerCase();
        if (q) {
            list = list.filter(c =>
                c.animalName.toLowerCase().includes(q) ||
                c.id.toLowerCase().includes(q) ||
                c.habitat.toLowerCase().includes(q)
            );
        }

        list.sort((a, b) => {
            if (sortBy === 'name') {
                return a.animalName.localeCompare(b.animalName);
            }
            if (sortBy === 'points') {
                const maxA = a.pointTrack[a.pointTrack.length - 1] || 0;
                const maxB = b.pointTrack[b.pointTrack.length - 1] || 0;
                return maxB - maxA;
            }
            if (sortBy === 'cubes') {
                return a.cubeCount - b.cubeCount;
            }
            // Default: by ID order (W1..W7, Y1..Y7, M1..M7, B1..B7, T1..T7)
            const prefixOrder: Record<string, number> = { W: 1, Y: 2, M: 3, B: 4, T: 5 };
            const pA = prefixOrder[a.id[0]] || 9;
            const pB = prefixOrder[b.id[0]] || 9;
            if (pA !== pB) return pA - pB;
            return parseInt(a.id.slice(1), 10) - parseInt(b.id.slice(1), 10);
        });

        return list;
    }, [habitatFilter, searchQuery, sortBy]);

    // Habitat counts for badges
    const habitatCounts = React.useMemo(() => {
        const counts: Record<HabitatFilter, number> = {
            all: ANIMAL_CARD_SPECS.length,
            water: 0,
            field: 0,
            mountain: 0,
            building: 0,
            tree: 0
        };
        for (const c of ANIMAL_CARD_SPECS) {
            if (counts[c.habitat] !== undefined) {
                counts[c.habitat]++;
            }
        }
        return counts;
    }, []);

    // Details for modal if inspecting a card
    const modalHeldInfo = React.useMemo(() => {
        if (!inspectedCard || !myPlayer) return null;
        return myPlayer.hand.find(h => h.card.id === inspectedCard.id) || null;
    }, [inspectedCard, myPlayer]);

    const canTakeInspected = React.useMemo(() => {
        if (!inspectedCard || !gameState || !myPlayer || !isMyTurn) return false;
        return (
            !myPlayer.hasTakenCardThisTurn &&
            myPlayer.hand.length < 4 &&
            displayCardIds.has(inspectedCard.id)
        );
    }, [inspectedCard, gameState, myPlayer, isMyTurn, displayCardIds]);

    const modalMatchesCount = React.useMemo(() => {
        if (!inspectedCard || !myPlayer) return 0;
        return findPatternMatches(myPlayer.board, inspectedCard.pattern).length;
    }, [inspectedCard, myPlayer]);

    return (
        <div className="harmonies-cards-gallery-container">
            {/* Header Section */}
            <div className="gallery-header">
                <div className="gallery-title-row">
                    <h2>Animal Cards Compendium</h2>
                    <span className="gallery-count-badge">
                        Showing {filteredCards.length} of {ANIMAL_CARD_SPECS.length} Cards
                    </span>
                </div>
                <p className="gallery-subtitle">
                    Full catalog of 35 animal cards across all 5 habitat families. Recreate the required terrain patterns on your landscape board to place animal cubes and score points.
                </p>
            </div>

            {/* Filter & Search Bar */}
            <div className="gallery-controls-card">
                {/* Habitat Filter Pills */}
                <div className="habitat-pills-row">
                    <button
                        type="button"
                        className={`habitat-pill-btn ${habitatFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setHabitatFilter('all')}
                    >
                        <span>All</span>
                        <span className="pill-count">{habitatCounts.all}</span>
                    </button>
                    <button
                        type="button"
                        className={`habitat-pill-btn habitat-water ${habitatFilter === 'water' ? 'active' : ''}`}
                        onClick={() => setHabitatFilter('water')}
                    >
                        <span className="habitat-dot dot-water" />
                        <span>Water</span>
                        <span className="pill-count">{habitatCounts.water}</span>
                    </button>
                    <button
                        type="button"
                        className={`habitat-pill-btn habitat-field ${habitatFilter === 'field' ? 'active' : ''}`}
                        onClick={() => setHabitatFilter('field')}
                    >
                        <span className="habitat-dot dot-field" />
                        <span>Field</span>
                        <span className="pill-count">{habitatCounts.field}</span>
                    </button>
                    <button
                        type="button"
                        className={`habitat-pill-btn habitat-mountain ${habitatFilter === 'mountain' ? 'active' : ''}`}
                        onClick={() => setHabitatFilter('mountain')}
                    >
                        <span className="habitat-dot dot-mountain" />
                        <span>Mountain</span>
                        <span className="pill-count">{habitatCounts.mountain}</span>
                    </button>
                    <button
                        type="button"
                        className={`habitat-pill-btn habitat-building ${habitatFilter === 'building' ? 'active' : ''}`}
                        onClick={() => setHabitatFilter('building')}
                    >
                        <span className="habitat-dot dot-building" />
                        <span>Building</span>
                        <span className="pill-count">{habitatCounts.building}</span>
                    </button>
                    <button
                        type="button"
                        className={`habitat-pill-btn habitat-tree ${habitatFilter === 'tree' ? 'active' : ''}`}
                        onClick={() => setHabitatFilter('tree')}
                    >
                        <span className="habitat-dot dot-tree" />
                        <span>Tree</span>
                        <span className="pill-count">{habitatCounts.tree}</span>
                    </button>
                </div>

                {/* Search & Sort Controls */}
                <div className="gallery-search-sort-row">
                    <div className="search-input-wrap">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search by animal or card ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            aria-label="Search animal cards"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                className="search-clear-btn"
                                onClick={() => setSearchQuery('')}
                                aria-label="Clear search"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    <div className="sort-select-wrap">
                        <label htmlFor="gallery-sort-select">Sort by:</label>
                        <select
                            id="gallery-sort-select"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as SortOption)}
                        >
                            <option value="id">Card ID (Family order)</option>
                            <option value="name">Animal Name (A–Z)</option>
                            <option value="points">Max Points (High to Low)</option>
                            <option value="cubes">Cubes Required (2–4)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Cards Grid */}
            {filteredCards.length === 0 ? (
                <div className="gallery-empty-state">
                    <p>No animal cards match your search criteria.</p>
                    <button
                        type="button"
                        className="gallery-reset-btn"
                        onClick={() => {
                            setHabitatFilter('all');
                            setSearchQuery('');
                        }}
                    >
                        Reset Filters
                    </button>
                </div>
            ) : (
                <div className="gallery-cards-grid">
                    {filteredCards.map((card) => {
                        const maxPts = card.pointTrack[card.pointTrack.length - 1] || 0;
                        const inDisplay = displayCardIds.has(card.id);
                        const inHand = handCardIds.has(card.id);
                        const isCompleted = completedCardIds.has(card.id);
                        const cardDef = getHarmoniesCardDefinition(card, 0);

                        return (
                            <div
                                key={card.id}
                                className={`gallery-card-tile habitat-${card.habitat} ${inDisplay ? 'is-in-display' : ''} ${inHand ? 'is-in-hand' : ''} ${isCompleted ? 'is-completed' : ''}`}
                                onClick={() => setInspectedCard(card)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setInspectedCard(card);
                                    }
                                }}
                            >
                                {/* Status Chip Overlay */}
                                <div className="card-tile-top-chips">
                                    <span className="card-id-chip">#{card.id}</span>
                                    {inDisplay && <span className="game-status-chip display-chip">In Market</span>}
                                    {inHand && <span className="game-status-chip hand-chip">In Hand</span>}
                                    {isCompleted && <span className="game-status-chip done-chip">Completed</span>}
                                </div>

                                <div className="card-tile-content">
                                    {/* Left: PlayingCard */}
                                    <div className="tile-card-art">
                                        <PlayingCard
                                            card={cardDef}
                                            width="112px"
                                            hoverable={false}
                                            customIcons={ALL_HARMONIES_ICONS}
                                        />
                                    </div>

                                    {/* Right: Info, Pattern & Points */}
                                    <div className="tile-card-info">
                                        <div className="info-title-group">
                                            <h4>{card.animalName}</h4>
                                            <span className={`harmonies-habitat-badge habitat-${card.habitat}`}>
                                                {card.habitat.toUpperCase()}
                                            </span>
                                        </div>

                                        <div className="info-stats-row">
                                            <span className="info-stat-pill cube-pill">
                                                <strong>{card.cubeCount}</strong> Cubes
                                            </span>
                                            <span className="info-stat-pill pts-pill">
                                                Up to <strong>{maxPts}</strong> pts
                                            </span>
                                        </div>

                                        {/* Point ladder quick summary */}
                                        <div className="tile-point-steps">
                                            {card.pointTrack.slice(1).map((pts, i) => (
                                                <span key={i} className="point-step-chip">
                                                    {pts}p
                                                </span>
                                            ))}
                                        </div>

                                        {/* Mini Pattern preview */}
                                        <div className="tile-pattern-preview">
                                            <div className="pattern-label">Terrain Pattern:</div>
                                            <div className="pattern-wrap">
                                                <HabitatPatternPreview pattern={card.pattern} width={90} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="tile-footer-hint">
                                    <span>Click for full card details & pattern breakdown</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Inspect Modal */}
            {inspectedCard && (
                <HarmoniesCardDetailModal
                    card={inspectedCard}
                    heldInfo={modalHeldInfo}
                    isMyTurn={isMyTurn}
                    canTake={canTakeInspected}
                    matchesCount={modalMatchesCount}
                    onClose={() => setInspectedCard(null)}
                    onTake={onTakeCard && canTakeInspected ? () => {
                        onTakeCard(inspectedCard.id);
                        setInspectedCard(null);
                    } : undefined}
                    onPlaceCube={onSelectCardForCube && modalHeldInfo && modalHeldInfo.cubesLeft > 0 && modalMatchesCount > 0 ? () => {
                        onSelectCardForCube(inspectedCard);
                        setInspectedCard(null);
                    } : undefined}
                />
            )}
        </div>
    );
};
