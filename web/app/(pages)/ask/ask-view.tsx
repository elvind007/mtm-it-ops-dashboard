"use client";

import { useMutation } from "@tanstack/react-query";
import { CornerDownLeft, FileText, Info, Sparkles } from "lucide-react";
import { useRef, useState } from "react";

import { dashboardApi } from "@/api/dashboardApi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Citation } from "@/types/api";

interface ChatTurn {
    id: string;
    question: string;
    answer: string;
    citations: Citation[];
    usedLlm: boolean;
}

const EXAMPLES = [
    "What do I do if the VPN is down for the whole office?",
    "Who do I page for a Sev 1 outage?",
    "What is our patch SLA for critical CVEs?",
];

const MIN_LEN = 3;
const MAX_LEN = 500;

export function AskView() {
    const [turns, setTurns] = useState<ChatTurn[]>([]);
    const [input, setInput] = useState("");
    const listEndRef = useRef<HTMLDivElement>(null);

    const ask = useMutation({
        mutationFn: async (question: string) => (await dashboardApi.chat(question)).data,
        onSuccess: (data, question) => {
            setTurns((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    question,
                    answer: data.answer,
                    citations: data.citations,
                    usedLlm: data.usedLlm,
                },
            ]);
            // Scroll after the row paints. rAF avoids a setState-in-effect pattern.
            requestAnimationFrame(() =>
                listEndRef.current?.scrollIntoView({ behavior: "smooth" }),
            );
        },
    });

    const trimmed = input.trim();
    const canSubmit = trimmed.length >= MIN_LEN && trimmed.length <= MAX_LEN && !ask.isPending;

    const submit = () => {
        if (!canSubmit) return;
        ask.mutate(trimmed);
        setInput("");
    };

    return (
        <div className="flex h-[calc(100vh-13rem)] flex-col gap-4">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                {turns.length === 0 && !ask.isPending && (
                    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-6">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <Sparkles className="size-4" aria-hidden />
                            Ask about the indexed runbooks, SOPs, and postmortems
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Answers are drawn only from the seeded documents and cite their
                            sources. Try one of these:
                        </p>
                        <div className="flex flex-col gap-2">
                            {EXAMPLES.map((example) => (
                                <button
                                    key={example}
                                    type="button"
                                    onClick={() => setInput(example)}
                                    className="w-fit rounded-md border bg-card px-3 py-1.5 text-left text-xs hover:bg-accent"
                                >
                                    {example}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {turns.map((turn) => (
                    <TurnView key={turn.id} turn={turn} />
                ))}

                {ask.isPending && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Spinner className="size-4" />
                        Searching the documents…
                    </div>
                )}

                {ask.isError && (
                    <Card className="border-[color-mix(in_oklab,var(--status-blocked)_35%,transparent)] p-3 text-sm">
                        Could not reach the chat service. Try again in a moment.
                    </Card>
                )}

                <div ref={listEndRef} />
            </div>

            <div className="flex items-end gap-2">
                <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value.slice(0, MAX_LEN))}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            submit();
                        }
                    }}
                    placeholder="Ask a question… (Enter to send, Shift+Enter for a new line)"
                    rows={2}
                    className="resize-none"
                    aria-label="Ask a question"
                />
                <Button onClick={submit} disabled={!canSubmit} aria-label="Send">
                    <CornerDownLeft className="size-4" />
                </Button>
            </div>
        </div>
    );
}

function TurnView({ turn }: { turn: ChatTurn }) {
    return (
        <div className="space-y-2">
            <div className="flex justify-end">
                <div className="max-w-[85%] rounded-lg rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                    {turn.question}
                </div>
            </div>

            <div className="flex justify-start">
                <div className="max-w-[85%] space-y-2">
                    <div
                        className={cn(
                            "rounded-lg rounded-bl-sm border px-3 py-2 text-sm",
                            turn.usedLlm ? "bg-card" : "bg-muted/50",
                        )}
                    >
                        {turn.usedLlm ? (
                            turn.answer
                        ) : (
                            // Deliberate product behaviour: retrieval short-circuits before
                            // the model when nothing clears the similarity floor. Surface it
                            // as information, not an error.
                            <span className="flex items-start gap-2 text-muted-foreground">
                                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                                No indexed document cleared the similarity threshold, so no
                                answer was generated.
                            </span>
                        )}
                    </div>

                    {turn.citations.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {turn.citations.map((c) => (
                                <span
                                    key={c.n}
                                    title={`similarity ${c.score.toFixed(2)}`}
                                    className="inline-flex items-center gap-1 rounded-md border bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground"
                                >
                                    <FileText className="size-3" aria-hidden />
                                    <span className="font-mono">[{c.n}]</span>
                                    {c.title}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
