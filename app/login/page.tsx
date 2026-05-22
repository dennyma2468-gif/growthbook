import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main style={{ padding: "2rem", textAlign: "center" }}>
          <p style={{ color: "#888" }}>Loading...</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
