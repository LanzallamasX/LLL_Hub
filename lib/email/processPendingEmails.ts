export async function processPendingEmails(reason: string) {
  try {
    const res = await fetch("/api/process-emails", {
      method: "GET",
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[email] process failed after ${reason}:`, text);
      return null;
    }

    const result = await res.json();

    if (result?.processed === 0) {
      console.info(`[email] no pending emails after ${reason}`);
    }

    return result;
  } catch (err) {
    console.error(`[email] process request failed after ${reason}:`, err);
    return null;
  }
}
