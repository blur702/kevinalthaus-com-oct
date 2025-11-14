/**
 * Smoke test for @monorepo/blog plugin
 * Verifies basic module structure and exports
 */

const pluginModule = require('../index');
const BlogPlugin = pluginModule.default ?? pluginModule;

describe('@monorepo/blog smoke tests', () => {
  it('should export a BlogPlugin class', () => {
    expect(typeof BlogPlugin).toBe('function');
    const instance = new BlogPlugin();
    expect(instance).toBeInstanceOf(BlogPlugin);
  });

  it('should expose lifecycle hooks', () => {
    const instance = new BlogPlugin();
    expect(typeof instance.onInstall).toBe('function');
    expect(typeof instance.onActivate).toBe('function');
    expect(typeof instance.onDeactivate).toBe('function');
    expect(typeof instance.onUninstall).toBe('function');
    expect(typeof instance.onUpdate).toBe('function');
  });
});
