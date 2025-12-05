import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import EvalWrapper from "./evaluation/EvalWrapper";
import KeyboardDirect from "./keyboard/KeyboardDirect";

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Existing evaluation environment */}
                <Route path="/" element={<EvalWrapper />} />

                {/* Direct keyboard testing */}
                <Route path="/keyboard/:layoutId" element={<KeyboardDirect />} />
            </Routes>
        </BrowserRouter>
    );
}
