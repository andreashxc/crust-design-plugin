# Design Context

Put local site context files here when you want AI coding tools to understand a target website before creating Crust experiments.

Expected layout:

```text
design-context/<site>/DESIGN.md
```

Example:

```text
design-context/ya.ru/DESIGN.md
```

Files inside site folders are ignored by git by default because they can contain client-specific notes, DOM observations, screenshots, tokens, or other private design details. Keep this folder structure locally and commit only sanitized examples intentionally.

To verify that Crust can find a local context file, run:

```sh
corepack pnpm design-context --url https://ya.ru/
```
