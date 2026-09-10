import { registerRootComponent } from "expo";
// Registering the background location task must happen before the root
// component, and before any UI module is evaluated. Android restores the task
// into a headless JS context after a reboot or a process kill; if the handler
// is not defined by the time it fires, the app dies on start.
import "./src/services/location";
import App from "./App";

registerRootComponent(App);
