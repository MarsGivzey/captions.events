"use client";

import { useEffect, useState, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface Event {
  id: string;
  uid: string;
  title: string;
  description: string | null;
}

interface OBSViewerProps {
  event: Event;
  size?: string;
  color?: string;
  position?: string;
}

interface Caption {
  id: string;
  text: string;
  timestamp: string;
  is_final: boolean;
}

const FONT_SIZE: Record<string, string> = {
  sm: "1.25rem",
  md: "1.75rem",
  lg: "2.25rem",
  xl: "3rem",
};

const TEXT_COLOR: Record<string, string> = {
  white: "#ffffff",
  yellow: "#fde047",
  green: "#4ade80",
};

const MAX_COMMITTED = 3;

export function OBSViewer({ event, size = "lg", color = "white", position = "bottom" }: OBSViewerProps) {
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [partialText, setPartialText] = useState("");
  const supabase = getSupabaseBrowserClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  const fontSize = FONT_SIZE[size] ?? FONT_SIZE.lg;
  const textColor = TEXT_COLOR[color] ?? TEXT_COLOR.white;
  const isBottom = position !== "top";

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("captions")
        .select("*")
        .eq("event_id", event.id)
        .eq("is_final", true)
        .order("sequence_number", { ascending: true });
      if (data) setCaptions(data.slice(-MAX_COMMITTED));
    };
    load();
  }, [event.id, supabase]);

  useEffect(() => {
    const channel = supabase
      .channel(`captions:${event.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "captions", filter: `event_id=eq.${event.id}` },
        (payload: { new: Caption }) => {
          setPartialText("");
          setCaptions((prev) => {
            const exists = prev.some((c) => c.id === payload.new.id);
            if (exists) return prev;
            return [...prev, payload.new].slice(-MAX_COMMITTED);
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [event.id, supabase]);

  useEffect(() => {
    const broadcast = supabase
      .channel(`broadcast:${event.uid}`)
      .on("broadcast", { event: "partial_transcript" }, (payload: { payload: { text: string } }) => {
        setPartialText(payload.payload.text);
      })
      .subscribe();
    return () => { supabase.removeChannel(broadcast); };
  }, [event.uid, supabase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [captions, partialText]);

  const textStyle: React.CSSProperties = {
    color: textColor,
    fontSize,
    fontWeight: 700,
    lineHeight: 1.35,
    textShadow: "0 2px 6px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.9)",
    fontFamily: "system-ui, sans-serif",
  };

  const lines = [...captions.map((c) => ({ text: c.text, partial: false }))];
  if (partialText) lines.push({ text: partialText, partial: true });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "transparent",
        display: "flex",
        flexDirection: "column",
        justifyContent: isBottom ? "flex-end" : "flex-start",
        padding: "2rem 3rem",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              ...textStyle,
              opacity: line.partial ? 0.65 : 1,
              fontStyle: line.partial ? "italic" : "normal",
            }}
          >
            {line.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
