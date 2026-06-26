/**
 * PlayingCard.tsx
 * Modular playing card component that snaps vector illustrations and data into a strict grid.
 */

import * as React from 'react';
import { CardDefinition, Palette, IconObject, PrimitiveShape } from './types';
import { ExpressiveIcon } from './IconEngine';
import { PALETTES, PRESET_ICONS } from './presets';
import './PlayingCard.scss';

interface PlayingCardProps {
    card: CardDefinition;
    paletteOverride?: Palette;
    customIcons?: Record<string, IconObject>;
    showWireframe?: boolean;
    scale?: number;
    responsive?: boolean;
    style?: React.CSSProperties;
    onClick?: () => void;
    isFlipped?: boolean; // Controls whether the card is flipped showing the back face
    
    // Inherent sizing and interaction states
    width?: string | number;
    height?: string | number;
    hoverable?: boolean;
    selectable?: boolean;
    selected?: boolean;
}

export const PlayingCard: React.FC<PlayingCardProps> = ({
    card,
    paletteOverride,
    customIcons = {},
    showWireframe = false,
    scale = 1,
    responsive = false,
    style = {},
    onClick,
    isFlipped = false,
    
    width,
    height,
    hoverable = false,
    selectable = false,
    selected = false
}) => {
    // 1. Resolve Palette
    let palette: Palette = PALETTES.midCentury; // Fallback
    if (paletteOverride) {
        palette = paletteOverride;
    } else if (typeof card.palette === 'string') {
        palette = PALETTES[card.palette] || PALETTES.midCentury;
    } else if (card.palette && typeof card.palette === 'object') {
        palette = card.palette;
    }

    // 2. Combine Preset and Custom Icons
    const allIcons = {
        ...PRESET_ICONS,
        ...customIcons
    };

    // 3. Resolve base dimensions
    const widthMm = card.widthMm ?? 63.5;
    const heightMm = card.heightMm ?? 88.9;
    const borderRadiusMm = card.borderRadiusMm ?? 3.5;

    // 4. Calculate scaling styles
    const cardBorderWidth = card.borderWidth !== undefined ? `${card.borderWidth}em` : '0.22em';
    const cardBorderColor = card.borderColor ? resolveColorKey(card.borderColor, palette) : palette.border;

    // Flip States
    const hasBackFace = !!card.backIconId;
    const flipped = hasBackFace && isFlipped;
    const backIconObj = card.backIconId ? allIcons[card.backIconId] : null;

    // Check if we should do pixel-based auto-scaling (e.g. if width is specified in px or as a raw number)
    let isPixelScaled = false;
    let scaleFactor = 1;
    let designWidth = 240; // Safe design width in pixels to prevent browser font-size clamping
    let designHeight = 336;

    if (width !== undefined) {
        const widthStr = String(width);
        if (widthStr.endsWith('px') || /^\d+$/.test(widthStr)) {
            const parsedWidth = parseFloat(widthStr);
            if (!isNaN(parsedWidth) && parsedWidth > 0) {
                isPixelScaled = true;
                designWidth = 240;
                const aspectRatio = heightMm / widthMm;
                designHeight = designWidth * aspectRatio;
                scaleFactor = parsedWidth / designWidth;
            }
        }
    }

    // Outer wrapper dimensions
    let wrapperStyle: React.CSSProperties = {
        color: palette.text,
        ...style
    };

    let innerStyle: React.CSSProperties = {};

    if (isPixelScaled) {
        const desiredWidthPx = designWidth * scaleFactor;
        const aspectRatio = heightMm / widthMm;
        
        wrapperStyle = {
            ...wrapperStyle,
            width: `${desiredWidthPx}px`,
            height: `${desiredWidthPx * aspectRatio}px`,
            borderRadius: typeof borderRadiusMm === 'number' ? `${borderRadiusMm * (desiredWidthPx / widthMm)}px` : undefined
        };

        innerStyle = {
            ...innerStyle,
            width: `${designWidth}px`,
            height: `${designHeight}px`,
            fontSize: `${designWidth * 0.052}px`, // 5.2% of design width (12.48px)
            transform: `scale(${scaleFactor}) ${flipped ? 'rotateY(180deg)' : 'rotateY(0deg)'}`,
            transformOrigin: 'top left',
            position: 'absolute',
            top: 0,
            left: 0,
            transition: hasBackFace ? 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'
        };
    } else if (responsive) {
        // Responsive Mode: uses container-query units or percentage ratios
        wrapperStyle = {
            ...wrapperStyle,
            width: wrapperStyle.width ?? '100%',
            height: wrapperStyle.height ?? 'auto',
            aspectRatio: `${widthMm} / ${heightMm}`,
            borderRadius: `${(borderRadiusMm / widthMm) * 100}%`,
            containerType: 'inline-size'
        };
        innerStyle = {
            ...innerStyle,
            fontSize: '5.2cqi',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            transition: hasBackFace ? undefined : 'none'
        };
    } else {
        // Absolute Millimeter Mode: perfect for physical print or fixed previews
        const w = widthMm * scale;
        const h = heightMm * scale;
        const r = borderRadiusMm * scale;
        const baseFontSize = widthMm * 0.052 * scale; // 1em = ~5.2% of card width

        wrapperStyle = {
            ...wrapperStyle,
            width: wrapperStyle.width ?? `${w}mm`,
            height: wrapperStyle.height ?? `${h}mm`,
            borderRadius: `${r}mm`
        };
        innerStyle = {
            ...innerStyle,
            fontSize: `${baseFontSize}mm`,
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            transition: hasBackFace ? undefined : 'none'
        };
    }

    // Pass panel background color and selection outline color as CSS variables
    if (palette.panelBg) {
        (wrapperStyle as any)['--panel-bg'] = palette.panelBg;
    }
    (wrapperStyle as any)['--selected-outline-color'] = palette.border || palette.text || 'currentColor';

    const dimensionsLabel = `${widthMm}mm x ${heightMm}mm (r: ${borderRadiusMm}mm)`;

    // Helper to resolve region background
    const resolveBg = (bgValue?: string, defaultBg?: string) => {
        if (!bgValue) return defaultBg;
        if (bgValue === 'none' || bgValue === 'transparent') return 'transparent';
        return resolveColorKey(bgValue, palette);
    };

    const frontFaceStyle: React.CSSProperties = {
        backgroundColor: palette.background,
        borderColor: cardBorderColor,
        borderWidth: cardBorderWidth,
        color: palette.text,
        zIndex: flipped ? 1 : 2
    };

    const backFaceStyle: React.CSSProperties = {
        backgroundColor: resolveBg(card.backBgColor, palette.charcoal),
        borderColor: cardBorderColor,
        borderWidth: cardBorderWidth,
        color: palette.secondary, // Default back icon to gold accent
        zIndex: flipped ? 2 : 1
    };

    const containerClasses = [
        'playing-card-container',
        showWireframe ? 'wireframe-mode' : '',
        isPixelScaled ? 'is-pixel-scaled' : '',
        hoverable ? 'is-hoverable' : '',
        selectable ? 'is-selectable' : '',
        selected ? 'is-selected' : ''
    ].filter(Boolean).join(' ');

    return (
        <div
            className={containerClasses}
            style={wrapperStyle}
            data-dimensions={dimensionsLabel}
            onClick={onClick}
        >
            <div 
                className="playing-card-inner"
                style={innerStyle}
            >
                {/* ==========================================
                 * FRONT FACE
                 * ========================================== */}
                <div className="playing-card-face face-front" style={frontFaceStyle}>
                    {/* ==========================================
                     * 1. Header / Status Bar
                     * ========================================== */}
                    {card.header && (
                        <div 
                            className="card-header-region" 
                            style={{ backgroundColor: resolveBg(card.header.background, 'transparent') }}
                        >
                            <div className="card-header-text">
                                <span className="card-header-title" style={{ color: palette.text }}>
                                    {card.header.title}
                                </span>
                                {card.header.subtitle && (
                                    <span className="card-header-subtitle" style={{ color: palette.text }}>
                                        {card.header.subtitle}
                                    </span>
                                )}
                            </div>

                            <div className="card-header-meta">
                                {card.header.stats && (
                                    <span className="card-header-stats" style={{ color: palette.primary }}>
                                        {card.header.stats}
                                    </span>
                                )}
                                {card.header.icons && card.header.icons.map((ic, idx) => {
                                    const iconObj = allIcons[ic.iconId];
                                    return (
                                        <div key={idx} className="card-header-icon">
                                            {iconObj ? (
                                                <ExpressiveIcon
                                                    icon={iconObj}
                                                    palette={palette}
                                                    colorOverride={ic.color ? resolveColorKey(ic.color, palette) : undefined}
                                                    scale={ic.scaling}
                                                />
                                            ) : (
                                                <span style={{ fontSize: '1.2em' }}>{ic.value}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ==========================================
                     * 2. Main Art Area
                     * ========================================== */}
                    {card.mainArt && (
                        <div className="card-art-region">
                            <div
                                className={`card-art-frame frame-${card.mainArt.frameStyle ?? 'none'}`}
                                style={{ color: palette.border }}
                            >
                                {card.mainArt.iconId && allIcons[card.mainArt.iconId] ? (
                                    <div className="card-art-content">
                                        <ExpressiveIcon
                                            icon={allIcons[card.mainArt.iconId]}
                                            palette={palette}
                                            savedIcons={allIcons}
                                            scale={card.mainArt.scaling}
                                        />
                                    </div>
                                ) : (
                                    <div style={{ fontSize: '0.8em', opacity: 0.4 }}>No Illustration</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ==========================================
                     * 3. Dynamic Data Areas (Flexible Regions)
                     * ========================================== */}
                    {card.data && (
                        <div 
                            className="card-data-region"
                            style={{ backgroundColor: resolveBg(card.data.background, 'transparent') }}
                        >
                            {card.data.rows && card.data.rows.map((row, idx) => {
                                // Check if this row is a list of icons (Splendor style)
                                if (row.iconsList && row.iconsList.length > 0) {
                                    const listAlign = row.iconsListAlign ?? 'center';
                                    const justifyMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
                                    const iconSize = row.iconsListIconSize ?? 1.4;
                                    const gap = row.iconsListGap ?? 0.8;
                                    const pillBg = row.iconsListBg 
                                        ? (row.iconsListBg === 'none' ? 'transparent' : resolveColorKey(row.iconsListBg, palette))
                                        : undefined; // falls back to scss var(--panel-bg)

                                    return (
                                        <div 
                                            key={idx} 
                                            className="card-data-icons-list"
                                            style={{
                                                justifyContent: justifyMap[listAlign],
                                                gap: `${gap}em`
                                            }}
                                        >
                                            {row.iconsList.map((item, iconIdx) => {
                                                const iconObj = allIcons[item.iconId];
                                                return (
                                                    <div 
                                                        key={iconIdx} 
                                                        className="card-data-icon-item"
                                                        style={{
                                                            backgroundColor: pillBg,
                                                            padding: '0.3em 0.6em',
                                                            fontSize: '1.1em'
                                                        }}
                                                    >
                                                        {iconObj && (
                                                            <div 
                                                                className="card-data-icon-glyph"
                                                                style={{
                                                                    width: `${iconSize}em`,
                                                                    height: `${iconSize}em`,
                                                                    marginRight: '0.3em'
                                                                }}
                                                            >
                                                                <ExpressiveIcon
                                                                    icon={iconObj}
                                                                    palette={palette}
                                                                    savedIcons={allIcons}
                                                                    colorOverride={item.color ? resolveColorKey(item.color, palette) : undefined}
                                                                    scale={item.scaling}
                                                                />
                                                            </div>
                                                        )}
                                                        <span style={{ color: palette.text }}>{item.value}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                }

                                // Otherwise, render a standard label-value data row
                                const rowColor = row.color ? resolveColorKey(row.color, palette) : palette.text;
                                const rowIcon = row.iconId ? allIcons[row.iconId] : null;

                                return (
                                    <div key={idx} className="card-data-row" style={{ color: rowColor }}>
                                        <span className="card-data-label">
                                            {rowIcon && (
                                                <span style={{ display: 'inline-block', width: '1.2em', height: '1.2em', marginRight: '0.3em', verticalAlign: 'middle' }}>
                                                    <ExpressiveIcon icon={rowIcon} palette={palette} scale={row.scaling} />
                                                </span>
                                            )}
                                            {row.label}
                                        </span>
                                        <span className="card-data-value">{row.value}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* ==========================================
                     * 4. Footer / Description Region
                     * ========================================== */}
                    {card.footer && (
                        <div
                            className={`card-footer-region footer-valign-${card.footer.verticalAlign ?? 'center'}`}
                            style={{ backgroundColor: resolveBg(card.footer.background, palette.panelBg ?? 'transparent') }}
                        >
                            <div
                                className={`card-footer-text footer-align-${card.footer.align ?? 'center'}`}
                                style={{ color: palette.charcoal }}
                            >
                                {card.footer.text}
                            </div>
                        </div>
                    )}

                    {/* ==========================================
                     * 5. Composable Overlays (e.g. Top-Left Leaf)
                     * ========================================== */}
                    {card.overlay && (() => {
                        const pos = card.overlay.position;
                        
                        // 1. Resolve custom position offsets
                        const overlayPositionStyle: React.CSSProperties = {};
                        if (card.overlay.offsetY !== undefined) {
                            if (pos.startsWith('top')) {
                                overlayPositionStyle.top = `${card.overlay.offsetY}em`;
                            } else {
                                overlayPositionStyle.bottom = `${card.overlay.offsetY}em`;
                            }
                        }
                        if (card.overlay.offsetX !== undefined) {
                            if (pos.endsWith('left')) {
                                overlayPositionStyle.left = `${card.overlay.offsetX}em`;
                            } else {
                                overlayPositionStyle.right = `${card.overlay.offsetX}em`;
                            }
                        }

                        // 2. Resolve custom icon layer overrides (border, background, visibility, thickness)
                        let overlayIcon = card.overlay.iconId ? allIcons[card.overlay.iconId] : null;
                        if (overlayIcon) {
                            const showBorder = card.overlay.showBorder ?? true;
                            const borderWidth = card.overlay.borderWidth !== undefined ? card.overlay.borderWidth : 0.288;
                            const hasBorderOverride = card.overlay.borderColor !== undefined;
                            const hasBgOverride = card.overlay.backgroundColor !== undefined;

                            // Convert borderWidth from em to SVG units (where 4.8em badge width = 100 SVG units)
                            const t = showBorder ? Math.max(0, Math.min(25, borderWidth * 20.833)) : 0;

                            // Calculate the new inner ribbon scale and positions
                            const innerRectScaleX = (60 - 2 * t) / 50;
                            const innerRectScaleY = (80 - t) / 50;
                            const innerRectY = 40 - t / 2;

                            const innerTriScaleX = (60 - 2 * t) / 50;
                            const innerTriScaleY = 0.8;
                            const innerTriY = 80 - t;

                            overlayIcon = {
                                ...overlayIcon,
                                layers: overlayIcon.layers.map(layer => {
                                    if (layer.id === 'lf_base_rect') {
                                        const shape = layer as PrimitiveShape;
                                        return {
                                            ...shape,
                                            fill: hasBorderOverride ? card.overlay!.borderColor! : shape.fill,
                                            opacity: showBorder ? (shape.opacity ?? 1) : 0
                                        };
                                    }
                                    if (layer.id === 'lf_base_tri') {
                                        const shape = layer as PrimitiveShape;
                                        return {
                                            ...shape,
                                            opacity: showBorder ? (shape.opacity ?? 1) : 0
                                        };
                                    }

                                    if (layer.id === 'lf_gold_rect') {
                                        const shape = layer as PrimitiveShape;
                                        return {
                                            ...shape,
                                            fill: hasBgOverride ? card.overlay!.backgroundColor! : shape.fill,
                                            scaleX: innerRectScaleX,
                                            scaleY: innerRectScaleY,
                                            y: innerRectY
                                        };
                                    }
                                    if (layer.id === 'lf_gold_tri') {
                                        const shape = layer as PrimitiveShape;
                                        return {
                                            ...shape,
                                            scaleX: innerTriScaleX,
                                            scaleY: innerTriScaleY,
                                            y: innerTriY
                                        };
                                    }

                                    return layer;
                                })
                            };
                        }

                        return (
                            <div 
                                className={`card-overlay-component overlay-${pos}`}
                                style={overlayPositionStyle}
                            >
                                <div className="overlay-leaf-badge">
                                    {overlayIcon ? (
                                        <div className="overlay-leaf-icon">
                                            <ExpressiveIcon
                                                icon={overlayIcon}
                                                palette={palette}
                                                savedIcons={allIcons}
                                                scale={card.overlay.scaling}
                                            />
                                        </div>
                                    ) : (
                                        <div
                                            style={{
                                                position: 'absolute',
                                                width: '100%',
                                                height: '100%',
                                                backgroundColor: resolveColorKey(card.overlay.backgroundColor || 'charcoal', palette),
                                                borderRadius: '50%',
                                                border: (card.overlay.showBorder ?? true)
                                                    ? `${card.overlay.borderWidth ?? 0.1}em solid ${resolveColorKey(card.overlay.borderColor || 'border', palette)}`
                                                    : 'none'
                                            }}
                                        />
                                    )}
                                    <span
                                        className="overlay-leaf-value"
                                        style={{ color: card.overlay.color ? resolveColorKey(card.overlay.color, palette) : palette.text }}
                                    >
                                        {card.overlay.value}
                                    </span>
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* ==========================================
                 * BACK FACE (Optional)
                 * ========================================== */}
                {hasBackFace && (
                    <div className="playing-card-face face-back" style={backFaceStyle}>
                        {backIconObj && (
                            <ExpressiveIcon
                                icon={backIconObj}
                                palette={palette}
                                savedIcons={allIcons}
                                scale={card.backIconScaling}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

/**
 * Helper to resolve color keys to values.
 */
function resolveColorKey(colorKey: string, palette: Palette): string {
    const key = colorKey.toLowerCase() as keyof Palette;
    if (palette && palette[key]) {
        return palette[key] as string;
    }
    return colorKey;
}
