// Lightweight global namespace to organize modules progressively
// This does not change existing globals; it only adds an optional structure.
(function initAppNamespace(global){
  const root = global || (typeof window !== 'undefined' ? window : {});
  if (!root.App) root.App = {};

  // Register a module under App.<name>
  // Usage: App.register('Utils', { fnA, fnB })
  Object.defineProperty(root.App, 'register', {
    value: function register(name, api){
      if (!name) return;
      const key = String(name);
      const prev = this[key] && typeof this[key] === 'object' ? this[key] : {};
      this[key] = Object.assign({}, prev, api || {});
    },
    enumerable: false
  });

  // Optionally expose a top-level helper under App (not recommended for many fns)
  Object.defineProperty(root.App, 'expose', {
    value: function expose(name, fn){
      if (!name) return;
      this[String(name)] = fn;
    },
    enumerable: false
  });
})(typeof window !== 'undefined' ? window : this);

