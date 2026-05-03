import React, { useState } from "react";

export default function Content() {
  const [count, setCount] = useState(0);

  return (
    <div
      style={{
        padding: "20px",
        border: "1px solid #ccc",
        width: "200px",
        height: "200px%",
        position: "fixed",
        top: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f0f0f0",
        zIndex: 99999999,
      }}
    >
      <h1>Hello from Extro JS</h1>
      <p>This is the content page.</p>

      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>+</button>
      <button onClick={() => setCount(count - 1)}>-</button>
      <button onClick={() => setCount(0)}>Reset</button>
    </div>
  );
}
