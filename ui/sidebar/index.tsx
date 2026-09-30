import "../shared.scss";

import React from "react";
import ReactDOM from "react-dom";
import App from "./app";

document.addEventListener("DOMContentLoaded", () => {
  ReactDOM.render(<App>Hello, world!</App>, document.getElementById("root"));
});