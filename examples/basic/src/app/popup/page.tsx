import React, { useState } from "react";

export default function Popup() {
  const [count, setCount] = useState(0);

  return (
    <div style={{ width: "200px" }}>
      <h1>Hello from Extro JS</h1>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>+</button>
      <button onClick={() => setCount(count - 1)}>-</button>
      <button onClick={() => setCount(0)}>Reset</button>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <a href="#/settings">Settings</a>
      <a href="#/c/123">User 123</a>
      <a href="#/c/456">User 456</a>
      </div>
    </div>
  );
}
