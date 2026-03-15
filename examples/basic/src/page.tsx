import React, { useState } from "react";

export default function Popup() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <h1>Hello from Extro JS</h1>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>+</button>
      <button onClick={() => setCount(count - 1)}>-</button>
      <button onClick={() => setCount(0)}>Reset</button>
    </div>
  );
}
