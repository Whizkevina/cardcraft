import "./index.css";
import { patchCanvasTextBaseline } from "@/lib/fabricTextFix";
import App from "./App";
import { createRoot } from "react-dom/client";

patchCanvasTextBaseline();

createRoot(document.getElementById("root")!).render(<App />);
