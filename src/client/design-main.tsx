import { render } from "preact";

import { DesignDemo } from "./DesignDemo";
import "./styles.css";

const root = document.querySelector("#app");
if (!root) {
  throw new Error("app root was not found");
}

render(<DesignDemo />, root);
