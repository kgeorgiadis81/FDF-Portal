import { routes } from './app.routes';

describe('app routes', () => {
  it('loads every lazy page', async () => {
    const loaders: Array<() => Promise<unknown>> = [];
    const visit = (routeList: typeof routes) => {
      for (const route of routeList) {
        const load = route.loadComponent;
        if (load) {
          loaders.push(() => Promise.resolve(load()));
        }
        if (route.children) {
          visit(route.children);
        }
      }
    };
    visit(routes);
    expect(loaders.length).toBeGreaterThan(10);
    const pages = await Promise.all(loaders.map((load) => load()));
    expect(pages.every((page) => page != null)).toBeTrue();
  });
});
