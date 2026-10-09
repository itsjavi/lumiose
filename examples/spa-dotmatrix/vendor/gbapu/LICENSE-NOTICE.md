# Origin and license status

This private archive packages the portable engine supplied by the user in the
`pkcrystal-apu` project, as adapted in Newbark. The original supplied project's
AGENTS.md explicitly describes `src/engine` as capable of being bundled as a
standalone library. TASK-32 recorded the initial adaptation; subsequent Newbark
timing, channel reset, mixing and offline frame-drain improvements are retained.

`PROVENANCE.json` records the exact copied file hashes, supplied file hashes,
existing adaptation provenance and supplied AGENTS/DSL hashes. Existing comments
and token attribution are preserved. The noise alias table's original comment
identifies its source-derived register constants; no source assembly, original
game songs, cries, ROM, audio bank or game assets are included.

No LICENSE/COPYING file or package.json license field was found in the supplied
project. No permissive license is inferred or invented. `private: true` and
`license: UNLICENSED` describe this package's private distribution status; they
are not a new license grant, upstream ownership claim or replacement attribution.
The newly authored examples and packaging files do not change that status.

This is a user-requested local ZIP, not an npm publication. Obtain the applicable
rights from the original rights holder before assuming redistribution permission.
