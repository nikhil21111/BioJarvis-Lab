"use client";

import { useRef, useEffect } from "react";
import { Message } from "@/types/app";
import { MessageItem } from "./MessageItem";
import { LoadingIndicator } from "./LoadingIndicator";

interface MessageListProps {
  messages: Message[];
  loading: boolean;
  onStructureSelect?: (structureIndex: number) => void;
  onOpenCompare?: () => void;
  showIntentDebug?: boolean;
  onIntentFeedback?: (payload: {
    route: "text_only" | "structure_required";
    verdict: "correct" | "incorrect";
    question?: string;
  }) => void;
}

export function MessageList({
  messages,
  loading,
  onStructureSelect,
  onOpenCompare,
  showIntentDebug,
  onIntentFeedback,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Compute structure index for each message that has a structure
  const structureIndexMap = new Map<string, number>();
  let structureCounter = 0;
  messages.forEach((msg) => {
    if (msg.structure?.pdbId) {
      structureCounter++;
      structureIndexMap.set(msg.id, structureCounter);
    }
  });

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        width: "100%",
        maxWidth: "100%",
      }}
    >
      <div
        style={{
          padding: "16px",
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
        }}
        className="space-y-6"
      >
        {messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            structureIndex={structureIndexMap.get(message.id)}
            onStructureSelect={onStructureSelect}
            onOpenCompare={onOpenCompare}
            showIntentDebug={showIntentDebug}
            onIntentFeedback={onIntentFeedback}
          />
        ))}

        {loading && <LoadingIndicator />}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
