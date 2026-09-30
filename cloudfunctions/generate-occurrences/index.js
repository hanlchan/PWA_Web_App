function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function callRpc(name, args = {}) {
  const envId = requiredEnv("CLOUDBASE_ENV_ID");
  const response = await fetch(`https://${envId}.api.tcloudbasegateway.com/v1/rdb/rest/rpc/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requiredEnv("CLOUDBASE_APIKEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!response.ok) throw new Error(`RPC ${name} failed with status ${response.status}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

exports.main = async () => {
  try {
    const processedPlans = await callRpc("generate_all_occurrences");
    return { ok: true, processedPlans };
  } catch (error) {
    console.error("generate-occurrences failed", error instanceof Error ? error.message : "unknown error");
    throw error;
  }
};
