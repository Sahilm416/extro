import React from "react";

export default function Content() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f0f0f0",
        zIndex: 1000,
      }}
    >
      <h1>Hello from Extro JS</h1>
      <p>This is the content page.</p>
    </div>
  );
}
