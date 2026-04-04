import { createRoot } from "react-dom/client";
import { MantineProvider } from "@mantine/core";

import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <MantineProvider defaultColorScheme="light">
    <App />
  </MantineProvider>
);
