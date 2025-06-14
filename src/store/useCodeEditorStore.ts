import { CodeEditorState } from "./../types/index";
import { LANGUAGE_CONFIG } from "@/app/(root)/_constants";
import { create } from "zustand";
import { editor as MonacoEditor } from "monaco-editor";

const getInitialState = () => {
    // if we're on the server, return default values
    if (typeof window === "undefined") {
        return {
            language: "javascript",
            fontSize: 16,
            theme: "vs-dark",
        };
    }

    // if we're on the client, return values from local storage bc localStorage is a browser API.
    try {
        const savedLanguage = localStorage.getItem("editor-language") || "javascript";
        const savedTheme = localStorage.getItem("editor-theme") || "vs-dark";
        const savedFontSize = localStorage.getItem("editor-font-size") || "16";

        return {
            language: savedLanguage,
            theme: savedTheme,
            fontSize: Number(savedFontSize),
        };
    } catch (error) {
        // Fallback if localStorage is not available
        console.warn("localStorage not available:", error);
        return {
            language: "javascript",
            fontSize: 16,
            theme: "vs-dark",
        };
    }
};

export const useCodeEditorStore = create<CodeEditorState>((set, get) => {
    const initialState = getInitialState();

    return {
        ...initialState,
        output: "",
        isRunning: false,
        error: null,
        editor: null,
        executionResult: null,

        getCode: () => get().editor?.getValue() || "",

        setEditor: (editor: MonacoEditor.IStandaloneCodeEditor) => {
            if (typeof window !== "undefined") {
                try {
                    const savedCode = localStorage.getItem(`editor-code-${get().language}`);
                    if (savedCode) {
                        editor.setValue(savedCode);
                    }
                } catch (error) {
                    console.warn("Could not load saved code:", error);
                }
            }

            set({ editor });
        },

        setTheme: (theme: string) => {
            if (typeof window !== "undefined") {
                try {
                    localStorage.setItem("editor-theme", theme);
                } catch (error) {
                    console.warn("Could not save theme:", error);
                }
            }
            set({ theme });
        },

        setFontSize: (fontSize: number) => {
            if (typeof window !== "undefined") {
                try {
                    localStorage.setItem("editor-font-size", fontSize.toString());
                } catch (error) {
                    console.warn("Could not save font size:", error);
                }
            }
            set({ fontSize });
        },

        setLanguage: (language: string) => {
            if (typeof window !== "undefined") {
                try {
                    // Save current language code before switching
                    const currentCode = get().editor?.getValue();
                    if (currentCode) {
                        localStorage.setItem(`editor-code-${get().language}`, currentCode);
                    }

                    localStorage.setItem("editor-language", language);
                } catch (error) {
                    console.warn("Could not save language or code:", error);
                }
            }

            set({
                language,
                output: "",
                error: null,
            });
        },

        runCode: async () => {
            const { language, getCode } = get();
            const code = getCode();

            if (!code) {
                set({ error: "Please enter some code" });
                return;
            }

            set({ isRunning: true, error: null, output: "" });

            try {
                const runtime = LANGUAGE_CONFIG[language]?.pistonRuntime;

                if (!runtime) {
                    throw new Error(`No runtime configuration found for language: ${language}`);
                }

                const response = await fetch("https://emkc.org/api/v2/piston/execute", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        language: runtime.language,
                        version: runtime.version,
                        files: [{ content: code }],
                    }),
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();

                console.log("data back from piston:", data);

                // handle API-level errors
                if (data.message) {
                    set({
                        error: data.message,
                        executionResult: {
                            code,
                            output: "",
                            error: data.message
                        }
                    });
                    return;
                }

                // handle compilation errors
                if (data.compile && data.compile.code !== 0) {
                    const error = data.compile.stderr || data.compile.output || "Compilation failed";
                    set({
                        error,
                        executionResult: {
                            code,
                            output: "",
                            error,
                        },
                    });
                    return;
                }

                // handle runtime errors
                if (data.run && data.run.code !== 0) {
                    const error = data.run.stderr || data.run.output || "Runtime error";
                    set({
                        error,
                        executionResult: {
                            code,
                            output: "",
                            error,
                        },
                    });
                    return;
                }

                // if we get here, execution was successful
                const output = data.run?.output || "";

                set({
                    output: output.trim(),
                    error: null,
                    executionResult: {
                        code,
                        output: output.trim(),
                        error: null,
                    },
                });
            } catch (error) {
                console.error("Error running code:", error);
                const errorMessage = error instanceof Error ? error.message : "Error running code";
                set({
                    error: errorMessage,
                    executionResult: {
                        code,
                        output: "",
                        error: errorMessage
                    },
                });
            } finally {
                set({ isRunning: false });
            }
        },
    };
});

export const getExecutionResult = () => useCodeEditorStore.getState().executionResult;