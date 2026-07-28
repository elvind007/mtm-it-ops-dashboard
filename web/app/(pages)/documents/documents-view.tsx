"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { DocumentMarkdown } from "@/components/documents/markdown";
import { LoadingData, NoRecordFound, ServerError } from "@/components/placeholders";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDocument, useDocuments } from "@/hooks/use-dashboard";
import { cn } from "@/lib/utils";

export function DocumentsView() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const docParam = searchParams.get("doc");

    const {
        data: documents,
        isPending: listPending,
        isError: listError,
        refetch: refetchList,
    } = useDocuments();

    const selectedSource =
        docParam ?? (documents && documents.length > 0 ? documents[0].source : null);

    // When the list loads and there is no ?doc=, default to the first document.
    useEffect(() => {
        if (docParam || !documents || documents.length === 0) return;
        const first = documents[0].source;
        router.replace(`/documents?doc=${encodeURIComponent(first)}`, { scroll: false });
    }, [docParam, documents, router]);

    const {
        data: document,
        isPending: detailPending,
        isError: detailError,
        refetch: refetchDetail,
    } = useDocument(selectedSource);

    if (listError) {
        return (
            <ServerError
                action={
                    <Button size="sm" variant="outline" onClick={() => void refetchList()}>
                        Try again
                    </Button>
                }
            />
        );
    }

    if (listPending) return <LoadingData rows={6} />;
    if (!documents || documents.length === 0) {
        return (
            <NoRecordFound
                title="No indexed documents"
                description="The RAG corpus has not been seeded yet."
            />
        );
    }

    const select = (source: string) => {
        router.replace(`/documents?doc=${encodeURIComponent(source)}`, { scroll: false });
    };

    return (
        <div className="flex h-[calc(100vh-13rem)] min-h-[24rem] overflow-hidden rounded-lg border">
            <nav
                aria-label="Documents"
                className="flex w-64 shrink-0 flex-col border-r bg-muted/30"
            >
                <ScrollArea className="flex-1">
                    <ul className="space-y-0.5 p-2">
                        {documents.map((doc) => {
                            const active = doc.source === selectedSource;
                            return (
                                <li key={doc.source}>
                                    <button
                                        type="button"
                                        onClick={() => select(doc.source)}
                                        aria-current={active ? "page" : undefined}
                                        className={cn(
                                            "w-full rounded-md px-2.5 py-2 text-left transition-colors",
                                            active
                                                ? "bg-primary text-primary-foreground"
                                                : "hover:bg-accent",
                                        )}
                                    >
                                        <span className="block truncate text-sm font-medium">
                                            {doc.title}
                                        </span>
                                        <span
                                            className={cn(
                                                "mt-0.5 block text-[11px]",
                                                active
                                                    ? "text-primary-foreground/80"
                                                    : "text-muted-foreground",
                                            )}
                                        >
                                            {doc.chunkCount === 1
                                                ? "1 chunk"
                                                : `${doc.chunkCount} chunks`}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </ScrollArea>
            </nav>

            <div className="min-w-0 flex-1 overflow-y-auto p-6">
                {detailError ? (
                    <ServerError
                        action={
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void refetchDetail()}
                            >
                                Try again
                            </Button>
                        }
                    />
                ) : detailPending || !document ? (
                    <LoadingData rows={8} />
                ) : (
                    <article>
                        <header className="mb-4 border-b pb-3">
                            <h2 className="text-lg font-semibold tracking-tight">
                                {document.title}
                            </h2>
                            <p className="mt-1 font-mono text-xs text-muted-foreground">
                                {document.source}
                            </p>
                        </header>
                        <DocumentMarkdown content={document.content} />
                    </article>
                )}
            </div>
        </div>
    );
}
