const serverModule = require('../server/server');
const app = serverModule.app || serverModule;

function printRoutes() {
  console.log('====================================================');
  console.log('📡 COMPLETE REST API ENDPOINT DISCOVERY & AUDIT');
  console.log('====================================================\n');

  const routes = [];

  function extractRoutes(stack, prefix = '') {
    stack.forEach(layer => {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase()).join(',');
        routes.push({
          method: methods,
          path: prefix + layer.route.path
        });
      } else if (layer.name === 'router' && layer.handle.stack) {
        let routePrefix = prefix;
        if (layer.regexp) {
          const match = layer.regexp.source
            .replace('\\/?(?=\\/|$)', '')
            .replace('^\\', '')
            .replace('\\/?$', '')
            .replace(/\\\//g, '/');
          if (match && match !== '/') {
            routePrefix += '/' + match.replace(/^\^|\$$/g, '').replace(/\/\?$/, '');
          }
        }
        extractRoutes(layer.handle.stack, routePrefix);
      }
    });
  }

  if (app._router && app._router.stack) {
    extractRoutes(app._router.stack);
  }

  console.log(`Discovered ${routes.length} total registered routes across Express.\n`);
  routes.sort((a,b) => a.path.localeCompare(b.path));
  
  routes.forEach((r, idx) => {
    console.log(`  [${String(idx+1).padStart(3)}] ${r.method.padEnd(7)} ${r.path}`);
  });

  console.log('\n====================================================\n');
  process.exit(0);
}

printRoutes();
