const a = 10;
const b = 2;
const g = 5;
const quotient = a / b / g;
const fromParens = (a + b) / 2;
const re1 = /<style>/g;
const re2 = /[/'"`]+/;
const re3 = /\/style>/i;
const re4 = /a{1,2}<b>c/u;
const inCall = "x".replace(/'/g, "\"");
const inArray = [/x/, /y/];
const afterReturn = () => {
  return /<\/style>/.test("</style>");
};
const afterOperator = a > 1 || /</.test("<");
const afterColon = a ? /a/ : /b/;
const afterBrace = () => {}
/x/.test("x");
const division = quotient / /2/.source.length;
let counter = 0;
counter++ / 2;
const keyword = typeof /x/;
const property = re1.source / 1;

export { quotient, fromParens, re1, re2, re3, re4, inCall, inArray, afterReturn, afterOperator, afterColon, afterBrace, division, keyword, property };
