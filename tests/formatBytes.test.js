const { formatBytes } = require('../assets/js/common');

describe('formatBytes', () => {
    test('handles 0 correctly', () => {
        expect(formatBytes(0)).toBe('0 B');
    });

    test('handles missing or null bytes', () => {
        expect(formatBytes(null)).toBe('—');
        expect(formatBytes(undefined)).toBe('—');
        expect(formatBytes(false)).toBe('—');
    });

    test('formats bytes to correct string representation', () => {
        expect(formatBytes(1)).toBe('1 B');
        expect(formatBytes(1024)).toBe('1.0 KB');
        expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
        expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB');
    });

    test('formats larger sizes correctly', () => {
        expect(formatBytes(Math.pow(1024, 4))).toBe('1.0 TB');
        expect(formatBytes(Math.pow(1024, 5))).toBe('1.0 PB');
        expect(formatBytes(Math.pow(1024, 6))).toBe('1.0 EB');
        expect(formatBytes(Math.pow(1024, 7))).toBe('1.0 ZB');
        expect(formatBytes(Math.pow(1024, 8))).toBe('1.0 YB');
    });

    test('handles negative bytes', () => {
        expect(formatBytes(-1024)).toBe('-1.0 KB');
        expect(formatBytes(-1048576)).toBe('-1.0 MB');
    });
});
