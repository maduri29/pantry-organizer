# Cursor pstack

The official Cursor pstack skills are installed for Codex in this project. The source is [cursor/plugins/pstack](https://github.com/cursor/plugins/tree/main/pstack). `skills-lock.json` records the source and installed content hashes for 58 skills. The MIT license is in `PSTACK-LICENSE`.

Restore the project installation with:

```sh
bunx skills experimental_install
```

The skills are development instructions. They are not runtime app dependencies. Formatting and lint checks exclude their copied source so project tooling does not rewrite upstream content.

This installation does not change global agent settings or select unavailable Cursor models. Use the active session model unless the user explicitly configures another supported model. Existing repository checks and user instructions take precedence over skill defaults.

## Design tuning

This pass uses Experience First to keep the established compact phone layout, Fix Root Causes to trace conflicting CSS, Subtract Before You Add to remove unused selectors, and Prove It Works to compare rendered screens and run the app's regression suite.
