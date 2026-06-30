const base = "http://localhost:5000";

async function main() {
  const home = await fetch(base + "/");
  console.log("GET /", home.status, home.headers.get("content-type"));

  const t0 = Date.now();
  const mainTsx = await fetch(base + "/src/main.tsx");
  console.log("GET /src/main.tsx", mainTsx.status, `${Date.now() - t0}ms`);

  const loginRes = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "19684371-K", password: "admin" }),
  });
  const loginBody = await loginRes.json();
  console.log("POST /api/auth/login", loginRes.status, loginBody.token ? "token ok" : loginBody);

  if (loginBody.token) {
    const userRes = await fetch(base + "/api/auth/user", {
      headers: { Authorization: `Bearer ${loginBody.token}` },
    });
    const userBody = await userRes.json();
    console.log("GET /api/auth/user", userRes.status, userBody.user?.rut, userBody.user?.role);

    const docRes = await fetch(base + "/api/doctors/me", {
      headers: { Authorization: `Bearer ${loginBody.token}` },
    });
    const docBody = await docRes.json().catch(() => ({}));
    console.log("GET /api/doctors/me", docRes.status, docBody.specialty ?? docBody);
  }
}

main().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
