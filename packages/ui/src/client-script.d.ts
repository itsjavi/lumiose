// The client-script import of decision-63, until lumiose's own types declare it: the default
// export, called while a component renders, ships the module with the page that renders it.
declare module "*?lumiose-client" {
  const clientScript: () => void;
  export default clientScript;
}
