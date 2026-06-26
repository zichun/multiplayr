/**
 * cards.sandbox.tsx
 * High-fidelity interactive designer dashboard for playing cards and geometric icons.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { PlayingCard } from '../lib/card-renderer/PlayingCard';
import { ExpressiveIcon } from '../lib/card-renderer/IconEngine';
import { CardDefinition, Palette, IconObject, IconLayer, PrimitiveShape, BooleanOperation, IconRef, BezierPoint } from '../lib/card-renderer/types';
import { PALETTES, PRESET_ICONS, PRESET_CARDS } from '../lib/card-renderer/presets';

// ==========================================
// Styling for Sandbox Workspace
// ==========================================
const SANDBOX_CSS = `
.sandbox-workspace {
    display: grid;
    grid-template-columns: 260px 1fr 440px;
    height: 100vh;
    width: 100vw;
    background-color: #0c0f17;
    color: #f8fafc;
    font-family: 'Outfit', sans-serif;
    overflow: hidden;
}

/* Sidebar Styles */
.sandbox-sidebar {
    background-color: #121723;
    border-right: 1px solid #1e293b;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    padding: 1.2rem;
}

.sidebar-title {
    font-size: 1.1rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #38bdf8;
    margin-bottom: 1.2rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.sidebar-section {
    margin-bottom: 2rem;
}

.sidebar-section-title {
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #94a3b8;
    margin-bottom: 0.8rem;
}

/* Card Preset Item */
.preset-item {
    background-color: #1e293b;
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 0.8rem;
    margin-bottom: 0.6rem;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.preset-item:hover {
    background-color: #334155;
    border-color: #475569;
}

.preset-item.active {
    background-color: #0f172a;
    border-color: #38bdf8;
    box-shadow: 0 0 10px rgba(56, 189, 248, 0.15);
}

.preset-item-info {
    display: flex;
    flex-direction: column;
}

.preset-item-name {
    font-weight: 600;
    font-size: 0.9rem;
}

.preset-item-meta {
    font-size: 0.75rem;
    color: #94a3b8;
    margin-top: 0.2rem;
}

/* Palette Swatch */
.palette-swatch-list {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
}

.palette-swatch {
    background-color: #1e293b;
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 0.6rem;
    cursor: pointer;
    transition: all 0.2s ease;
}

.palette-swatch:hover {
    background-color: #334155;
}

.palette-swatch.active {
    border-color: #38bdf8;
    background-color: #0f172a;
}

.palette-swatch-header {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    font-weight: 600;
    margin-bottom: 0.4rem;
}

.palette-swatch-colors {
    display: flex;
    height: 14px;
    border-radius: 4px;
    overflow: hidden;
}

.palette-color-bar {
    flex: 1;
}

/* Center Canvas Panel */
.sandbox-canvas-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    position: relative;
    background-color: #090b11;
    background-image: radial-gradient(#1e293b 1px, transparent 1px);
    background-size: 24px 24px;
}

.canvas-header {
    background-color: rgba(18, 23, 35, 0.8);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid #1e293b;
    padding: 0.8rem 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 10;
}

.canvas-title {
    font-size: 1.1rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 0.6rem;
}

.canvas-badge {
    background-color: #38bdf8;
    color: #0c0f17;
    font-size: 0.7rem;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
}

.canvas-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.toggle-button-group {
    display: flex;
    background-color: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 6px;
    padding: 2px;
}

.toggle-btn {
    background: none;
    border: none;
    color: #94a3b8;
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
}

.toggle-btn.active {
    background-color: #38bdf8;
    color: #0c0f17;
}

.canvas-body {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: auto;
    padding: 2rem;
    position: relative;
}

/* Right Editor Panel */
.sandbox-editor-panel {
    background-color: #121723;
    border-left: 1px solid #1e293b;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
}

.editor-tabs {
    display: flex;
    background-color: #0f172a;
    border-bottom: 1px solid #1e293b;
}

.editor-tab {
    flex: 1;
    background: none;
    border: none;
    color: #94a3b8;
    padding: 1rem;
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
}

.editor-tab:hover {
    color: #f8fafc;
    background-color: rgba(255, 255, 255, 0.02);
}

.editor-tab.active {
    color: #38bdf8;
    border-bottom-color: #38bdf8;
    background-color: #121723;
}

.editor-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.2rem;
}

/* Form Controls */
.control-group {
    margin-bottom: 1.2rem;
    background-color: #1e293b;
    padding: 0.8rem;
    border-radius: 8px;
    border: 1px solid #334155;
}

.control-label {
    display: block;
    font-size: 0.8rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.5rem;
}

.input-text {
    width: 100%;
    background-color: #0f172a;
    border: 1px solid #334155;
    border-radius: 6px;
    color: #f8fafc;
    padding: 0.5rem 0.8rem;
    font-family: inherit;
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.2s;
}

.input-text:focus {
    border-color: #38bdf8;
}

.flex-row {
    display: flex;
    gap: 0.6rem;
}

.flex-row > * {
    flex: 1;
}

/* Slider Style */
.slider-container {
    display: flex;
    align-items: center;
    gap: 0.8rem;
}

.input-range {
    flex: 1;
    accent-color: #38bdf8;
}

.slider-value {
    font-family: monospace;
    font-size: 0.85rem;
    width: 40px;
    text-align: right;
}

/* Layer Card in Icon Builder */
.layer-card {
    background-color: #0f172a;
    border: 1px solid #334155;
    border-radius: 6px;
    padding: 0.6rem;
    margin-bottom: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
}

.layer-card.active {
    border-color: #38bdf8;
    box-shadow: 0 0 8px rgba(56, 189, 248, 0.1);
}

.layer-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.85rem;
    font-weight: 600;
}

.layer-actions {
    display: flex;
    gap: 0.3rem;
}

.icon-btn {
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    font-size: 0.85rem;
    padding: 2px 4px;
    border-radius: 4px;
}

.icon-btn:hover {
    color: #f8fafc;
    background-color: #1e293b;
}

.icon-btn.danger:hover {
    color: #ef4444;
}

/* Add Layer Pop */
.add-layer-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 1rem;
    background-color: #0f172a;
    padding: 0.6rem;
    border-radius: 6px;
    border: 1px dashed #334155;
}

.badge-btn {
    background-color: #1e293b;
    border: 1px solid #334155;
    color: #f8fafc;
    font-size: 0.75rem;
    padding: 3px 6px;
    border-radius: 4px;
    cursor: pointer;
}

.badge-btn:hover {
    background-color: #38bdf8;
    color: #0c0f17;
}

