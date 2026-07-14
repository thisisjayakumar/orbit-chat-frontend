import '@testing-library/jest-dom';

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

describe('debug utility', () => {
  let devLog, devWarn;

  beforeEach(async () => {
    // Clear module registry so each test gets a fresh eval of debug.js
    jest.resetModules();
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  it('logs in development mode', async () => {
    process.env.NODE_ENV = 'development';
    jest.spyOn(console, 'log').mockImplementation(() => {});

    const mod = await import('@/utils/debug');
    devLog = mod.devLog;

    devLog('hello', 42);
    expect(console.log).toHaveBeenCalledWith('hello', 42);
  });

  it('warns in development mode', async () => {
    process.env.NODE_ENV = 'development';
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    const mod = await import('@/utils/debug');
    devWarn = mod.devWarn;

    devWarn('careful');
    expect(console.warn).toHaveBeenCalledWith('careful');
  });

  it('suppresses logs in production', async () => {
    process.env.NODE_ENV = 'production';
    jest.spyOn(console, 'log').mockImplementation(() => {});

    const mod = await import('@/utils/debug');
    devLog = mod.devLog;

    devLog('should not appear');
    expect(console.log).not.toHaveBeenCalled();
  });

  it('suppresses warnings in production', async () => {
    process.env.NODE_ENV = 'production';
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    const mod = await import('@/utils/debug');
    devWarn = mod.devWarn;

    devWarn('should not appear');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('suppresses logs in test environment', async () => {
    process.env.NODE_ENV = 'test';
    jest.spyOn(console, 'log').mockImplementation(() => {});

    const mod = await import('@/utils/debug');
    devLog = mod.devLog;

    devLog('should not appear in test');
    expect(console.log).not.toHaveBeenCalled();
  });

  it('handles multiple arguments', async () => {
    process.env.NODE_ENV = 'development';
    jest.spyOn(console, 'log').mockImplementation(() => {});

    const mod = await import('@/utils/debug');
    devLog = mod.devLog;

    const obj = { key: 'value' };
    devLog('prefix', obj, 123);
    expect(console.log).toHaveBeenCalledWith('prefix', obj, 123);
  });
});
