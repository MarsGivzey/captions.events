import type React from "react";

export default function OBSLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        html, body { background: transparent !important; margin: 0; padding: 0; overflow: hidden; }
      `}</style>
      {children}
    </>
  );
}
