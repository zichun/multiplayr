import { Palette, IconObject } from '../../client/lib/card-renderer/types';
import { WrestlerColor } from './MaskmenGameState';

export const MASKMEN_PALETTES: Record<WrestlerColor, Palette> = {
    [WrestlerColor.Pink]: {
        id: 'wrestlerPink',
        name: 'El Viento (Pink)',
        background: '#fff2f9',
        border: '#ff00a0',
        primary: '#ff3eb5',
        secondary: '#ffffff',
        accent: '#00f0ff',
        charcoal: '#111111',
        text: '#1e0c18',
        panelBg: '#ffd4ee',
        tertiary: '#bd00ff',
        success: '#2ecc71',
        danger: '#e74c3c'
    },
    [WrestlerColor.Green]: {
        id: 'wrestlerGreen',
        name: 'El Jaguar (Green)',
        background: '#f0fcf4',
        border: '#1b8a4a',
        primary: '#2ecc71',
        secondary: '#f1c40f',
        accent: '#111111',
        charcoal: '#111111',
        text: '#0a2214',
        panelBg: '#c8f7dc',
        tertiary: '#8f9e8b',
        success: '#2ecc71',
        danger: '#e74c3c'
    },
    [WrestlerColor.Yellow]: {
        id: 'wrestlerYellow',
        name: 'El Fuego (Yellow)',
        background: '#fffdf0',
        border: '#d4ac0d',
        primary: '#f1c40f',
        secondary: '#e67e22',
        accent: '#e74c3c',
        charcoal: '#111111',
        text: '#282205',
        panelBg: '#fef5c0',
        tertiary: '#bd00ff',
        success: '#2ecc71',
        danger: '#e74c3c'
    },
    [WrestlerColor.Blue]: {
        id: 'wrestlerBlue',
        name: 'El Tiburón (Blue)',
        background: '#f0f7fc',
        border: '#1a5276',
        primary: '#3498db',
        secondary: '#ffffff',
        accent: '#111111',
        charcoal: '#111111',
        text: '#0a1b29',
        panelBg: '#d4e6f1',
        tertiary: '#85c1e9',
        success: '#2ecc71',
        danger: '#e74c3c'
    },
    [WrestlerColor.Purple]: {
        id: 'wrestlerPurple',
        name: 'El Místico (Purple)',
        background: '#f5f0fa',
        border: '#6c3483',
        primary: '#9b59b6',
        secondary: '#ffffff',
        accent: '#f1c40f',
        charcoal: '#111111',
        text: '#1e0a2b',
        panelBg: '#ebdef0',
        tertiary: '#d7bde2',
        success: '#2ecc71',
        danger: '#e74c3c'
    },
    [WrestlerColor.Orange]: {
        id: 'wrestlerOrange',
        name: 'El Toro (Orange)',
        background: '#fdf5e6',
        border: '#a04000',
        primary: '#e67e22',
        secondary: '#ffffff',
        accent: '#f1c40f',
        charcoal: '#111111',
        text: '#2c1100',
        panelBg: '#fadbd8',
        tertiary: '#edbb99',
        success: '#2ecc71',
        danger: '#e74c3c'
    }
};

