import React from "react";
export default function Page({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1>Page</h1>
      <h2>ID: {params.id}</h2>
      <a href="#/">Home</a>
    </div>
  );
}
