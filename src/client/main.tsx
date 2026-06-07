import { render } from "preact";

import { App } from "./App";
import "./styles.css";

const root = document.querySelector("#app");
if (!root) {
  throw new Error("app root was not found");
}

if (import.meta.env.DEV && window.location.pathname === "/design") {
  const { DesignDemo } = await import("./DesignDemo");
  render(<DesignDemo />, root);
} else {
  render(<App />, root);
}