export const MASKMEN_ICONS: Record<string, IconObject> = {
    [`wrestlerMask_${WrestlerColor.Pink}`]: {
        id: `wrestlerMask_${WrestlerColor.Pink}`,
        name: 'El Viento Mask',
        layers: [
            { id: 'wMask_Pink_head', type: 'arch', x: 50, y: 45, scaleX: 1.0, scaleY: 1.0, fill: 'primary' },
            { id: 'wMask_Pink_chin', type: 'triangle', x: 50, y: 65, scaleX: 1.0, scaleY: 0.8, rotation: 180, fill: 'primary' },
            { id: 'wMask_Pink_forehead', type: 'triangle', x: 50, y: 30, scaleX: 0.2, scaleY: 0.5, rotation: 180, fill: 'accent' },
            { id: 'wMask_Pink_eye_l_patch', type: 'circle', x: 40, y: 48, scaleX: 0.45, scaleY: 0.45, fill: 'secondary' },
            { id: 'wMask_Pink_eye_r_patch', type: 'circle', x: 60, y: 48, scaleX: 0.45, scaleY: 0.45, fill: 'secondary' },
            { id: 'wMask_Pink_eye_l_cut', type: 'triangle', x: 40, y: 48, scaleX: 0.2, scaleY: 0.2, rotation: 90, fill: 'charcoal' },
            { id: 'wMask_Pink_eye_r_cut', type: 'triangle', x: 60, y: 48, scaleX: 0.2, scaleY: 0.2, rotation: 270, fill: 'charcoal' },
            { id: 'wMask_Pink_mouth_patch', type: 'circle', x: 50, y: 68, scaleX: 0.35, scaleY: 0.22, fill: 'secondary' },
            { id: 'wMask_Pink_mouth_cut', type: 'rectangle', x: 50, y: 68, scaleX: 0.22, scaleY: 0.08, fill: 'charcoal' }
        ]
    },

    [`wrestlerMask_${WrestlerColor.Green}`]: {
        id: `wrestlerMask_${WrestlerColor.Green}`,
        name: 'El Jaguar Mask',
        layers: [
            { id: 'wMask_Green_head', type: 'arch', x: 50, y: 45, scaleX: 1.0, scaleY: 1.0, fill: 'primary' },
            { id: 'wMask_Green_chin', type: 'triangle', x: 50, y: 65, scaleX: 1.0, scaleY: 0.8, rotation: 180, fill: 'primary' },
            { id: 'wMask_Green_tiger_stripe', type: 'triangle', x: 50, y: 28, scaleX: 0.15, scaleY: 0.45, rotation: 180, fill: 'secondary' },
            { id: 'wMask_Green_eye_l_patch', type: 'triangle', x: 38, y: 48, scaleX: 0.4, scaleY: 0.4, rotation: 45, fill: 'secondary' },
            { id: 'wMask_Green_eye_r_patch', type: 'triangle', x: 62, y: 48, scaleX: 0.4, scaleY: 0.4, rotation: -45, fill: 'secondary' },
            { id: 'wMask_Green_eye_l_cut', type: 'circle', x: 40, y: 48, scaleX: 0.22, scaleY: 0.22, fill: 'charcoal' },
            { id: 'wMask_Green_eye_r_cut', type: 'circle', x: 60, y: 48, scaleX: 0.22, scaleY: 0.22, fill: 'charcoal' },
            { id: 'wMask_Green_mouth_patch', type: 'triangle', x: 50, y: 66, scaleX: 0.35, scaleY: 0.26, rotation: 180, fill: 'secondary' },
            { id: 'wMask_Green_fang_l', type: 'triangle', x: 46, y: 62, scaleX: 0.08, scaleY: 0.12, rotation: 180, fill: 'background' },
            { id: 'wMask_Green_fang_r', type: 'triangle', x: 54, y: 62, scaleX: 0.08, scaleY: 0.12, rotation: 180, fill: 'background' }
        ]
    },

    [`wrestlerMask_${WrestlerColor.Yellow}`]: {
        id: `wrestlerMask_${WrestlerColor.Yellow}`,
        name: 'El Fuego Mask',
        layers: [
            { id: 'wMask_Yellow_head', type: 'arch', x: 50, y: 45, scaleX: 1.0, scaleY: 1.0, fill: 'primary' },
            { id: 'wMask_Yellow_chin', type: 'triangle', x: 50, y: 65, scaleX: 1.0, scaleY: 0.8, rotation: 180, fill: 'primary' },
            { id: 'wMask_Yellow_flame_forehead', type: 'triangle', x: 50, y: 28, scaleX: 0.25, scaleY: 0.55, rotation: 0, fill: 'secondary' },
            { id: 'wMask_Yellow_eye_l_patch', type: 'arch', x: 37, y: 48, scaleX: 0.28, scaleY: 0.45, rotation: 120, fill: 'secondary' },
            { id: 'wMask_Yellow_eye_r_patch', type: 'arch', x: 63, y: 48, scaleX: 0.28, scaleY: 0.45, rotation: -120, fill: 'secondary' },
            { id: 'wMask_Yellow_eye_l_cut', type: 'circle', x: 40, y: 48, scaleX: 0.18, scaleY: 0.18, fill: 'charcoal' },
            { id: 'wMask_Yellow_eye_r_cut', type: 'circle', x: 60, y: 48, scaleX: 0.18, scaleY: 0.18, fill: 'charcoal' },
            { id: 'wMask_Yellow_mouth_patch', type: 'circle', x: 50, y: 68, scaleX: 0.28, scaleY: 0.28, fill: 'accent' },
            { id: 'wMask_Yellow_mouth_cut', type: 'circle', x: 50, y: 68, scaleX: 0.14, scaleY: 0.14, fill: 'charcoal' }
        ]
    },

    [`wrestlerMask_${WrestlerColor.Blue}`]: {
        id: `wrestlerMask_${WrestlerColor.Blue}`,
        name: 'El Tiburón Mask',
        layers: [
            { id: 'wMask_Blue_head', type: 'arch', x: 50, y: 45, scaleX: 1.0, scaleY: 1.0, fill: 'primary' },
            { id: 'wMask_Blue_chin', type: 'triangle', x: 50, y: 65, scaleX: 1.0, scaleY: 0.8, rotation: 180, fill: 'primary' },
            { id: 'wMask_Blue_fin_forehead', type: 'triangle', x: 50, y: 28, scaleX: 0.25, scaleY: 0.45, rotation: 0, fill: 'secondary' },
            { id: 'wMask_Blue_eye_l_patch', type: 'semi-circle', x: 38, y: 48, scaleX: 0.38, scaleY: 0.38, rotation: 90, fill: 'secondary' },
            { id: 'wMask_Blue_eye_r_patch', type: 'semi-circle', x: 62, y: 48, scaleX: 0.38, scaleY: 0.38, rotation: -90, fill: 'secondary' },
            { id: 'wMask_Blue_eye_l_cut', type: 'triangle', x: 38, y: 48, scaleX: 0.18, scaleY: 0.18, rotation: 90, fill: 'charcoal' },
            { id: 'wMask_Blue_eye_r_cut', type: 'triangle', x: 62, y: 48, scaleX: 0.18, scaleY: 0.18, rotation: 270, fill: 'charcoal' },
            { id: 'wMask_Blue_mouth_patch', type: 'rectangle', x: 50, y: 68, scaleX: 0.35, scaleY: 0.18, fill: 'secondary' },
            { id: 'wMask_Blue_mouth_cut', type: 'zig-zag', x: 50, y: 68, scaleX: 0.35, scaleY: 0.18, fill: 'charcoal' }
        ]
    },

    [`wrestlerMask_${WrestlerColor.Purple}`]: {
        id: `wrestlerMask_${WrestlerColor.Purple}`,
        name: 'El Místico Mask',
        layers: [
            { id: 'wMask_Purple_head', type: 'arch', x: 50, y: 45, scaleX: 1.0, scaleY: 1.0, fill: 'primary' },
            { id: 'wMask_Purple_chin', type: 'triangle', x: 50, y: 65, scaleX: 1.0, scaleY: 0.8, rotation: 180, fill: 'primary' },
            { id: 'wMask_Purple_cross_v', type: 'rectangle', x: 50, y: 28, scaleX: 0.08, scaleY: 0.28, fill: 'accent' },
            { id: 'wMask_Purple_cross_h', type: 'rectangle', x: 50, y: 28, scaleX: 0.2, scaleY: 0.08, fill: 'accent' },
            { id: 'wMask_Purple_eye_l_patch', type: 'circle', x: 38, y: 48, scaleX: 0.38, scaleY: 0.38, fill: 'accent' },
            { id: 'wMask_Purple_eye_l_cover', type: 'circle', x: 42, y: 48, scaleX: 0.33, scaleY: 0.33, fill: 'primary' },
            { id: 'wMask_Purple_eye_r_patch', type: 'circle', x: 62, y: 48, scaleX: 0.38, scaleY: 0.38, fill: 'accent' },
            { id: 'wMask_Purple_eye_r_cover', type: 'circle', x: 58, y: 48, scaleX: 0.33, scaleY: 0.33, fill: 'primary' },
            { id: 'wMask_Purple_eye_l_cut', type: 'circle', x: 36, y: 48, scaleX: 0.18, scaleY: 0.18, fill: 'charcoal' },
            { id: 'wMask_Purple_eye_r_cut', type: 'circle', x: 64, y: 48, scaleX: 0.18, scaleY: 0.18, fill: 'charcoal' },
            { id: 'wMask_Purple_mouth_patch', type: 'triangle', x: 50, y: 68, scaleX: 0.28, scaleY: 0.18, rotation: 0, fill: 'accent' },
            { id: 'wMask_Purple_mouth_cut', type: 'circle', x: 50, y: 70, scaleX: 0.08, scaleY: 0.08, fill: 'charcoal' }
        ]
    },

    [`wrestlerMask_${WrestlerColor.Orange}`]: {
        id: `wrestlerMask_${WrestlerColor.Orange}`,
        name: 'El Toro Mask',
        layers: [
            { id: 'wMask_Orange_head', type: 'arch', x: 50, y: 45, scaleX: 1.0, scaleY: 1.0, fill: 'primary' },
            { id: 'wMask_Orange_chin', type: 'triangle', x: 50, y: 65, scaleX: 1.0, scaleY: 0.8, rotation: 180, fill: 'primary' },
            { id: 'wMask_Orange_horn_l', type: 'arch', x: 34, y: 24, scaleX: 0.18, scaleY: 0.45, rotation: -45, fill: 'secondary' },
            { id: 'wMask_Orange_horn_r', type: 'arch', x: 66, y: 24, scaleX: 0.18, scaleY: 0.45, rotation: 45, fill: 'secondary' },
            { id: 'wMask_Orange_eye_l_patch', type: 'triangle', x: 38, y: 48, scaleX: 0.42, scaleY: 0.28, rotation: 15, fill: 'secondary' },
            { id: 'wMask_Orange_eye_r_patch', type: 'triangle', x: 62, y: 48, scaleX: 0.42, scaleY: 0.28, rotation: -15, fill: 'secondary' },
            { id: 'wMask_Orange_eye_l_cut', type: 'rectangle', x: 38, y: 49, scaleX: 0.22, scaleY: 0.1, rotation: 15, fill: 'charcoal' },
            { id: 'wMask_Orange_eye_r_cut', type: 'rectangle', x: 62, y: 49, scaleX: 0.22, scaleY: 0.1, rotation: -15, fill: 'charcoal' },
            { id: 'wMask_Orange_nose_ring', type: 'circle', x: 50, y: 62, scaleX: 0.18, scaleY: 0.18, fill: 'accent' },
            { id: 'wMask_Orange_nose_ring_c', type: 'circle', x: 50, y: 62, scaleX: 0.1, scaleY: 0.1, fill: 'primary' },
            { id: 'wMask_Orange_mouth_cut', type: 'semi-circle', x: 50, y: 72, scaleX: 0.28, scaleY: 0.18, rotation: 180, fill: 'charcoal' }
        ]
    }
};
