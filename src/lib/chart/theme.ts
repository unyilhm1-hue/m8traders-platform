/**
 * KLineChart Theme Configuration
 * Matches m8traders design system
 */

export interface ChartTheme {
    grid: {
        show: boolean;
        horizontal: { show: boolean; size: number; color: string; style: string };
        vertical: { show: boolean; size: number; color: string; style: string };
    };
    candle: {
        type: string;
        bar: {
            upColor: string;
            downColor: string;
            noChangeColor: string;
            upBorderColor: string;
            downBorderColor: string;
            noChangeBorderColor: string;
            upWickColor: string;
            downWickColor: string;
            noChangeWickColor: string;
        };
        priceMark: {
            show: boolean;
            high: { show: boolean; color: string; textSize: number };
            low: { show: boolean; color: string; textSize: number };
            last: {
                show: boolean;
                upColor: string;
                downColor: string;
                noChangeColor: string;
                line: { show: boolean; style: string; color: string; size: number };
                text: { show: boolean; size: number; paddingLeft: number; paddingRight: number; color: string };
            };
        };
    };
    xAxis: {
        show: boolean;
        size: number;
        axisLine: { show: boolean; color: string; size: number };
        tickText: { show: boolean; color: string; size: number };
        tickLine: { show: boolean; size: number; color: string };
    };
    yAxis: {
        show: boolean;
        size: number;
        position: string;
        type: string;
        axisLine: { show: boolean; color: string; size: number };
        tickText: { show: boolean; color: string; size: number };
        tickLine: { show: boolean; size: number; color: string };
    };
    crosshair: {
        show: boolean;
        horizontal: {
            show: boolean;
            line: { show: boolean; style: string; size: number; color: string };
            text: { show: boolean; color: string; size: number; borderRadius: number; paddingLeft: number; paddingRight: number; paddingTop: number; paddingBottom: number; backgroundColor: string };
        };
        vertical: {
            show: boolean;
            line: { show: boolean; style: string; size: number; color: string };
            text: { show: boolean; color: string; size: number; borderRadius: number; paddingLeft: number; paddingRight: number; paddingTop: number; paddingBottom: number; backgroundColor: string };
        };
    };
    overlay: {
        line: { color: string; size: number };
        point: { color: string; borderColor: string; borderSize: number; radius: number };
        polygon: { color: string };
        rect: { color: string; borderColor: string; borderSize: number };
        text: { color: string; size: number };
    };
}

/**
 * Dark theme matching m8traders design system
 */
export const darkTheme: ChartTheme = {
    grid: {
        show: true,
        horizontal: {
            show: true,
            size: 1,
            color: 'rgba(255, 255, 255, 0.04)',
            style: 'dashed',
        },
        vertical: {
            show: true,
            size: 1,
            color: 'rgba(255, 255, 255, 0.04)',
            style: 'dashed',
        },
    },
    candle: {
        type: 'candle_solid',
        bar: {
            upColor: '#0ECB81',
            downColor: '#F6465D',
            noChangeColor: '#848E9C',
            upBorderColor: '#0ECB81',
            downBorderColor: '#F6465D',
            noChangeBorderColor: '#848E9C',
            upWickColor: '#0ECB81',
            downWickColor: '#F6465D',
            noChangeWickColor: '#848E9C',
        },
        priceMark: {
            show: true,
            high: {
                show: true,
                color: '#EAECEF',
                textSize: 10,
            },
            low: {
                show: true,
                color: '#EAECEF',
                textSize: 10,
            },
            last: {
                show: true,
                upColor: '#0ECB81',
                downColor: '#F6465D',
                noChangeColor: '#848E9C',
                line: {
                    show: true,
                    style: 'dashed',
                    color: '#848E9C',
                    size: 1,
                },
                text: {
                    show: true,
                    size: 12,
                    paddingLeft: 4,
                    paddingRight: 4,
                    color: '#FFFFFF',
                },
            },
        },
    },
    xAxis: {
        show: true,
        size: 40,
        axisLine: {
            show: true,
            color: '#2B3139',
            size: 1,
        },
        tickText: {
            show: true,
            color: '#848E9C',
            size: 11,
        },
        tickLine: {
            show: false,
            size: 1,
            color: '#2B3139',
        },
    },
    yAxis: {
        show: true,
        size: 70,
        position: 'right',
        type: 'normal',
        axisLine: {
            show: true,
            color: '#2B3139',
            size: 1,
        },
        tickText: {
            show: true,
            color: '#848E9C',
            size: 11,
        },
        tickLine: {
            show: false,
            size: 1,
            color: '#2B3139',
        },
    },
    crosshair: {
        show: true,
        horizontal: {
            show: true,
            line: {
                show: true,
                style: 'dashed',
                size: 1,
                color: '#5E6673',
            },
            text: {
                show: true,
                color: '#FFFFFF',
                size: 11,
                borderRadius: 4,
                paddingLeft: 6,
                paddingRight: 6,
                paddingTop: 3,
                paddingBottom: 3,
                backgroundColor: '#474D57',
            },
        },
        vertical: {
            show: true,
            line: {
                show: true,
                style: 'dashed',
                size: 1,
                color: '#5E6673',
            },
            text: {
                show: true,
                color: '#FFFFFF',
                size: 11,
                borderRadius: 4,
                paddingLeft: 6,
                paddingRight: 6,
                paddingTop: 3,
                paddingBottom: 3,
                backgroundColor: '#474D57',
            },
        },
    },
    overlay: {
        line: {
            color: '#7B61FF',
            size: 1,
        },
        point: {
            color: '#7B61FF',
            borderColor: 'rgba(123, 97, 255, 0.35)',
            borderSize: 1,
            radius: 5,
        },
        polygon: {
            color: 'rgba(123, 97, 255, 0.15)',
        },
        rect: {
            color: 'rgba(123, 97, 255, 0.15)',
            borderColor: '#7B61FF',
            borderSize: 1,
        },
        text: {
            color: '#EAECEF',
            size: 11,
        },
    },
};

/**
 * Light theme (placeholder for future)
 */
export const lightTheme: ChartTheme = {
    ...darkTheme,
    // Override with light theme colors when needed
};

/**
 * Get theme by name
 */
export const getChartTheme = (theme: 'dark' | 'light' = 'dark'): ChartTheme => {
    return theme === 'dark' ? darkTheme : lightTheme;
};
