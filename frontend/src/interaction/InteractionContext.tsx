import React, { createContext, useContext, useState } from "react";
import { InteractionConfig } from "./types";
import { DEFAULT_DWELL } from "./defaults";

type Ctx = {
    config: InteractionConfig;
    setConfig: (c: InteractionConfig) => void;
};

const InteractionContext = createContext<Ctx>({
    config: DEFAULT_DWELL,
    setConfig: () => {}
});

export const InteractionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [config, setConfig] = useState(DEFAULT_DWELL);

    return (
        <InteractionContext.Provider value={{ config, setConfig }}>
            {children}
        </InteractionContext.Provider>
    );
};

export const useInteraction = () => useContext(InteractionContext);