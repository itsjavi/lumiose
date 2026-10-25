// Read by the styles (`@media (width < $BREAKPOINT)`) and by the JS (`matchMedia` in App.stsx): a
// `$` constant, because `var()` does not work in media queries and JS checks the same width.
export const BREAKPOINT = "640px";
