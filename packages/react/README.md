# @extrojs/react

Base React runtime for [Extro](https://github.com/Sahilm416/extro). Today this is just the ambient typing for `import.meta.env` on extension surfaces, so `import.meta.env.EXTRO_PUBLIC_*` is typed with no setup.

The router lives in [`@extrojs/router`](https://www.npmjs.com/package/@extrojs/router), which re-exports this package, so importing the router is enough to pick up the env types. You rarely depend on `@extrojs/react` directly.

Installed automatically as a dependency of [`extrojs`](https://www.npmjs.com/package/extrojs).

## Docs

[github.com/Sahilm416/extro](https://github.com/Sahilm416/extro)

## License

MIT