.btn-primary {
    background-color: #38bdf8;
    color: #0c0f17;
    border: none;
    font-family: inherit;
    font-weight: 700;
    padding: 0.6rem 1.2rem;
    border-radius: 6px;
    cursor: pointer;
    width: 100%;
    margin-top: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.btn-primary:hover {
    background-color: #7dd3fc;
}

/* Exploded Wireframe Overlay Visual */
.exploded-container-view {
    position: relative;
    padding: 30px;
    border-radius: 20px;
    background: rgba(12, 15, 23, 0.8);
    border: 1px solid #1e293b;
}

.exploded-label {
    position: absolute;
    top: -22px;
    left: 20px;
    font-size: 0.85rem;
    font-weight: 800;
    color: #ff007f;
    background: #0c0f17;
    padding: 2px 8px;
    border: 1px solid #ff007f;
    border-radius: 4px;
}

.color-picker-input {
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
}

/* Documentation panel style */
.api-doc-box {
    background-color: #0d121f;
    border: 1px solid #38bdf8;
    border-radius: 8px;
    padding: 0.8rem;
    margin-top: 1rem;
    font-size: 0.8rem;
}

.api-doc-title {
    font-weight: 800;
    color: #38bdf8;
    margin-bottom: 0.4rem;
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    gap: 0.3rem;
}
`;

const SandboxApp: React.FC = () => {
    // ------------------------------------------
    // State Declarations
    // ------------------------------------------
    const [cardPresets, setCardPresets] = useState<CardDefinition[]>(PRESET_CARDS);
    const [activeCard, setActiveCard] = useState<CardDefinition>({ ...PRESET_CARDS[0] });
    const [customIcons, setCustomIcons] = useState<Record<string, IconObject>>({});
    const [customPalettes, setCustomPalettes] = useState<Record<string, Palette>>({});
    const [activePalette, setActivePalette] = useState<Palette>(PALETTES.midCentury);
    const [isFlipped, setIsFlipped] = useState<boolean>(false);

    const [viewMode, setViewMode] = useState<'web' | 'print'>('print');
    const [showWireframe, setShowWireframe] = useState<boolean>(false);
    const [scale, setScale] = useState<number>(1.6); // Zoom multiplier
    const [activeTab, setActiveTab] = useState<'card' | 'icon' | 'palette'>('card');

    // Icon Designer states
    const [savedIcons, setSavedIcons] = useState<Record<string, IconObject>>({ ...PRESET_ICONS });
    const [editingIcon, setEditingIcon] = useState<IconObject>({
        id: 'custom_icon_1',
        name: 'Custom Icon',
        layers: [
            {
                id: 'base_layer',
                type: 'circle',
                x: 50,
                y: 50,
                scaleX: 1.2,
                scaleY: 1.2,
                fill: 'primary',
                opacity: 1
            },
            {
                id: 'inner_layer',
                type: 'rectangle',
                x: 50,
                y: 50,
                scaleX: 0.8,
                scaleY: 0.8,
                rotation: 45,
                fill: 'background',
                opacity: 1
            }
        ]
    });
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>('base_layer');

    // Palette Builder states (with new colors)
    const [paletteForm, setPaletteForm] = useState<Palette>({
        id: 'my_custom_palette',
        name: 'My Custom Palette',
        background: '#ffffff',
        border: '#1e293b',
        primary: '#f43f5e',
        secondary: '#fbbf24',
        accent: '#06b6d4',
        charcoal: '#1e293b',
        text: '#1e293b',
        panelBg: '#f1f5f9',
        tertiary: '#8b5cf6',
        success: '#10b981',
        danger: '#ef4444'
    });

    // Sync active palette changes to the card layout
    useEffect(() => {
        setActiveCard(prev => ({
            ...prev,
            palette: activePalette
        }));
    }, [activePalette]);

    // Handle Preset Selection
    const handleSelectPreset = (preset: CardDefinition) => {
        setActiveCard({ ...preset });
        setIsFlipped(false);
        // Resolve the palette of the preset
        if (typeof preset.palette === 'string') {
            setActivePalette(PALETTES[preset.palette] || PALETTES.midCentury);
        } else {
            setActivePalette(preset.palette);
        }
    };

    // ------------------------------------------
    // Card Editor Handlers
    // ------------------------------------------
    const updateCardMeta = (field: string, value: string | number) => {
        setActiveCard(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const updateHeader = (field: string, value: string) => {
        setActiveCard(prev => ({
            ...prev,
            header: {
                ...prev.header,
                [field]: value
            }
        }));
    };

    const updateMainArt = (field: string, value: any) => {
        setActiveCard(prev => ({
            ...prev,
            mainArt: {
                ...prev.mainArt,
                [field]: value
            }
        }));
    };

    const updateFooter = (field: string, value: string) => {
        setActiveCard(prev => ({
            ...prev,
            footer: {
                ...prev.footer,
                [field]: value
            }
        }));
    };

    const updateDataArea = (field: string, value: string) => {
        setActiveCard(prev => ({
            ...prev,
            data: {
                rows: prev.data?.rows || [],
                [field]: value
            }
        }));
    };

    const updateOverlay = (field: string, value: any) => {
        setActiveCard(prev => ({
            ...prev,
            overlay: prev.overlay ? {
                ...prev.overlay,
                [field]: value
            } : {
                position: 'top-left',
                [field]: value
            } as any
        }));
    };

    const handleAddDataRow = () => {
        setActiveCard(prev => {
            const rows = prev.data?.rows ? [...prev.data.rows] : [];
            rows.push({
                label: 'New Stat',
                value: 'Value'
            });
            return {
                ...prev,
                data: {
                    ...prev.data,
                    rows
                }
            };
        });
    };

    const handleAddCostRow = () => {
        setActiveCard(prev => {
            const rows = prev.data?.rows ? [...prev.data.rows] : [];
            rows.push({
                iconsList: [
                    { iconId: 'ruby', value: '2' },
                    { iconId: 'pearl', value: '1' }
                ],
                iconsListBg: 'panelBg',
                iconsListAlign: 'center',
                iconsListIconSize: 1.4,
                iconsListGap: 0.8
            });
            return {
                ...prev,
                data: {
                    ...prev.data,
                    rows
                }
            };
        });
    };

    const handleUpdateDataRow = (index: number, field: string, value: any) => {
        setActiveCard(prev => {
            if (!prev.data?.rows) return prev;
            const rows = [...prev.data.rows];
            rows[index] = {
                ...rows[index],
                [field]: value
            };
            return {
                ...prev,
                data: {
                    ...prev.data,
                    rows
                }
            };
        });
    };

    const handleDeleteDataRow = (index: number) => {
        setActiveCard(prev => {
            if (!prev.data?.rows) return prev;
            const rows = prev.data.rows.filter((_, i) => i !== index);
            return {
                ...prev,
                data: {
                    ...prev.data,
                    rows
                }
            };
        });
    };

    // ------------------------------------------
    // Icon Builder Handlers
    // ------------------------------------------
    const activeLayerIndex = useMemo(() => {
        return editingIcon.layers.findIndex(l => l.id === selectedLayerId);
    }, [editingIcon, selectedLayerId]);

    const activeLayer = useMemo(() => {
        return editingIcon.layers[activeLayerIndex];
    }, [editingIcon, activeLayerIndex]);

    const updateActiveLayer = (updates: Partial<PrimitiveShape> & Partial<BooleanOperation> & Partial<IconRef>) => {
        if (activeLayerIndex === -1) return;
        setEditingIcon(prev => {
            const layers = [...prev.layers];
            layers[activeLayerIndex] = {
                ...layers[activeLayerIndex],
                ...updates
            } as any;
            return { ...prev, layers };
        });
    };

    const handleAddLayer = (type: string) => {
        const id = `layer_${Date.now()}`;
        let newLayer: IconLayer;

        if (type === 'boolean') {
            newLayer = {
                id,
                type: 'boolean',
                op: 'subtract',
                baseId: editingIcon.layers[0]?.id || '',
                operandId: editingIcon.layers[1]?.id || ''
            };
        } else if (type === 'ref') {
            newLayer = {
                id,
                type: 'ref',
                iconId: Object.keys(savedIcons)[0] || 'waterDrop',
                x: 50,
                y: 50,
                scale: 0.5,
                rotation: 0
            };
        } else {
            newLayer = {
                id,
                type: type as any,
                x: 50,
                y: 50,
                scaleX: 1,
                scaleY: 1,
                rotation: 0,
                opacity: 1,
                fill: 'primary',
                stroke: 'none',
                strokeWidth: 0
            };
        }

        setEditingIcon(prev => ({
            ...prev,
            layers: [...prev.layers, newLayer]
        }));
        setSelectedLayerId(id);
    };

    const handleDeleteLayer = (id: string) => {
        setEditingIcon(prev => {
            const layers = prev.layers.filter(l => l.id !== id);
            return { ...prev, layers };
        });
        if (selectedLayerId === id) {
            setSelectedLayerId(editingIcon.layers[0]?.id || null);
        }
    };

    const handleMoveLayer = (index: number, direction: 'up' | 'down') => {
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= editingIcon.layers.length) return;

        setEditingIcon(prev => {
            const layers = [...prev.layers];
            const temp = layers[index];
            layers[index] = layers[targetIndex];
            layers[targetIndex] = temp;
            return { ...prev, layers };
        });
    };

    const handleSaveIcon = () => {
        setSavedIcons(prev => ({
            ...prev,
            [editingIcon.id]: { ...editingIcon }
        }));
        // Notify or auto-inject into card main art
        setActiveCard(prev => ({
            ...prev,
            mainArt: {
                ...prev.mainArt,
                iconId: editingIcon.id
            }
        }));
        alert(`Icon "${editingIcon.name}" compiled and injected into Card Art!`);
    };

    // ------------------------------------------
    // Palette Builder Handlers
    // ------------------------------------------
    const handlePaletteFormChange = (key: keyof Palette, value: string) => {
        setPaletteForm(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleSavePalette = () => {
        const newPalette = { ...paletteForm };
        setCustomPalettes(prev => ({
            ...prev,
            [newPalette.id]: newPalette
        }));
        setActivePalette(newPalette);
    };

    // Card Export JSON string
    const cardExportJSON = useMemo(() => {
        return JSON.stringify(activeCard, null, 2);
    }, [activeCard]);

    return (
        <div className="sandbox-workspace">
            {/* Global styling injection */}
            <style>{SANDBOX_CSS}</style>

            {/* ==========================================
             * 1. LEFT SIDEBAR: Presets & Design Schemes
             * ========================================== */}
            <div className="sandbox-sidebar">
                <div className="sidebar-title">
                    <span>⚡</span> Card Designer
                </div>

                <div className="sidebar-section">
                    <div className="sidebar-section-title">Geometric Card Presets</div>
                    {cardPresets.map(preset => (
                        <div
                            key={preset.id}
                            className={`preset-item ${activeCard.id === preset.id ? 'active' : ''}`}
                            onClick={() => handleSelectPreset(preset)}
                        >
                            <div className="preset-item-info">
                                <span className="preset-item-name">{preset.name}</span>
                                <span className="preset-item-meta">
                                    {preset.widthMm}x{preset.heightMm}mm
                                </span>
                            </div>
                            <span style={{ fontSize: '1.1em' }}>🃏</span>
                        </div>
                    ))}
                </div>

                <div className="sidebar-section">
                    <div className="sidebar-section-title">Active Color Palette</div>
                    <div className="palette-swatch-list">
                        {/* Preset Palettes */}
                        {Object.values(PALETTES).map(pal => (
                            <div
                                key={pal.id}
                                className={`palette-swatch ${activePalette.id === pal.id ? 'active' : ''}`}
                                onClick={() => setActivePalette(pal)}
                            >
                                <div className="palette-swatch-header">
                                    <span>{pal.name}</span>
                                    {pal.id === activePalette.id && <span style={{ color: '#38bdf8' }}>✓</span>}
                                </div>
                                <div className="palette-swatch-colors" style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)' }}>
                                    <div className="palette-color-bar" style={{ backgroundColor: pal.background }} title="background" />
                                    <div className="palette-color-bar" style={{ backgroundColor: pal.primary }} title="primary" />
                                    <div className="palette-color-bar" style={{ backgroundColor: pal.secondary }} title="secondary" />
                                    <div className="palette-color-bar" style={{ backgroundColor: pal.accent }} title="accent" />
                                    <div className="palette-color-bar" style={{ backgroundColor: pal.tertiary }} title="tertiary" />
                                    <div className="palette-color-bar" style={{ backgroundColor: pal.success }} title="success" />
                                    <div className="palette-color-bar" style={{ backgroundColor: pal.danger }} title="danger" />
                                    <div className="palette-color-bar" style={{ backgroundColor: pal.charcoal }} title="charcoal" />
                                </div>
                            </div>
                        ))}
                        {/* Custom Palettes */}
                        {Object.values(customPalettes).map(pal => (
                            <div
                                key={pal.id}
                                className={`palette-swatch ${activePalette.id === pal.id ? 'active' : ''}`}
                                onClick={() => setActivePalette(pal)}
                            >
                                <div className="palette-swatch-header">
                                    <span>{pal.name} (Custom)</span>
                                    {pal.id === activePalette.id && <span style={{ color: '#38bdf8' }}>✓</span>}
                                </div>
                                <div className="palette-swatch-colors" style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)' }}>
                                    <div className="palette-color-bar" style={{ backgroundColor: pal.background }} />
                                    <div className="palette-color-bar" style={{ backgroundColor: pal.primary }} />
                                    <div className="palette-color-bar" style={{ backgroundColor: pal.secondary }} />
                                    <div className="palette-color-bar" style={{ backgroundColor: pal.accent }} />
                                    <div className="palette-color-bar" style={{ backgroundColor: pal.tertiary }} />
                                    <div className="palette-color-bar" style={{ backgroundColor: pal.success }} />
                                    <div className="palette-color-bar" style={{ backgroundColor: pal.danger }} />
                                    <div className="palette-color-bar" style={{ backgroundColor: pal.charcoal }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="sidebar-section">
                    <div className="sidebar-section-title">Overlay Elements</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            className="badge-btn"
                            style={{ flex: 1 }}
                            onClick={() => {
                                updateCardMeta('overlay', {
                                    position: 'top-left',
                                    iconId: 'costLeaf',
                                    value: '5',
                                    color: 'secondary'
                                } as any);
                            }}
                        >
                            + Left Leaf Cost
                        </button>
                        <button
                            className="badge-btn"
                            style={{ flex: 1 }}
                            onClick={() => {
                                setActiveCard(prev => {
                                    const next = { ...prev };
                                    delete next.overlay;
                                    return next;
                                });
                            }}
                        >
                            Clear Overlay
                        </button>
                    </div>
                </div>
            </div>

            {/* ==========================================
             * 2. CENTER PANEL: Visual Drafting Workspace
             * ========================================== */}
            <div className="sandbox-canvas-panel">
                <div className="canvas-header">
                    <div className="canvas-title">
                        Drafting Canvas <span className="canvas-badge">{viewMode === 'print' ? 'PHYSICAL PRINT (MM)' : 'RESPONSIVE VIEW'}</span>
                    </div>

                    <div className="canvas-controls">
                        <div className="slider-container">
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Zoom</span>
                            <input
                                type="range"
                                min="0.4"
                                max="2.5"
                                step="0.1"
                                className="input-range"
                                value={scale}
                                onChange={(e) => setScale(parseFloat(e.target.value))}
                                style={{ width: '80px' }}
                            />
                        </div>

                        <div className="toggle-button-group">
                            <button
                                className={`toggle-btn ${viewMode === 'print' ? 'active' : ''}`}
                                onClick={() => setViewMode('print')}
                            >
                                Print (mm)
                            </button>
                            <button
                                className={`toggle-btn ${viewMode === 'web' ? 'active' : ''}`}
                                onClick={() => setViewMode('web')}
                            >
                                Web (Responsive)
                            </button>
                        </div>

                        <div className="toggle-button-group">
                            <button
                                className={`toggle-btn ${showWireframe ? 'active' : ''}`}
                                onClick={() => setShowWireframe(!showWireframe)}
                            >
                                Wireframe Grid
                            </button>
                        </div>

                        <div className="toggle-button-group">
                            <button
                                className={`toggle-btn ${isFlipped ? 'active' : ''}`}
                                onClick={() => setIsFlipped(!isFlipped)}
                                disabled={!activeCard.backIconId}
                                title={activeCard.backIconId ? "Flip Card (3D)" : "Add a Back Face Icon first to enable flipping"}
                                style={{ opacity: activeCard.backIconId ? 1 : 0.5, cursor: activeCard.backIconId ? 'pointer' : 'not-allowed' }}
                            >
                                🔄 Flip Card {isFlipped ? "(Back)" : "(Front)"}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="canvas-body">
                    {/* Render card inside an exploded container if wireframe is active to emphasize blueprint feel */}
                    {showWireframe ? (
                        <div className="exploded-container-view">
                            <div className="exploded-label">GRID GRID WIREFRAME</div>
                            <PlayingCard
                                card={activeCard}
                                paletteOverride={activePalette}
                                customIcons={savedIcons}
                                showWireframe={true}
                                scale={scale}
                                responsive={viewMode === 'web'}
                                isFlipped={isFlipped}
                            />
                        </div>
                    ) : (
                        <PlayingCard
                            card={activeCard}
                            paletteOverride={activePalette}
                            customIcons={savedIcons}
                            showWireframe={false}
                            scale={scale}
                            responsive={viewMode === 'web'}
                            isFlipped={isFlipped}
                            onClick={() => alert(`Card details: ${activeCard.name}`)}
                        />
                    )}
                </div>

                {/* Developer Export area bottom of canvas */}
                <div style={{ padding: '1rem', borderTop: '1px solid #1e293b', backgroundColor: '#0d111a' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8' }}>
                            React Card Schema (JSON)
                        </span>
                        <button
                            className="badge-btn"
                            onClick={() => {
                                navigator.clipboard.writeText(cardExportJSON);
                                alert('Card JSON schema copied to clipboard!');
                            }}
                        >
                            Copy Schema
                        </button>
                    </div>
                    <pre style={{
                        margin: 0,
                        padding: '0.8rem',
                        backgroundColor: '#07090e',
                        borderRadius: '6px',
                        maxHeight: '120px',
                        overflowY: 'auto',
                        fontSize: '0.75rem',
                        fontFamily: 'monospace',
                        color: '#38bdf8',
                        border: '1px solid #1e293b'
                    }}>
                        {cardExportJSON}
                    </pre>
                </div>
            </div>

            {/* ==========================================
             * 3. RIGHT PANEL: Interactive Configurator Tabs
             * ========================================== */}
            <div className="sandbox-editor-panel">
                <div className="editor-tabs">
                    <button
                        className={`editor-tab ${activeTab === 'card' ? 'active' : ''}`}
                        onClick={() => setActiveTab('card')}
                    >
                        Layout
                    </button>
                    <button
                        className={`editor-tab ${activeTab === 'icon' ? 'active' : ''}`}
                        onClick={() => setActiveTab('icon')}
                    >
                        Icon Engine
                    </button>
                    <button
                        className={`editor-tab ${activeTab === 'palette' ? 'active' : ''}`}
                        onClick={() => setActiveTab('palette')}
                    >
                        Palette
                    </button>
                </div>

                <div className="editor-content">
                    {/* ==========================================
                     * TAB A: CARD LAYOUT CONFIGURATOR
                     * ========================================== */}
                    {activeTab === 'card' && (
                        <div>
                            <div className="control-group">
                                <span className="control-label">Millimeter Grid Scale (Mobile Dense Support)</span>
                                <div className="slider-container">
                                    <span style={{ fontSize: '0.8rem' }}>Width:</span>
                                    <input
                                        type="range"
                                        min="20"
                                        max="100"
                                        className="input-range"
                                        value={activeCard.widthMm}
                                        onChange={(e) => updateCardMeta('widthMm', parseInt(e.target.value))}
                                    />
                                    <span className="slider-value">{activeCard.widthMm}mm</span>
                                </div>
                                <div className="slider-container" style={{ marginTop: '0.6rem' }}>
                                    <span style={{ fontSize: '0.8rem' }}>Height:</span>
                                    <input
                                        type="range"
                                        min="30"
                                        max="140"
                                        className="input-range"
                                        value={activeCard.heightMm}
                                        onChange={(e) => updateCardMeta('heightMm', parseInt(e.target.value))}
                                    />
                                    <span className="slider-value">{activeCard.heightMm}mm</span>
                                </div>
                                <div className="slider-container" style={{ marginTop: '0.6rem' }}>
                                    <span style={{ fontSize: '0.8rem' }}>Corners:</span>
                                    <input
                                        type="range"
                                        min="0"
                                        max="12"
                                        step="0.5"
                                        className="input-range"
                                        value={activeCard.borderRadiusMm}
                                        onChange={(e) => updateCardMeta('borderRadiusMm', parseFloat(e.target.value))}
                                    />
                                    <span className="slider-value">{activeCard.borderRadiusMm}mm</span>
                                </div>
                            </div>

                            <div className="control-group">
                                <span className="control-label">Card Outer Border</span>
                                <div className="slider-container" style={{ marginBottom: '0.6rem' }}>
                                    <span style={{ fontSize: '0.8rem', width: '80px' }}>Thickness:</span>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1.5"
                                        step="0.02"
                                        className="input-range"
                                        value={activeCard.borderWidth !== undefined ? activeCard.borderWidth : 0.22}
                                        onChange={(e) => updateCardMeta('borderWidth', parseFloat(e.target.value))}
                                    />
                                    <span className="slider-value">{(activeCard.borderWidth !== undefined ? activeCard.borderWidth : 0.22).toFixed(2)}em</span>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Border Color</span>
                                    <select
                                        className="input-text"
                                        value={activeCard.borderColor || ''}
                                        onChange={(e) => updateCardMeta('borderColor', e.target.value)}
                                        style={{ background: '#0f172a' }}
                                    >
                                        <option value="">Default Palette Border</option>
                                        <option value="primary">Primary</option>
                                        <option value="secondary">Secondary</option>
                                        <option value="accent">Accent</option>
                                        <option value="tertiary">Tertiary</option>
                                        <option value="success">Success</option>
                                        <option value="danger">Danger</option>
                                        <option value="charcoal">Charcoal</option>
                                        <option value="background">Background</option>
                                    </select>
                                </div>
                            </div>

                            <div className="control-group">
                                <span className="control-label">Card Back Face (Flippable)</span>
                                <div style={{ marginBottom: '0.6rem' }}>
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Back Face Icon</span>
                                    <select
                                        className="input-text"
                                        value={activeCard.backIconId || ''}
                                        onChange={(e) => updateCardMeta('backIconId', e.target.value || undefined)}
                                        style={{ background: '#0f172a' }}
                                    >
                                        <option value="">None (One-sided Card)</option>
                                        {Object.keys(savedIcons).map(id => (
                                            <option key={id} value={id}>
                                                {savedIcons[id].name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {activeCard.backIconId && (
                                    <div>
                                        <div style={{ marginBottom: '0.6rem' }}>
                                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Back Background Color</span>
                                            <select
                                                className="input-text"
                                                value={activeCard.backBgColor || ''}
                                                onChange={(e) => updateCardMeta('backBgColor', e.target.value || undefined)}
                                                style={{ background: '#0f172a' }}
                                            >
                                                <option value="">Default (Charcoal)</option>
                                                <option value="primary">Primary</option>
                                                <option value="secondary">Secondary</option>
                                                <option value="accent">Accent</option>
                                                <option value="tertiary">Tertiary</option>
                                                <option value="success">Success</option>
                                                <option value="danger">Danger</option>
                                                <option value="charcoal">Charcoal</option>
                                                <option value="background">Card BG</option>
                                            </select>
                                        </div>
                                        
                                        <button
                                            className="btn-primary"
                                            style={{ marginTop: '0.4rem', padding: '0.4rem', fontSize: '0.75rem' }}
                                            onClick={() => setIsFlipped(!isFlipped)}
                                        >
                                            🔄 Test 3D Flip
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="control-group">
                                <span className="control-label">Header Status Bar</span>
                                <input
                                    type="text"
                                    className="input-text"
                                    placeholder="Card Title"
                                    value={activeCard.header?.title || ''}
                                    onChange={(e) => updateHeader('title', e.target.value)}
                                    style={{ marginBottom: '0.5rem' }}
                                />
                                <div className="flex-row" style={{ marginBottom: '0.5rem' }}>
                                    <input
                                        type="text"
                                        className="input-text"
                                        placeholder="Subtitle"
                                        value={activeCard.header?.subtitle || ''}
                                        onChange={(e) => updateHeader('subtitle', e.target.value)}
                                    />
                                    <input
                                        type="text"
                                        className="input-text"
                                        placeholder="Stats (e.g. IV)"
                                        value={activeCard.header?.stats || ''}
                                        onChange={(e) => updateHeader('stats', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Header Background</span>
                                    <select
                                        className="input-text"
                                        value={activeCard.header?.background || ''}
                                        onChange={(e) => updateHeader('background', e.target.value)}
                                        style={{ background: '#0f172a' }}
                                    >
                                        <option value="">Transparent (Default)</option>
                                        <option value="none">No Background</option>
                                        <option value="background">Card Background</option>
                                        <option value="panelBg">Panel Background</option>
                                        <option value="charcoal">Charcoal</option>
                                        <option value="accent">Accent</option>
                                        <option value="primary">Primary</option>
                                        <option value="tertiary">Tertiary</option>
                                    </select>
                                </div>
                            </div>

                            <div className="control-group">
                                <span className="control-label">Main Illustration Panel</span>
                                <div className="flex-row" style={{ marginBottom: '0.5rem' }}>
                                    <select
                                        className="input-text"
                                        value={activeCard.mainArt?.iconId || ''}
                                        onChange={(e) => updateMainArt('iconId', e.target.value)}
                                        style={{ background: '#0f172a' }}
                                    >
                                        <option value="">No Illustration</option>
                                        {Object.keys(savedIcons).map(id => (
                                            <option key={id} value={id}>
                                                {savedIcons[id].name}
                                            </option>
                                        ))}
                                    </select>

                                    <select
                                        className="input-text"
                                        value={activeCard.mainArt?.frameStyle || 'none'}
                                        onChange={(e) => updateMainArt('frameStyle', e.target.value)}
                                        style={{ background: '#0f172a' }}
                                    >
                                        <option value="none">No Frame</option>
                                        <option value="thin">Thin Border</option>
                                        <option value="thick">Thick Border</option>
                                        <option value="double">Double Frame</option>
                                    </select>
                                </div>
                            </div>

                            <div className="control-group">
                                <span className="control-label">Dynamic Data Regions</span>
                                <div style={{ display: 'flex', gap: '6px', marginBottom: '0.8rem' }}>
                                    <button className="badge-btn" onClick={handleAddDataRow}>
                                        + Add Label Stat
                                    </button>
                                    <button className="badge-btn" onClick={handleAddCostRow}>
                                        + Add Cost Grid
                                    </button>
                                </div>

                                <div style={{ marginBottom: '0.8rem' }}>
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Data Area Background</span>
                                    <select
                                        className="input-text"
                                        value={activeCard.data?.background || ''}
                                        onChange={(e) => updateDataArea('background', e.target.value)}
                                        style={{ background: '#0f172a' }}
                                    >
                                        <option value="">Transparent (Default)</option>
                                        <option value="none">No Background</option>
                                        <option value="background">Card Background</option>
                                        <option value="panelBg">Panel Background</option>
                                        <option value="charcoal">Charcoal</option>
                                        <option value="primary">Primary</option>
                                    </select>
                                </div>

                                {activeCard.data?.rows.map((row, idx) => (
                                    <div key={idx} style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.4rem',
                                        padding: '0.6rem',
                                        backgroundColor: '#0f172a',
                                        borderRadius: '6px',
                                        marginBottom: '0.6rem',
                                        border: '1px solid #2d3748'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#38bdf8' }}>
                                                {row.iconsList ? 'Cost Grid (List)' : 'Label Stat'}
                                            </span>
                                            <button className="icon-btn danger" onClick={() => handleDeleteDataRow(idx)}>
                                                <i className="fa fa-trash"></i>
                                            </button>
                                        </div>

                                        {row.iconsList ? (
                                            /* Configurable Cost Grid Options */
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid #1a202c', paddingTop: '4px' }}>
                                                <div className="flex-row">
                                                    <div>
                                                        <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Align</span>
                                                        <select
                                                            className="input-text"
                                                            style={{ padding: '2px 4px', fontSize: '0.75rem', background: '#131924' }}
                                                            value={row.iconsListAlign || 'center'}
                                                            onChange={(e) => handleUpdateDataRow(idx, 'iconsListAlign', e.target.value)}
                                                        >
                                                            <option value="left">Left</option>
                                                            <option value="center">Center</option>
                                                            <option value="right">Right</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Pill BG</span>
                                                        <select
                                                            className="input-text"
                                                            style={{ padding: '2px 4px', fontSize: '0.75rem', background: '#131924' }}
                                                            value={row.iconsListBg || ''}
                                                            onChange={(e) => handleUpdateDataRow(idx, 'iconsListBg', e.target.value)}
                                                        >
                                                            <option value="">Default Pill BG</option>
                                                            <option value="none">No Background</option>
                                                            <option value="panelBg">Mint/Panel BG</option>
                                                            <option value="charcoal">Charcoal</option>
                                                            <option value="background">Background</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="flex-row" style={{ marginTop: '2px' }}>
                                                    <div className="slider-container">
                                                        <span style={{ fontSize: '0.65rem' }}>Size:</span>
                                                        <input
                                                            type="range"
                                                            min="0.6"
                                                            max="2.5"
                                                            step="0.1"
                                                            className="input-range"
                                                            value={row.iconsListIconSize || 1.4}
                                                            onChange={(e) => handleUpdateDataRow(idx, 'iconsListIconSize', parseFloat(e.target.value))}
                                                        />
                                                        <span style={{ fontSize: '0.65rem' }}>{row.iconsListIconSize ?? 1.4}em</span>
                                                    </div>
                                                    <div className="slider-container">
                                                        <span style={{ fontSize: '0.65rem' }}>Gap:</span>
                                                        <input
                                                            type="range"
                                                            min="0.2"
                                                            max="2.0"
                                                            step="0.1"
                                                            className="input-range"
                                                            value={row.iconsListGap || 0.8}
                                                            onChange={(e) => handleUpdateDataRow(idx, 'iconsListGap', parseFloat(e.target.value))}
                                                        />
                                                        <span style={{ fontSize: '0.65rem' }}>{row.iconsListGap ?? 0.8}em</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            /* Stat Label Inputs */
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <input
                                                    type="text"
                                                    className="input-text"
                                                    style={{ padding: '2px 6px', fontSize: '0.8rem' }}
                                                    value={row.label || ''}
                                                    onChange={(e) => handleUpdateDataRow(idx, 'label', e.target.value)}
                                                />
                                                <input
                                                    type="text"
                                                    className="input-text"
                                                    style={{ padding: '2px 6px', fontSize: '0.8rem', width: '80px' }}
                                                    value={row.value || ''}
                                                    onChange={(e) => handleUpdateDataRow(idx, 'value', e.target.value)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="control-group">
                                <span className="control-label">Footer & Typography Block</span>
                                <input
                                    type="text"
                                    className="input-text"
                                    placeholder="Description or Flavor Text"
                                    value={activeCard.footer?.text || ''}
                                    onChange={(e) => updateFooter('text', e.target.value)}
                                    style={{ marginBottom: '0.5rem' }}
                                />
                                <div className="flex-row" style={{ marginBottom: '0.5rem' }}>
                                    <div>
                                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Align</span>
                                        <select
                                            className="input-text"
                                            value={activeCard.footer?.align || 'center'}
                                            onChange={(e) => updateFooter('align', e.target.value as any)}
                                            style={{ background: '#0f172a', padding: '3px 8px' }}
                                        >
                                            <option value="left">Left</option>
                                            <option value="center">Center</option>
                                            <option value="right">Right</option>
                                        </select>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>V-Center</span>
                                        <select
                                            className="input-text"
                                            value={activeCard.footer?.verticalAlign || 'center'}
                                            onChange={(e) => updateFooter('verticalAlign', e.target.value as any)}
                                            style={{ background: '#0f172a', padding: '3px 8px' }}
                                        >
                                            <option value="top">Top</option>
                                            <option value="center">Middle</option>
                                            <option value="bottom">Bottom</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Footer Background</span>
                                    <select
                                        className="input-text"
                                        value={activeCard.footer?.background || ''}
                                        onChange={(e) => updateFooter('background', e.target.value)}
                                        style={{ background: '#0f172a' }}
                                    >
                                        <option value="">Default (panelBg)</option>
                                        <option value="none">No Background</option>
                                        <option value="background">Card Background</option>
                                        <option value="panelBg">Panel Background</option>
                                        <option value="charcoal">Charcoal</option>
                                        <option value="success">Success (Green)</option>
                                        <option value="danger">Danger (Red)</option>
                                    </select>
                                </div>
                            </div>

                            {activeCard.overlay && (
                                <div className="control-group">
                                    <span className="control-label">Card Overlay (Cost Ribbon)</span>
                                    
                                    <div className="flex-row" style={{ marginBottom: '0.5rem' }}>
                                        <input
                                            type="text"
                                            className="input-text"
                                            placeholder="Overlay Value"
                                            value={activeCard.overlay.value || ''}
                                            onChange={(e) => updateOverlay('value', e.target.value)}
                                        />
                                        <select
                                            className="input-text"
                                            value={activeCard.overlay.color || 'charcoal'}
                                            onChange={(e) => updateOverlay('color', e.target.value)}
                                            style={{ background: '#0f172a' }}
                                        >
                                            <option value="charcoal">Charcoal Text</option>
                                            <option value="background">Cream Text</option>
                                            <option value="primary">Primary Text</option>
                                            <option value="secondary">Secondary Text</option>
                                            <option value="accent">Accent Text</option>
                                        </select>
                                    </div>

                                    <div className="flex-row" style={{ marginBottom: '0.8rem' }}>
                                        <div>
                                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Ribbon Border</span>
                                            <select
                                                className="input-text"
                                                value={activeCard.overlay.borderColor || ''}
                                                onChange={(e) => updateOverlay('borderColor', e.target.value)}
                                                style={{ background: '#0f172a' }}
                                            >
                                                <option value="">Default (Charcoal)</option>
                                                <option value="primary">Primary</option>
                                                <option value="secondary">Secondary</option>
                                                <option value="accent">Accent</option>
                                                <option value="tertiary">Tertiary</option>
                                                <option value="success">Success</option>
                                                <option value="danger">Danger</option>
                                                <option value="background">Card BG</option>
                                            </select>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Ribbon Fill</span>
                                            <select
                                                className="input-text"
                                                value={activeCard.overlay.backgroundColor || ''}
                                                onChange={(e) => updateOverlay('backgroundColor', e.target.value)}
                                                style={{ background: '#0f172a' }}
                                            >
                                                <option value="">Default (Gold)</option>
                                                <option value="primary">Primary</option>
                                                <option value="secondary">Secondary</option>
                                                <option value="accent">Accent</option>
                                                <option value="tertiary">Tertiary</option>
                                                <option value="success">Success</option>
                                                <option value="danger">Danger</option>
                                                <option value="charcoal">Charcoal</option>
                                                <option value="background">Card BG</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.8rem' }}>
                                        <input
                                            type="checkbox"
                                            id="overlayShowBorder"
                                            checked={activeCard.overlay.showBorder ?? true}
                                            onChange={(e) => updateOverlay('showBorder', e.target.checked)}
                                            style={{ accentColor: '#38bdf8', cursor: 'pointer' }}
                                        />
                                        <label htmlFor="overlayShowBorder" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', cursor: 'pointer' }}>
                                            Enable Ribbon Border
                                        </label>
                                    </div>

                                    {activeCard.overlay.showBorder !== false && (
                                        <div className="slider-container" style={{ marginBottom: '0.8rem' }}>
                                            <span style={{ fontSize: '0.75rem', width: '85px' }}>Border Thick:</span>
                                            <input
                                                type="range"
                                                min="0.05"
                                                max="0.8"
                                                step="0.01"
                                                className="input-range"
                                                value={activeCard.overlay.borderWidth !== undefined ? activeCard.overlay.borderWidth : 0.288}
                                                onChange={(e) => updateOverlay('borderWidth', parseFloat(e.target.value))}
                                            />
                                            <span className="slider-value">{(activeCard.overlay.borderWidth !== undefined ? activeCard.overlay.borderWidth : 0.288).toFixed(3)}em</span>
                                        </div>
                                    )}

                                    <div className="slider-container" style={{ marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.75rem', width: '60px' }}>Offset X:</span>
                                        <input
                                            type="range"
                                            min="-3"
                                            max="3"
                                            step="0.1"
                                            className="input-range"
                                            value={activeCard.overlay.offsetX !== undefined ? activeCard.overlay.offsetX : -0.7}
                                            onChange={(e) => updateOverlay('offsetX', parseFloat(e.target.value))}
                                        />
                                        <span className="slider-value">{activeCard.overlay.offsetX !== undefined ? activeCard.overlay.offsetX : -0.7}em</span>
                                    </div>

                                    <div className="slider-container">
                                        <span style={{ fontSize: '0.75rem', width: '60px' }}>Offset Y:</span>
                                        <input
                                            type="range"
                                            min="-3"
                                            max="3"
                                            step="0.1"
                                            className="input-range"
                                            value={activeCard.overlay.offsetY !== undefined ? activeCard.overlay.offsetY : 0.0}
                                            onChange={(e) => updateOverlay('offsetY', parseFloat(e.target.value))}
                                        />
                                        <span className="slider-value">{activeCard.overlay.offsetY !== undefined ? activeCard.overlay.offsetY : 0.0}em</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ==========================================
                     * TAB B: EXPRESSIVE VECTOR ICON DESIGNER
                     * ========================================== */}
                    {activeTab === 'icon' && (
                        <div>
                            <div className="control-group" style={{ backgroundColor: '#131924' }}>
                                <span className="control-label">Active Icon Compiler</span>
                                <div className="flex-row" style={{ marginBottom: '0.6rem' }}>
                                    <input
                                        type="text"
                                        className="input-text"
                                        placeholder="Icon ID"
                                        value={editingIcon.id}
                                        onChange={(e) => setEditingIcon(prev => ({ ...prev, id: e.target.value }))}
                                    />
                                    <input
                                        type="text"
                                        className="input-text"
                                        placeholder="Display Name"
                                        value={editingIcon.name}
                                        onChange={(e) => setEditingIcon(prev => ({ ...prev, name: e.target.value }))}
                                    />
                                </div>

                                <div style={{ height: '80px', background: '#0c0f17', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #334155', marginBottom: '0.6rem' }}>
                                    <div style={{ width: '60px', height: '60px' }}>
                                        <ExpressiveIcon icon={editingIcon} palette={activePalette} savedIcons={savedIcons} />
                                    </div>
                                </div>

                                <button className="btn-primary" onClick={handleSaveIcon}>
                                    Compile & Inject Icon
                                </button>
                            </div>

                            <span className="control-label">Vector Layer Stack</span>
                            <div className="add-layer-bar">
                                <span style={{ fontSize: '0.7rem', color: '#94a3b8', width: '100%', marginBottom: '2px' }}>+ Insert Primitive:</span>
                                <button className="badge-btn" onClick={() => handleAddLayer('circle')}>Circle</button>
                                <button className="badge-btn" onClick={() => handleAddLayer('semi-circle')}>Semi-C</button>
                                <button className="badge-btn" onClick={() => handleAddLayer('quarter-circle')}>Quarter</button>
                                <button className="badge-btn" onClick={() => handleAddLayer('rectangle')}>Rect</button>
                                <button className="badge-btn" onClick={() => handleAddLayer('triangle')}>Triangle</button>
                                <button className="badge-btn" onClick={() => handleAddLayer('arch')}>Arch</button>
                                <button className="badge-btn" onClick={() => handleAddLayer('zig-zag')}>ZigZag</button>
                                <button className="badge-btn" onClick={() => handleAddLayer('stripes')}>Stripes</button>
                                <button className="badge-btn" onClick={() => handleAddLayer('dots')}>Dots</button>
                                <button className="badge-btn" onClick={() => handleAddLayer('ref')}>Ref Icon</button>
                                <button className="badge-btn" style={{ borderColor: '#38bdf8' }} onClick={() => handleAddLayer('boolean')}>
                                    ⚡ Boolean Mask
                                </button>
                            </div>

                            {/* Layers stack rendering */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {editingIcon.layers.map((layer, idx) => (
                                    <div
                                        key={layer.id}
                                        className={`layer-card ${selectedLayerId === layer.id ? 'active' : ''}`}
                                        onClick={() => setSelectedLayerId(layer.id)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div className="layer-card-header">
                                            <span style={{ fontWeight: 800 }}>
                                                {idx + 1}. {layer.type === 'boolean' ? `BOOLEAN (${(layer as BooleanOperation).op})` : layer.type.toUpperCase()}
                                            </span>
                                            <div className="layer-actions" onClick={e => e.stopPropagation()}>
                                                <button className="icon-btn" onClick={() => handleMoveLayer(idx, 'up')}>
                                                    <i className="fa fa-chevron-up"></i>
                                                </button>
                                                <button className="icon-btn" onClick={() => handleMoveLayer(idx, 'down')}>
                                                    <i className="fa fa-chevron-down"></i>
                                                </button>
                                                <button className="icon-btn danger" onClick={() => handleDeleteLayer(layer.id)}>
                                                    <i className="fa fa-trash"></i>
                                                </button>
                                            </div>
                                        </div>

                                        {/* If active, render properties inspector inside the layer card */}
                                        {selectedLayerId === layer.id && (
                                            <div style={{ marginTop: '0.4rem', borderTop: '1px solid #232d42', paddingTop: '0.4rem' }} onClick={e => e.stopPropagation()}>
                                                {layer.type === 'boolean' ? (
                                                    // Boolean Operation Inspector
                                                    <div>
                                                        <div className="flex-row" style={{ marginBottom: '4px' }}>
                                                            <div>
                                                                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Action</span>
                                                                <select
                                                                    className="input-text"
                                                                    style={{ padding: '2px 4px', fontSize: '0.75rem', background: '#0f172a' }}
                                                                    value={(layer as BooleanOperation).op}
                                                                    onChange={(e) => updateActiveLayer({ op: e.target.value as any })}
                                                                >
                                                                    <option value="subtract">Subtract (Cut out)</option>
                                                                    <option value="intersect">Intersect (Clip to)</option>
                                                                    <option value="union">Union (Stack)</option>
                                                                </select>
                                                            </div>
                                                        </div>
                                                        <div className="flex-row">
                                                            <div>
                                                                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Base Layer (A)</span>
                                                                <select
                                                                    className="input-text"
                                                                    style={{ padding: '2px 4px', fontSize: '0.75rem', background: '#0f172a' }}
                                                                    value={(layer as BooleanOperation).baseId}
                                                                    onChange={(e) => updateActiveLayer({ baseId: e.target.value })}
                                                                >
                                                                    {editingIcon.layers.filter(l => l.id !== layer.id).map(l => (
                                                                        <option key={l.id} value={l.id}>{l.type.toUpperCase()} ({l.id.slice(-4)})</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Operand Layer (B)</span>
                                                                <select
                                                                    className="input-text"
                                                                    style={{ padding: '2px 4px', fontSize: '0.75rem', background: '#0f172a' }}
                                                                    value={(layer as BooleanOperation).operandId}
                                                                    onChange={(e) => updateActiveLayer({ operandId: e.target.value })}
                                                                >
                                                                    {editingIcon.layers.filter(l => l.id !== layer.id).map(l => (
                                                                        <option key={l.id} value={l.id}>{l.type.toUpperCase()} ({l.id.slice(-4)})</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : layer.type === 'ref' ? (
                                                    // Icon Reference Inspector
                                                    <div>
                                                        <div>
                                                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Target Saved Icon</span>
                                                            <select
                                                                className="input-text"
                                                                style={{ padding: '2px 4px', fontSize: '0.75rem', background: '#0f172a', marginBottom: '4px' }}
                                                                value={(layer as IconRef).iconId}
                                                                onChange={(e) => updateActiveLayer({ iconId: e.target.value })}
                                                            >
                                                                {Object.keys(savedIcons).map(k => (
                                                                    <option key={k} value={k}>{savedIcons[k].name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div className="flex-row">
                                                            <div className="slider-container">
                                                                <span style={{ fontSize: '0.7rem' }}>X:</span>
                                                                <input
                                                                    type="range"
                                                                    min="0"
                                                                    max="100"
                                                                    className="input-range"
                                                                    value={(layer as IconRef).x}
                                                                    onChange={(e) => updateActiveLayer({ x: parseInt(e.target.value) })}
                                                                />
                                                            </div>
                                                            <div className="slider-container">
                                                                <span style={{ fontSize: '0.7rem' }}>Y:</span>
                                                                <input
                                                                    type="range"
                                                                    min="0"
                                                                    max="100"
                                                                    className="input-range"
                                                                    value={(layer as IconRef).y}
                                                                    onChange={(e) => updateActiveLayer({ y: parseInt(e.target.value) })}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="flex-row" style={{ marginTop: '4px' }}>
                                                            <div className="slider-container">
                                                                <span style={{ fontSize: '0.7rem' }}>Scale:</span>
                                                                <input
                                                                    type="range"
                                                                    min="0.1"
                                                                    max="2.5"
                                                                    step="0.05"
                                                                    className="input-range"
                                                                    value={(layer as IconRef).scale}
                                                                    onChange={(e) => updateActiveLayer({ scale: parseFloat(e.target.value) })}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    // Standard Primitive Inspector
                                                    <div>
                                                        <div className="flex-row" style={{ marginBottom: '4px' }}>
                                                            <div className="slider-container">
                                                                <span style={{ fontSize: '0.7rem', width: '15px' }}>X:</span>
                                                                <input
                                                                    type="range"
                                                                    min="0"
                                                                    max="100"
                                                                    className="input-range"
                                                                    value={(layer as PrimitiveShape).x}
                                                                    onChange={(e) => updateActiveLayer({ x: parseInt(e.target.value) })}
                                                                />
                                                                <span style={{ fontSize: '0.7rem' }}>{(layer as PrimitiveShape).x}</span>
                                                            </div>
                                                            <div className="slider-container">
                                                                <span style={{ fontSize: '0.7rem', width: '15px' }}>Y:</span>
                                                                <input
                                                                    type="range"
                                                                    min="0"
                                                                    max="100"
                                                                    className="input-range"
                                                                    value={(layer as PrimitiveShape).y}
                                                                    onChange={(e) => updateActiveLayer({ y: parseInt(e.target.value) })}
                                                                />
                                                                <span style={{ fontSize: '0.7rem' }}>{(layer as PrimitiveShape).y}</span>
                                                            </div>
                                                        </div>

                                                        <div className="flex-row" style={{ marginBottom: '4px' }}>
                                                            <div className="slider-container">
                                                                <span style={{ fontSize: '0.7rem', width: '15px' }}>SX:</span>
                                                                <input
                                                                    type="range"
                                                                    min="0.1"
                                                                    max="3.5"
                                                                    step="0.05"
                                                                    className="input-range"
                                                                    value={(layer as PrimitiveShape).scaleX ?? 1}
                                                                    onChange={(e) => updateActiveLayer({ scaleX: parseFloat(e.target.value) })}
                                                                />
                                                                <span style={{ fontSize: '0.7rem' }}>{(layer as PrimitiveShape).scaleX ?? 1}</span>
                                                            </div>
                                                            <div className="slider-container">
                                                                <span style={{ fontSize: '0.7rem', width: '15px' }}>SY:</span>
                                                                <input
                                                                    type="range"
                                                                    min="0.1"
                                                                    max="3.5"
                                                                    step="0.05"
                                                                    className="input-range"
                                                                    value={(layer as PrimitiveShape).scaleY ?? 1}
                                                                    onChange={(e) => updateActiveLayer({ scaleY: parseFloat(e.target.value) })}
                                                                />
                                                                <span style={{ fontSize: '0.7rem' }}>{(layer as PrimitiveShape).scaleY ?? 1}</span>
                                                            </div>
                                                        </div>

                                                        <div className="flex-row" style={{ marginBottom: '4px' }}>
                                                            <div className="slider-container">
                                                                <span style={{ fontSize: '0.7rem', width: '15px' }}>Rot:</span>
                                                                <input
                                                                    type="range"
                                                                    min="0"
                                                                    max="360"
                                                                    className="input-range"
                                                                    value={(layer as PrimitiveShape).rotation ?? 0}
                                                                    onChange={(e) => updateActiveLayer({ rotation: parseInt(e.target.value) })}
                                                                />
                                                                <span style={{ fontSize: '0.7rem' }}>{(layer as PrimitiveShape).rotation ?? 0}°</span>
                                                            </div>
                                                            <div className="slider-container">
                                                                <span style={{ fontSize: '0.7rem', width: '15px' }}>Opa:</span>
                                                                <input
                                                                    type="range"
                                                                    min="0"
                                                                    max="1"
                                                                    step="0.05"
                                                                    className="input-range"
                                                                    value={(layer as PrimitiveShape).opacity ?? 1}
                                                                    onChange={(e) => updateActiveLayer({ opacity: parseFloat(e.target.value) })}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="flex-row" style={{ marginTop: '6px' }}>
                                                            <div>
                                                                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Fill Color</span>
                                                                <select
                                                                    className="input-text"
                                                                    style={{ padding: '2px 4px', fontSize: '0.75rem', background: '#0f172a' }}
                                                                    value={(layer as PrimitiveShape).fill}
                                                                    onChange={(e) => updateActiveLayer({ fill: e.target.value })}
                                                                >
                                                                    <option value="primary">Primary Accent</option>
                                                                    <option value="secondary">Secondary Accent</option>
                                                                    <option value="accent">Accent Color</option>
                                                                    <option value="tertiary">Tertiary Color</option>
                                                                    <option value="success">Success Color</option>
                                                                    <option value="danger">Danger Color</option>
                                                                    <option value="charcoal">Charcoal Tone</option>
                                                                    <option value="background">Card Background</option>
                                                                    <option value="panelBg">Panel Background</option>
                                                                    <option value="#ffffff">Pure White</option>
                                                                    <option value="#ff007f">Synth Pink</option>
                                                                    <option value="#00f0ff">Synth Cyan</option>
                                                                    <option value="transparent">Transparent</option>
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Stroke Style</span>
                                                                <select
                                                                    className="input-text"
                                                                    style={{ padding: '2px 4px', fontSize: '0.75rem', background: '#0f172a' }}
                                                                    value={(layer as PrimitiveShape).stroke ?? 'none'}
                                                                    onChange={(e) => updateActiveLayer({ stroke: e.target.value })}
                                                                >
                                                                    <option value="none">None</option>
                                                                    <option value="border">Border Color</option>
                                                                    <option value="charcoal">Charcoal Tone</option>
                                                                    <option value="#ffffff">Pure White</option>
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ==========================================
                     * TAB C: DESIGN SCHEMES & PALETTES BUILDER
                     * ========================================== */}
                    {activeTab === 'palette' && (
                        <div>
                            <div className="control-group">
                                <span className="control-label">Custom Palette Compiler</span>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                    <div>
                                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Scheme Name:</span>
                                        <input
                                            type="text"
                                            className="input-text"
                                            value={paletteForm.name}
                                            onChange={(e) => handlePaletteFormChange('name', e.target.value)}
                                        />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                        <div>
                                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Background</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <input
                                                    type="color"
                                                    className="color-picker-input"
                                                    value={paletteForm.background}
                                                    onChange={(e) => handlePaletteFormChange('background', e.target.value)}
                                                />
                                                <span style={{ fontSize: '0.75rem' }}>{paletteForm.background}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Border / Trim</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <input
                                                    type="color"
                                                    className="color-picker-input"
                                                    value={paletteForm.border}
                                                    onChange={(e) => handlePaletteFormChange('border', e.target.value)}
                                                />
                                                <span style={{ fontSize: '0.75rem' }}>{paletteForm.border}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Primary (Orange)</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <input
                                                    type="color"
                                                    className="color-picker-input"
                                                    value={paletteForm.primary}
                                                    onChange={(e) => handlePaletteFormChange('primary', e.target.value)}
                                                />
                                                <span style={{ fontSize: '0.75rem' }}>{paletteForm.primary}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Secondary (Gold)</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <input
                                                    type="color"
                                                    className="color-picker-input"
                                                    value={paletteForm.secondary}
                                                    onChange={(e) => handlePaletteFormChange('secondary', e.target.value)}
                                                />
                                                <span style={{ fontSize: '0.75rem' }}>{paletteForm.secondary}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Accent (Cyan)</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <input
                                                    type="color"
                                                    className="color-picker-input"
                                                    value={paletteForm.accent}
                                                    onChange={(e) => handlePaletteFormChange('accent', e.target.value)}
                                                />
                                                <span style={{ fontSize: '0.75rem' }}>{paletteForm.accent}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Tertiary (Purple)</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <input
                                                    type="color"
                                                    className="color-picker-input"
                                                    value={paletteForm.tertiary}
                                                    onChange={(e) => handlePaletteFormChange('tertiary', e.target.value)}
                                                />
                                                <span style={{ fontSize: '0.75rem' }}>{paletteForm.tertiary}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Success (Green)</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <input
                                                    type="color"
                                                    className="color-picker-input"
                                                    value={paletteForm.success}
                                                    onChange={(e) => handlePaletteFormChange('success', e.target.value)}
                                                />
                                                <span style={{ fontSize: '0.75rem' }}>{paletteForm.success}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Danger (Red)</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <input
                                                    type="color"
                                                    className="color-picker-input"
                                                    value={paletteForm.danger}
                                                    onChange={(e) => handlePaletteFormChange('danger', e.target.value)}
                                                />
                                                <span style={{ fontSize: '0.75rem' }}>{paletteForm.danger}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Charcoal (Body)</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <input
                                                    type="color"
                                                    className="color-picker-input"
                                                    value={paletteForm.charcoal}
                                                    onChange={(e) => handlePaletteFormChange('charcoal', e.target.value)}
                                                />
                                                <span style={{ fontSize: '0.75rem' }}>{paletteForm.charcoal}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <button className="btn-primary" onClick={handleSavePalette}>
                                        Save Custom Palette
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ==========================================
                     * API GUIDE: DYNAMIC OUT-OF-BAND REGISTRATION
                     * ========================================== */}
                    <div className="api-doc-box">
                        <div className="api-doc-title">
                            <i className="fa fa-book"></i> API: Dynamic Icon injection
                        </div>
                        <p style={{ margin: '0 0 0.4rem 0', lineHeight: 1.3, color: '#e2e8f0' }}>
                            You can register and paint new custom vector icons dynamically <strong>out-of-band</strong> from your game rules without modifying the library:
                        </p>
                        <pre style={{
                            margin: 0,
                            padding: '0.5rem',
                            backgroundColor: '#07090e',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            color: '#a8ff00',
                            overflowX: 'auto',
                            fontFamily: 'monospace'
                        }}>
{`// 1. Define custom vector geometry
const starIcon: IconObject = {
  id: 'cyberStar',
  name: 'Cyber Star',
  layers: [
    { 
      id: 's1', 
      type: 'triangle', 
      x: 50, y: 50, 
      scaleX: 1, scaleY: 1, 
      fill: 'accent' // auto-resolves
    },
    { 
      id: 's2', 
      type: 'triangle', 
      x: 50, y: 50, 
      scaleX: 1, scaleY: 1, 
      rotation: 180, 
      fill: 'accent' 
    }
  ]
};

// 2. Inject dynamically into card renderer
<PlayingCard 
  card={myCardDefinition}
  customIcons={{ cyberStar: starIcon }} 
/>`}
                        </pre>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Mount the React Application
const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<SandboxApp />);
}
