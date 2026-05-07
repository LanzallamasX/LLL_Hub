"use client";

import { useState } from "react";

export default function EmailTestCard() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const sendTest = async () => {
    try {
      setLoading(true);
      setResult(null);

      const res = await fetch("/api/test-email", {
        method: "POST",
      });

      const data = await res.json();

      setResult(data);
    } catch (err: any) {
      setResult({
        success: false,
        error: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-5">
      <h2 className="text-lg font-semibold text-white">
        Test de Emails
      </h2>

      <p className="mt-2 text-sm text-lll-text-soft">
        Envía un email de prueba usando Resend.
      </p>

      <button
        onClick={sendTest}
        disabled={loading}
        className="mt-4 rounded-xl bg-[#4AFF96] px-4 py-2 text-black font-medium hover:opacity-90 transition disabled:opacity-50"
      >
        {loading ? "Enviando..." : "Enviar Test"}
      </button>

      {result && (
        <div className="mt-4 rounded-xl bg-black/30 p-4 text-sm">
          <pre className="whitespace-pre-wrap text-green-400">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}