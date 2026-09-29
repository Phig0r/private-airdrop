async function request(airdrop, leafHash) {
  let response;
  try {
    response = await fetch(`/api/airdrops/${encodeURIComponent(airdrop)}/participants`, {
      ...(leafHash === undefined ? {} : {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leafHash }),
      }),
    });
  } catch {
    throw new Error("Participant server unavailable. Start the backend and check MongoDB.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data)
    throw new Error(data?.error || "Participant server unavailable. Start the backend and check MongoDB.");
  return data;
}

export const participantsApi = {
  save: (airdrop, leafHash) => request(airdrop, leafHash),
  async status(airdrop) {
    const response = await fetch(`/api/airdrops/${airdrop}/status`);
    if (!response.ok) throw new Error("Participant server unavailable.");
    return response.json();
  },
};
