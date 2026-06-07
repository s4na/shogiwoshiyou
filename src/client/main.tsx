import { render } from "preact";

import { App } from "./App";
import "./styles.css";

const root = document.querySelector("#app");
if (!root) {
  throw new Error("app root was not found");
}

render(<App />, root);
